import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Get all users who have referred at least one person
    const referrers = await db.user.findMany({
      where: {
        // Users who have at least one referred user
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
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get referral bonus transactions for all referrers
    const referrerIds = referrers.map((r) => r.id);

    const referralTransactions = await db.walletTransaction.findMany({
      where: {
        userId: { in: referrerIds },
        type: 'deposit',
        status: 'approved',
        adminNote: { contains: 'Referral bonus:' },
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

    // Group referral transactions by userId
    const txByUser = new Map<string, typeof referralTransactions>();
    for (const tx of referralTransactions) {
      if (!txByUser.has(tx.userId)) txByUser.set(tx.userId, []);
      txByUser.get(tx.userId)!.push(tx);
    }

    // Build response with computed stats
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

    // Overall stats
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
        adminNote: { contains: 'Referral bonus:' },
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

    return NextResponse.json({
      success: true,
      data,
      stats: {
        totalReferrers,
        totalReferredUsers,
        totalBonusClaimed,
        totalBonusPending,
        totalBonusPaid: totalReferralBonuses._sum.amount || 0,
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
    console.error('Admin referrals fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}
