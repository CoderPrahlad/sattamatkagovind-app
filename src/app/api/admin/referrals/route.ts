import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizePagination, sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  const url = new URL(request.url);
  const search = sanitizeText(url.searchParams.get('search') || '');
  const { page, limit, skip } = sanitizePagination(
    Number(url.searchParams.get('page')) || undefined,
    Number(url.searchParams.get('limit')) || undefined
  );

  const referrers = await db.user.findMany({
    where: {
      referredUsers: {
        some: {},
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { mobile: { contains: search } },
              { referralCode: { contains: search.toUpperCase() } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      referralCode: true,
      isActive: true,
      balance: true,
      createdAt: true,
      referredUsers: {
        select: {
          id: true,
          name: true,
          mobile: true,
          referralBonusClaimed: true,
          createdAt: true,
          balance: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const referrerIds = referrers.map((r) => r.id);

  const referralTransactions = await db.walletTransaction.findMany({
    where: {
      userId: { in: referrerIds },
      type: 'deposit',
      status: 'approved',
      adminNote: { contains: 'Referral' },
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      adminNote: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const txByUser = new Map<string, typeof referralTransactions>();
  for (const tx of referralTransactions) {
    if (!txByUser.has(tx.userId)) txByUser.set(tx.userId, []);
    txByUser.get(tx.userId)!.push(tx);
  }

  const data = referrers.map((referrer) => {
    const referredUsers = referrer.referredUsers;
    const completedReferrals = referredUsers.filter(
      (u) => u.referralBonusClaimed
    ).length;
    const pendingReferrals = referredUsers.filter(
      (u) => !u.referralBonusClaimed
    ).length;
    const totalBonusEarned = (txByUser.get(referrer.id) || []).reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    return {
      id: referrer.id,
      name: referrer.name,
      mobile: referrer.mobile,
      referralCode: referrer.referralCode,
      isActive: referrer.isActive,
      balance: referrer.balance,
      createdAt: referrer.createdAt,
      totalReferred: referredUsers.length,
      completedReferrals,
      pendingReferrals,
      totalBonusEarned,
      bonusTransactions: txByUser.get(referrer.id) || [],
      referredUsers: referredUsers.map((u) => ({
        id: u.id,
        name: u.name,
        mobile: u.mobile,
        referralBonusClaimed: u.referralBonusClaimed,
        balance: u.balance,
        createdAt: u.createdAt,
      })),
    };
  });

  const totalReferrers = await db.user.count({
    where: {
      referredUsers: { some: {} },
    },
  });

  const totalReferralBonuses = await db.walletTransaction.aggregate({
    _sum: { amount: true },
    where: {
      type: 'deposit',
      status: 'approved',
      adminNote: { contains: 'Referral' },
    },
  });

  const totalReferredUsers = await db.user.count({
    where: { referredBy: { not: null } },
  });

  const totalBonusClaimed = await db.user.count({
    where: {
      referredBy: { not: null },
      referralBonusClaimed: true,
    },
  });

  const totalBonusPending = await db.user.count({
    where: {
      referredBy: { not: null },
      referralBonusClaimed: false,
    },
  });

  logger.info('AdminReferrals', `Referrals fetched by admin ${session.userId}`);
  return apiSuccess({
    data,
    stats: {
      totalReferrers,
      totalReferredUsers,
      totalBonusClaimed,
      totalBonusPending,
      totalBonusPaid: totalReferralBonuses._sum.amount || 0,
    },
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });