import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const tickets = await db.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      success: true,
      data: tickets,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin tickets fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
