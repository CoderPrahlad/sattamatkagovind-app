import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, createAuthToken, verifyAuthToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    const decoded = verifyAuthToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        mobile: true,
        role: true,
        balance: true,
        winningAmount: true,
        referralCode: true,
        referredBy: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Only refresh token if it's >75% expired (saves CPU under 10K users)
    const tokenAge = Date.now() - decoded.issuedAt;
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    let newToken: string | undefined;
    if (tokenAge > maxAge * 0.75) {
      newToken = createAuthToken(user.id, user.role);
    }

    return NextResponse.json({
      success: true,
      data: { ...user, token: newToken || token },
    });
  } catch (error: unknown) {
    console.error('Session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
