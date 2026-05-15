import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { initializeDatabase } from '@/lib/db';

let dbInitialized = false;

/**
 * GET /api/init
 * Auto-initializes database with seed data (admin user, demo user, games, configs)
 * Also sets SQLite pragmas (WAL mode, busy_timeout) for production performance.
 * Called by the client on every page load.
 * Idempotent - safe to call multiple times. Has a 30-second cooldown.
 * No auth required - this must work before any user logs in.
 */
export async function GET() {
  try {
    // Initialize SQLite pragmas on first call (WAL mode, busy_timeout, etc.)
    if (!dbInitialized) {
      await initializeDatabase();
      dbInitialized = true;
    }

    await seedDatabase();
    // Always return success to avoid leaking db state
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[INIT ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Database initialization check failed' },
      { status: 500 }
    );
  }
}
