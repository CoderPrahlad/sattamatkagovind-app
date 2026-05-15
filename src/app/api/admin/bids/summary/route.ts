import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json(
        { success: false, error: 'gameId is required' },
        { status: 400 }
      );
    }

    // Verify game exists
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: { id: true, name: true },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin bids summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bids summary' },
      { status: 500 }
    );
  }
}
