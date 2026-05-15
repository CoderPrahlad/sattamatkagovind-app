import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        balance: true,
        winningAmount: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const transactions = await db.walletTransaction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: user.balance,
        winningAmount: user.winningAmount,
        transactions,
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
    console.error('Wallet fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}
