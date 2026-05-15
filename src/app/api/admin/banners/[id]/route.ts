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
    const { title, subtitle, ctaText, ctaLink, imageUrl, isActive } = body;

    const banner = await db.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return NextResponse.json(
        { success: false, error: 'Banner not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle || null;
    if (ctaText !== undefined) updateData.ctaText = ctaText || null;
    if (ctaLink !== undefined) updateData.ctaLink = ctaLink || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const updatedBanner = await db.banner.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedBanner,
      message: 'Banner updated successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin banner update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update banner' },
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

    const banner = await db.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return NextResponse.json(
        { success: false, error: 'Banner not found' },
        { status: 404 }
      );
    }

    await db.banner.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin banner delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete banner' },
      { status: 500 }
    );
  }
}
