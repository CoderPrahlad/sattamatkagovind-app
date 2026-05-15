import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { userId: session.userId },
          { userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { notificationIds } = body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'notificationIds array is required' },
        { status: 400 }
      );
    }

    await db.notification.updateMany({
      where: {
        id: { in: notificationIds },
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
    console.error('Notifications update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
