import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET: Return current user's bank detail
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    const bankDetail = await db.bankDetail.findUnique({
      where: { userId: session.userId },
    });

    return NextResponse.json({
      success: true,
      data: bankDetail || {},
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Bank detail fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank detail' },
      { status: 500 }
    );
  }
}

// PUT: Upsert bank detail for authenticated user
export async function PUT(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = body;

    const bankDetail = await db.bankDetail.upsert({
      where: { userId: session.userId },
      update: {
        accountHolder: accountHolder || undefined,
        accountNumber: accountNumber || undefined,
        ifscCode: ifscCode || undefined,
        bankName: bankName || undefined,
        upiId: upiId || undefined,
      },
      create: {
        userId: session.userId,
        accountHolder: accountHolder || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        bankName: bankName || null,
        upiId: upiId || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: bankDetail,
      message: 'Bank detail saved successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Bank detail update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bank detail' },
      { status: 500 }
    );
  }
}
