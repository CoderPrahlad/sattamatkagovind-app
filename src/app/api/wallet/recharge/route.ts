import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendRechargeAlert } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { amount, upiNumber, utrNumber, screenshotUrl } = body;

    if (!amount || !upiNumber) {
      return NextResponse.json(
        { success: false, error: 'Amount and UPI number are required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Get minimum deposit amount from config
    const minDepositConfig = await db.gameConfig.findUnique({
      where: { key: 'min_deposit_amount' },
    });
    const minAmount = minDepositConfig ? parseFloat(minDepositConfig.value) : 200;

    // Reject if below minimum amount (don't auto-correct)
    if (amount < minAmount) {
      return NextResponse.json(
        { success: false, error: `Minimum deposit amount is ₹${minAmount}` },
        { status: 400 }
      );
    }

    // Check maximum deposit amount
    const maxDepositConfig = await db.gameConfig.findUnique({
      where: { key: 'max_deposit_amount' },
    });
    const maxAmount = maxDepositConfig ? parseFloat(maxDepositConfig.value) : 100000;
    if (amount > maxAmount) {
      return NextResponse.json(
        { success: false, error: `Maximum deposit amount is ₹${maxAmount.toLocaleString('en-IN')}` },
        { status: 400 }
      );
    }

    const finalAmount = amount;

    // Get user info for email alert
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, mobile: true },
    });

    const transaction = await db.walletTransaction.create({
      data: {
        userId: session.userId,
        type: 'deposit',
        amount: finalAmount,
        status: 'pending',
        upiNumber,
        utrNumber: utrNumber || null,
        screenshotUrl: screenshotUrl || null,
      },
    });

    // Send email alert to admin (fire-and-forget, don't block response)
    if (user) {
      sendRechargeAlert({
        userName: user.name,
        userMobile: user.mobile,
        amount: finalAmount,
        upiNumber,
        utrNumber: utrNumber || null,
        screenshotUrl: screenshotUrl || null,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      message: 'Recharge request submitted. Awaiting approval.',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Recharge error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create recharge request' },
      { status: 500 }
    );
  }
}
