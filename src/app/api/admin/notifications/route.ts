import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { title, message, type, userId } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        title,
        message,
        type: type || 'info',
        userId: userId || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: notification,
      message: userId ? 'Notification sent to user' : 'Global notification created',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin notification creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
