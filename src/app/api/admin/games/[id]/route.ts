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

    const game = await db.game.findUnique({
      where: { id },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Allow updating openTime, closeTime, isOpen, and sortOrder.
    // Only name is locked to prevent accidental renaming.
    const updateData: Record<string, unknown> = {};
    if (body.openTime !== undefined) {
      updateData.openTime = body.openTime;
    }
    if (body.closeTime !== undefined) {
      updateData.closeTime = body.closeTime;
    }
    if (body.isOpen !== undefined) {
      updateData.isOpen = body.isOpen;
    }
    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update.' },
        { status: 400 }
      );
    }

    const updatedGame = await db.game.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedGame,
      message: 'Game updated successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin game update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update game' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await db.game.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Game deleted successfully' });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json({ success: false, error: authError.message }, { status: authError.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete game' }, { status: 500 });
  }
}
