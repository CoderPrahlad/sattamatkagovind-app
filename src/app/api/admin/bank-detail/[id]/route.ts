import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET: Admin views any user's bank detail by user ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const bankDetail = await db.bankDetail.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        },
      },
    });

    if (!bankDetail) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No bank detail found for this user',
      });
    }

    return NextResponse.json({
      success: true,
      data: bankDetail,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin bank detail fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bank detail' },
      { status: 500 }
    );
  }
}
