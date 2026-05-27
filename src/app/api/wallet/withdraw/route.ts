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

  const minWithdrawConfig = await db.gameConfig.findUnique({
    where: { key: 'min_withdraw_amount' },
  });
  const minAmount = minWithdrawConfig ? parseFloat(minWithdrawConfig.value) : 500;

  if (rawAmount < minAmount) {
    return apiError(`Minimum withdrawal amount is ₹${minAmount}`);
  }

  const bankHolderName = rawBankHolderName ? sanitizeText(rawBankHolderName, 100) : null;
  const bankAccountNumber = rawBankAccountNumber ? sanitizeAccountNumber(rawBankAccountNumber) : null;
  const ifscCode = rawIfscCode ? sanitizeText(rawIfscCode, 20) : null;
  const bankName = rawBankName ? sanitizeText(rawBankName, 100) : null;
  const upiId = rawUpiId ? sanitizeUPI(rawUpiId) : null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, mobile: true, winningAmount: true },
  });

  if (!user) return apiError('User not found', 404);

  // ✅ Only winning amount can be withdrawn
  if (user.winningAmount < rawAmount) {
    return apiError(
      `Insufficient winning balance. Your winning balance is ₹${user.winningAmount.toFixed(2)}. Only winning amount can be withdrawn.`
    );
  }

  const result = await db.$transaction(async (tx) => {
    // ✅ Deduct IMMEDIATELY from winningAmount + balance when request is placed
    // This prevents double withdrawal requests
    const updateResult = await tx.user.updateMany({
      where: { id: session.userId, winningAmount: { gte: rawAmount } },
      data: {
        winningAmount: { decrement: rawAmount },
        balance: { decrement: rawAmount },
      },
    });

    if (updateResult.count === 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

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

  cacheDeleteByPrefix(`wallet:${session.userId}`);

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

  logger.info('Withdraw', 'Withdrawal request created, balance deducted immediately', {
    userId: session.userId, amount: rawAmount, method: rawPaymentMethod
  });

  return apiSuccess(result, 'Withdrawal request submitted. Amount has been deducted from your winning balance. Awaiting approval.');
}, { rateLimit: RATE_LIMITS.WITHDRAW, rateLimitSuffix: 'withdraw' });