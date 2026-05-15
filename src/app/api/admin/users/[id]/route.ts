import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const { isActive, balance, balanceAdjustment } = body;

    const user = await db.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (typeof balance === 'number') updateData.balance = balance;
    if (typeof balanceAdjustment === 'number') {
      const newBalance = user.balance + balanceAdjustment;
      updateData.balance = Math.max(0, newBalance);
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        mobile: true,
        role: true,
        balance: true,
        winningAmount: true,
        referralCode: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin user update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
