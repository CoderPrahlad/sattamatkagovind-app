import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const apkPath = path.join(process.cwd(), 'download', 'MatkaKing-debug.apk');
    const fileBuffer = await fs.readFile(apkPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="MatkaKing-debug.apk"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'APK file not found' },
      { status: 404 }
    );
  }
}
