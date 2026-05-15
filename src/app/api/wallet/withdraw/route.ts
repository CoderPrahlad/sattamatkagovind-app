import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendWithdrawalAlert } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const {
      amount,
      bankHolderName,
      bankAccountNumber,
      ifscCode,
      bankName,
      upiId,
      paymentMethod,
    } = body;

    if (!amount || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Amount and payment method are required' },
        { status: 400 }
      );
    }

    if (paymentMethod !== 'bank' && paymentMethod !== 'upi') {
      return NextResponse.json(
        { success: false, error: 'Payment method must be "bank" or "upi"' },
        { status: 400 }
      );
    }

    // Validate required fields per payment method
    if (paymentMethod === 'bank') {
      if (!bankHolderName || !bankAccountNumber || !ifscCode || !bankName) {
        return NextResponse.json(
          { success: false, error: 'Bank holder name, account number, IFSC code, and bank name are required for bank transfer' },
          { status: 400 }
        );
      }
    }

    if (paymentMethod === 'upi') {
      if (!upiId) {
        return NextResponse.json(
          { success: false, error: 'UPI ID is required for UPI transfer' },
          { status: 400 }
        );
      }
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Get minimum withdrawal from config
    const minWithdrawConfig = await db.gameConfig.findUnique({
      where: { key: 'min_withdraw_amount' },
    });
    const minAmount = minWithdrawConfig ? parseFloat(minWithdrawConfig.value) : 500;

    if (amount < minAmount) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal amount is ₹${minAmount}` },
        { status: 400 }
      );
    }

    // Get user info for email alert (before transaction modifies balance)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, mobile: true },
    });

    // Create transaction, deduct balance, and save bank detail
    // Balance check is done inside the transaction via conditional update to prevent race conditions
    const result = await db.$transaction(async (tx) => {
      // Deduct balance — only succeeds if balance >= amount
      const updateResult = await tx.user.updateMany({
        where: { id: session.userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });

      if (updateResult.count === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Create withdrawal transaction with structured fields
      const transaction = await tx.walletTransaction.create({
        data: {
          userId: session.userId,
          type: 'withdrawal',
          amount: -amount,
          status: 'pending',
          bankName: bankName || null,
          ifscCode: ifscCode || null,
          accountHolder: bankHolderName || null,
          accountNumber: bankAccountNumber || null,
          upiId: upiId || null,
        },
      });

      // Also save to BankDetail for the user (upsert)
      await tx.bankDetail.upsert({
        where: { userId: session.userId },
        update: {
          accountHolder: bankHolderName || undefined,
          accountNumber: bankAccountNumber || undefined,
          ifscCode: ifscCode || undefined,
          bankName: bankName || undefined,
          upiId: upiId || undefined,
        },
        create: {
          userId: session.userId,
          accountHolder: bankHolderName || null,
          accountNumber: bankAccountNumber || null,
          ifscCode: ifscCode || null,
          bankName: bankName || null,
          upiId: upiId || null,
        },
      });

      return transaction;
    });

    // Send email alert to admin (fire-and-forget, don't block response)
    if (user) {
      sendWithdrawalAlert({
        userName: user.name,
        userMobile: user.mobile,
        amount,
        paymentMethod,
        accountHolder: bankHolderName || null,
        accountNumber: bankAccountNumber || null,
        bankName: bankName || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Withdrawal request submitted. Awaiting approval.',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      );
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create withdrawal request' },
      { status: 500 }
    );
  }
}
