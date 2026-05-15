import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAdmin } from '@/lib/auth';

// Allowed image MIME types
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed categories (subdirectories)
const ALLOWED_CATEGORIES = ['qr', 'screenshots', 'banners', 'general'];

export async function POST(request: Request) {
  try {
    // Verify admin access
    await requireAdmin(request);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'general';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only images are allowed (PNG, JPG, GIF, WebP, SVG).' },
        { status: 400 }
      );
    }

    // Validate category
    const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'general';

    // Generate unique filename
    const ext = ALLOWED_TYPES[file.type];
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}_${randomSuffix}${ext}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeCategory);
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk
    const filePath = path.join(uploadDir, filename);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    // Return the URL path
    const url = `/uploads/${safeCategory}/${filename}`;

    console.log(`[Upload] File saved: ${url} (${file.size} bytes)`);

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error: unknown) {
    // Handle auth errors
    if (error instanceof Error && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }

    console.error('File upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}
