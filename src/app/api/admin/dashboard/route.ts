import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getTodayIST } from '@/lib/time';
import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  const today = getTodayIST();
  // Build IST date boundaries (IST midnight = UTC 18:30 previous day)
  const todayStart = new Date(today + 'T00:00:00+05:30');
  const todayEnd = new Date(today + 'T23:59:59+05:30');

  // Check cache for dashboard stats
  const cacheKey = `admin:dashboard:${today}`;
  const cached = cacheGet<{ users: { total: number; active: number }; bids: { today: number; pending: number }; revenue: number; payouts: number; profit: number; pendingDeposits: number; pendingWithdrawals: number; recentActivity: unknown[] }>(cacheKey);
  if (cached) {
    logger.debug('AdminDashboard', 'Cache hit');
    return apiSuccess(cached);
  }

  // Run all queries in parallel
  const [
    totalUsers,
    activeUsers,
    bidsToday,
    pendingBids,
    totalRevenue,
    totalPayouts,
    recentBids,
    pendingDeposits,
    pendingWithdrawals,
  ] = await Promise.all([
    // Total users
    db.user.count(),

    // Active users
    db.user.count({ where: { isActive: true } }),

    // Total bids today (using IST date string stored in Bid would be ideal,
    // but bids use createdAt DateTime, so we approximate with IST boundaries)
    db.bid.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),

    // Pending bids
    db.bid.count({ where: { status: 'pending' } }),

    // Total revenue (sum of all bid amounts)
    db.bid.aggregate({
      _sum: { amount: true },
    }),

    // Total payouts (sum of win amounts)
    db.bid.aggregate({
      where: { status: 'won' },
      _sum: { winAmount: true },
    }),

    // Recent activity (last 10 bids)
    db.bid.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true },
        },
        game: {
          select: { id: true, name: true },
        },
      },
    }),

    // Pending deposits count
    db.walletTransaction.count({
      where: { type: 'deposit', status: 'pending' },
    }),

    // Pending withdrawals count
    db.walletTransaction.count({
      where: { type: 'withdrawal', status: 'pending' },
    }),
  ]);

  const data = {
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    bids: {
      today: bidsToday,
      pending: pendingBids,
    },
    revenue: totalRevenue._sum.amount || 0,
    payouts: totalPayouts._sum.winAmount || 0,
    profit: (totalRevenue._sum.amount || 0) - (totalPayouts._sum.winAmount || 0),
    pendingDeposits,
    pendingWithdrawals,
    recentActivity: recentBids,
  };

  // Cache the result
  cacheSet(cacheKey, data, CACHE_TTL.ADMIN_STATS);

  logger.info('AdminDashboard', `Stats fetched by admin ${session.userId}`);
  return apiSuccess(data);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
