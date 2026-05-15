import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Prevent path traversal attacks
    const safeSegments = pathSegments.filter(
      (seg) => seg !== '..' && seg !== '.' && !seg.includes('..')
    );

    if (safeSegments.length === 0) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Sanitize segments - only allow alphanumeric, dash, underscore, dot
    const sanitizedSegments = safeSegments.map((seg) =>
      seg.replace(/[^a-zA-Z0-9._-]/g, '')
    );

    const relativePath = sanitizedSegments.join('/');
    const filePath = path.join(
      process.cwd(),
      'public',
      'uploads',
      relativePath
    );

    // Verify the resolved path is still within uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check file exists
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
