import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getTodayIST, getTomorrowIST } from '@/lib/time';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const gameId = searchParams.get('gameId');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const targetDate = searchParams.get('targetDate');

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (gameId) where.gameId = gameId;
    if (userId) where.userId = userId;
    if (targetDate) where.targetDate = targetDate;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [bids, summary] = await Promise.all([
      db.bid.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
          game: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.bid.aggregate({
        where,
        _count: true,
        _sum: {
          amount: true,
          winAmount: true,
        },
      }),
    ]);

    const pendingCount = await db.bid.count({ where: { ...where, status: 'pending' } });
    const wonCount = await db.bid.count({ where: { ...where, status: 'won' } });
    const lostCount = await db.bid.count({ where: { ...where, status: 'lost' } });

    // Compute today and tomorrow for next-day badge
    const today = getTodayIST();
    const tomorrow = getTomorrowIST();

    return NextResponse.json({
      success: true,
      data: bids,
      today,
      tomorrow,
      summary: {
        totalBids: summary._count,
        totalAmount: summary._sum.amount || 0,
        pendingBids: pendingCount,
        wonBids: wonCount,
        lostBids: lostCount,
        totalPayout: summary._sum.winAmount || 0,
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
    console.error('Admin bids fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}
