import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    // Get user info
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        referralCode: true,
        balance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all referral bonus transactions for this user (they are the referrer)
    // These are transactions where adminNote contains "Referral bonus:"
    const referralTransactions = await db.walletTransaction.findMany({
      where: {
        userId: session.userId,
        type: 'deposit',
        status: 'approved',
        adminNote: { contains: 'Referral bonus:' },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total referral earnings
    const totalEarnings = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Count how many users this person has referred (who used their referral code)
    const referredUsersCount = await db.user.count({
      where: {
        referredBy: session.userId,
      },
    });

    // Get the list of referred users (name, mobile, date joined, whether bonus claimed)
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

    // Count pending referrals (users who registered but haven't done first recharge yet)
    const pendingReferrals = referredUsers.filter(u => !u.referralBonusClaimed).length;
    const completedReferrals = referredUsers.filter(u => u.referralBonusClaimed).length;

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings,
        referredUsersCount,
        pendingReferrals,
        completedReferrals,
        referralCode: user.referralCode,
        referralTransactions,
        referredUsers,
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
    console.error('Referral earnings fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referral earnings' },
      { status: 500 }
    );
  }
}
