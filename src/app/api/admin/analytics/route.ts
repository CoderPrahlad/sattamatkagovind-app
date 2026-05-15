import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { getTodayIST } from '@/lib/time';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  // Revenue chart: daily for last 7 days using IST dates
  const revenueChart: { date: string; revenue: number; payout: number; profit: number }[] = [];
  const todayIST = getTodayIST();
  const todayDate = new Date(todayIST + 'T00:00:00+05:30');

  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const [revenue, payout] = await Promise.all([
      db.bid.aggregate({
        where: { createdAt: { gte: d, lt: nextD } },
        _sum: { amount: true },
      }),
      db.bid.aggregate({
        where: { createdAt: { gte: d, lt: nextD }, status: 'won' },
        _sum: { winAmount: true },
      }),
    ]);

    const rev = revenue._sum.amount || 0;
    const pay = payout._sum.winAmount || 0;
    revenueChart.push({
      date: dateStr,
      revenue: rev,
      payout: pay,
      profit: rev - pay,
    });
  }

  // Top games by bids
  const topGames = await db.game.findMany({
    include: {
      _count: { select: { bids: true } },
    },
    orderBy: { bids: { _count: 'desc' } },
    take: 10,
  });

  // Top users by spending
  const topUsers = await db.user.findMany({
    orderBy: { balance: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      mobile: true,
      _count: { select: { bids: true } },
    },
  });

  // Bid type distribution
  const [singleCount, jodiCount] = await Promise.all([
    db.bid.count({ where: { bidType: 'single' } }),
    db.bid.count({ where: { bidType: 'jodi' } }),
  ]);

  logger.info('AdminAnalytics', `Analytics fetched by admin ${session.userId}`);
  return apiSuccess({
    revenueChart,
    topGames: topGames.map(g => ({
      id: g.id,
      name: g.name,
      bidCount: g._count.bids,
    })),
    topUsers: topUsers.map(u => ({
      id: u.id,
      name: u.name,
      mobile: u.mobile,
      bidCount: u._count.bids,
    })),
    bidTypeDistribution: {
      single: singleCount,
      jodi: jodiCount,
      total: singleCount + jodiCount,
    },
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
