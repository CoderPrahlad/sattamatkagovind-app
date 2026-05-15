import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getTodayIST } from '@/lib/time';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const today = getTodayIST();
    // Build IST date boundaries (IST midnight = UTC 18:30 previous day)
    const todayStart = new Date(today + 'T00:00:00+05:30');
    const todayEnd = new Date(today + 'T23:59:59+05:30');

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

    return NextResponse.json({
      success: true,
      data: {
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
    console.error('Admin dashboard fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
