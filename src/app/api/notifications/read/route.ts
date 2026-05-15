import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PUT: Mark notifications as read by IDs
export async function PUT(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required' },
        { status: 400 }
      );
    }

    await db.notification.updateMany({
      where: {
        id: { in: ids },
        OR: [
          { userId: session.userId },
          { userId: null },
        ],
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Notifications mark read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
