import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const games = await db.game.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            bids: true,
            results: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: games,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin games fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { name, openTime, closeTime, sortOrder } = body;

    if (!name || !openTime || !closeTime) {
      return NextResponse.json({ success: false, error: 'name, openTime, and closeTime are required' }, { status: 400 });
    }

    const game = await db.game.create({
      data: { name, openTime, closeTime, sortOrder: sortOrder || 0, isOpen: true },
    });

    return NextResponse.json({ success: true, data: game, message: 'Game created successfully' });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json({ success: false, error: authError.message }, { status: authError.statusCode });
    }
    console.error('Admin game create error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create game' }, { status: 500 });
  }
}
