import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      referralCode: true,
      balance: true,
      winningAmount: true,
    },
  });

  if (!user) {
    return apiError('User not found', 404);
  }

  // FIX: 'Referral bonus:' → 'Referral' (matches both "Referral bonus:" and "Referral commission:")
  const referralTransactions = await db.walletTransaction.findMany({
    where: {
      userId: session.userId,
      type: 'deposit',
      status: 'approved',
      adminNote: { contains: 'Referral' },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarnings = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const referredUsers = await db.user.findMany({
    where: {
      referredBy: session.userId,
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      referralBonusClaimed: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const referredUsersCount = referredUsers.length;
  const pendingReferrals = referredUsers.filter(u => !u.referralBonusClaimed).length;
  const completedReferrals = referredUsers.filter(u => u.referralBonusClaimed).length;

  logger.info('ReferralEarnings', `Fetched for user ${session.userId}. Earnings: ₹${totalEarnings}, Referred: ${referredUsersCount}`);
  return apiSuccess({
    totalEarnings,
    referredUsersCount,
    pendingReferrals,
    completedReferrals,
    referralCode: user.referralCode,
    referralTransactions,
    referredUsers,
  });
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'referralEarnings' });