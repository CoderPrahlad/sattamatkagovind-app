import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeUPI, sanitizeUTR, isValidAmount } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendRechargeAlert } from '@/lib/email';

export const POST = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawAmount = body.amount as number;
  const rawUpiNumber = body.upiNumber as string;
  const rawUtrNumber = body.utrNumber as string | undefined;
  const rawScreenshotUrl = body.screenshotUrl as string | undefined;

  if (!rawAmount || !rawUpiNumber) {
    return apiError('Amount and UPI number are required');
  }

  if (!isValidAmount(rawAmount, 1)) {
    return apiError('Amount must be a positive number');
  }

  // Sanitize inputs
  const upiNumber = sanitizeUPI(rawUpiNumber);
  const utrNumber = rawUtrNumber ? sanitizeUTR(rawUtrNumber) : null;
  const screenshotUrl = rawScreenshotUrl || null;

  // Get minimum deposit amount from config
  const minDepositConfig = await db.gameConfig.findUnique({
    where: { key: 'min_deposit_amount' },
  });
  const minAmount = minDepositConfig ? parseFloat(minDepositConfig.value) : 200;

  // Reject if below minimum amount (don't auto-correct)
  if (rawAmount < minAmount) {
    return apiError(`Minimum deposit amount is ₹${minAmount}`);
  }

  // Check maximum deposit amount
  const maxDepositConfig = await db.gameConfig.findUnique({
    where: { key: 'max_deposit_amount' },
  });
  const maxAmount = maxDepositConfig ? parseFloat(maxDepositConfig.value) : 100000;
  if (rawAmount > maxAmount) {
    return apiError(`Maximum deposit amount is ₹${maxAmount.toLocaleString('en-IN')}`);
  }

  const finalAmount = rawAmount;

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
      utrNumber,
      screenshotUrl,
    },
  });

  // Invalidate wallet cache
  cacheDeleteByPrefix(`wallet:${session.userId}`);

  // Send email alert to admin (fire-and-forget, don't block response)
  if (user) {
    sendRechargeAlert({
      userName: user.name,
      userMobile: user.mobile,
      amount: finalAmount,
      upiNumber,
      utrNumber,
      screenshotUrl,
    }).catch(() => {});
  }

  logger.info('Recharge', 'Deposit request created', { userId: session.userId, amount: finalAmount });

  return apiSuccess(transaction, 'Recharge request submitted. Awaiting approval.');
}, { rateLimit: RATE_LIMITS.RECHARGE, rateLimitSuffix: 'recharge' });
