import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const banners = await db.banner.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: banners,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin banners fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { title, subtitle, ctaText, ctaLink, imageUrl } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const banner = await db.banner.create({
      data: {
        title,
        subtitle: subtitle || null,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        imageUrl: imageUrl || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: banner,
      message: 'Banner created successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin banner creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create banner' },
      { status: 500 }
    );
  }
}
