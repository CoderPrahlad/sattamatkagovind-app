import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { seedDatabase } from '@/lib/seed';
import { initializeDatabase } from '@/lib/db';
import fs from 'fs';
import path from 'path';

let dbInitialized = false;

/**
 * GET /api/init
 * Auto-initializes database with seed data (admin user, demo user, games, configs)
 * Also sets SQLite pragmas (WAL mode, busy_timeout) for production performance.
 * Called by the client on every page load.
 * Idempotent - safe to call multiple times.
 * No auth required - this must work before any user logs in.
 * 
 * CRITICAL: Also ensures the db directory exists before any DB operations.
 * This fixes the "Error code 14: Unable to open the database file" issue
 * that occurs when deploying to a new VPS/local machine.
 */
export const GET = apiHandler(async () => {
  // Ensure the db directory exists (fixes Error code 14 on fresh deployments)
  if (!dbInitialized) {
    try {
      const dbDir = path.join(process.cwd(), 'db');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`[INIT] Created database directory: ${dbDir}`);
      }
    } catch (err) {
      console.error('[INIT] Failed to create db directory:', err);
    }

    // Initialize SQLite pragmas on first call (WAL mode, busy_timeout, etc.)
    await initializeDatabase();
    dbInitialized = true;
  }

  await seedDatabase();
  // Always return success to avoid leaking db state
  return apiSuccess({ timestamp: new Date().toISOString() });
});
