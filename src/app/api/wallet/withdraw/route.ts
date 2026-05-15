import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeUPI, sanitizeAccountNumber, sanitizeText, isValidAmount } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendWithdrawalAlert } from '@/lib/email';

export const POST = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawAmount = body.amount as number;
  const rawBankHolderName = body.bankHolderName as string | undefined;
  const rawBankAccountNumber = body.bankAccountNumber as string | undefined;
  const rawIfscCode = body.ifscCode as string | undefined;
  const rawBankName = body.bankName as string | undefined;
  const rawUpiId = body.upiId as string | undefined;
  const rawPaymentMethod = body.paymentMethod as string;

  if (!rawAmount || !rawPaymentMethod) {
    return apiError('Amount and payment method are required');
  }

  if (rawPaymentMethod !== 'bank' && rawPaymentMethod !== 'upi') {
    return apiError('Payment method must be "bank" or "upi"');
  }

  // Validate required fields per payment method
  if (rawPaymentMethod === 'bank') {
    if (!rawBankHolderName || !rawBankAccountNumber || !rawIfscCode || !rawBankName) {
      return apiError('Bank holder name, account number, IFSC code, and bank name are required for bank transfer');
    }
  }

  if (rawPaymentMethod === 'upi') {
    if (!rawUpiId) {
      return apiError('UPI ID is required for UPI transfer');
    }
  }

  if (!isValidAmount(rawAmount, 1)) {
    return apiError('Amount must be a positive number');
  }

  // Sanitize inputs
  const bankHolderName = rawBankHolderName ? sanitizeText(rawBankHolderName, 100) : null;
  const bankAccountNumber = rawBankAccountNumber ? sanitizeAccountNumber(rawBankAccountNumber) : null;
  const ifscCode = rawIfscCode ? sanitizeText(rawIfscCode, 20) : null;
  const bankName = rawBankName ? sanitizeText(rawBankName, 100) : null;
  const upiId = rawUpiId ? sanitizeUPI(rawUpiId) : null;

  // Get minimum withdrawal from config
  const minWithdrawConfig = await db.gameConfig.findUnique({
    where: { key: 'min_withdraw_amount' },
  });
  const minAmount = minWithdrawConfig ? parseFloat(minWithdrawConfig.value) : 500;

  if (rawAmount < minAmount) {
    return apiError(`Minimum withdrawal amount is ₹${minAmount}`);
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
      where: { id: session.userId, balance: { gte: rawAmount } },
      data: { balance: { decrement: rawAmount } },
    });

    if (updateResult.count === 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // Create withdrawal transaction with structured fields
    const transaction = await tx.walletTransaction.create({
      data: {
        userId: session.userId,
        type: 'withdrawal',
        amount: -rawAmount,
        status: 'pending',
        bankName,
        ifscCode,
        accountHolder: bankHolderName,
        accountNumber: bankAccountNumber,
        upiId,
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
        accountHolder: bankHolderName,
        accountNumber: bankAccountNumber,
        ifscCode,
        bankName,
        upiId,
      },
    });

    return transaction;
  });

  // Invalidate wallet cache
  cacheDeleteByPrefix(`wallet:${session.userId}`);

  // Send email alert to admin (fire-and-forget, don't block response)
  if (user) {
    sendWithdrawalAlert({
      userName: user.name,
      userMobile: user.mobile,
      amount: rawAmount,
      paymentMethod: rawPaymentMethod,
      accountHolder: bankHolderName,
      accountNumber: bankAccountNumber,
      bankName,
      ifscCode,
      upiId,
    }).catch(() => {});
  }

  logger.info('Withdraw', 'Withdrawal request created', { userId: session.userId, amount: rawAmount, method: rawPaymentMethod });

  return apiSuccess(result, 'Withdrawal request submitted. Awaiting approval.');
}, { rateLimit: RATE_LIMITS.WITHDRAW, rateLimitSuffix: 'withdraw' });
