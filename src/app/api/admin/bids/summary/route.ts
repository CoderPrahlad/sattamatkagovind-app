import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const GET = apiHandler(async (request) => {
  await requireAdmin(request);
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return apiError('gameId is required');
  }

  // Verify game exists
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true },
  });

  if (!game) {
    return apiError('Game not found', 404);
  }

  // Run all aggregation queries in parallel
  const [
    totalUsersResult,
    totalAmountResult,
    pendingBids,
    wonBids,
    lostBids,
    totalBids,
    totalPayoutResult,
    breakdown,
  ] = await Promise.all([
    // Distinct user count
    db.bid.groupBy({
      by: ['userId'],
      where: { gameId },
    }),

    // Total amount
    db.bid.aggregate({
      where: { gameId },
      _sum: { amount: true },
    }),

    // Pending count
    db.bid.count({ where: { gameId, status: 'pending' } }),

    // Won count
    db.bid.count({ where: { gameId, status: 'won' } }),

    // Lost count
    db.bid.count({ where: { gameId, status: 'lost' } }),

    // Total bids (all statuses)
    db.bid.count({ where: { gameId } }),

    // Total payout
    db.bid.aggregate({
      where: { gameId, status: 'won' },
      _sum: { winAmount: true },
    }),

    // Breakdown by bidType
    db.bid.groupBy({
      by: ['bidType'],
      where: { gameId },
      _count: true,
      _sum: { amount: true, winAmount: true },
    }),
  ]);

  const bidTypeBreakdown = breakdown.map((b) => ({
    bidType: b.bidType,
    count: b._count,
    totalAmount: b._sum.amount || 0,
    totalPayout: b._sum.winAmount || 0,
  }));

  return apiSuccess({
    gameId: game.id,
    gameName: game.name,
    totalUsers: totalUsersResult.length,
    totalAmount: totalAmountResult._sum.amount || 0,
    totalBids,
    pending: pendingBids,
    won: wonBids,
    lost: lostBids,
    totalPayout: totalPayoutResult._sum.winAmount || 0,
    bidTypeBreakdown,
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL, rateLimitSuffix: 'adminBidsSummary' });
