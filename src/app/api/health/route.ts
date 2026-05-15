import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Simple DB query to verify connection - no stats exposed
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Health check failed:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        database: 'disconnected',
        error: errMsg,
      },
      { status: 503 }
    );
  }
}
