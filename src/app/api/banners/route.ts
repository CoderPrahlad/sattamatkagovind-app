import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const banners = await db.banner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: banners,
    });
  } catch (error: unknown) {
    console.error('Banners fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}
