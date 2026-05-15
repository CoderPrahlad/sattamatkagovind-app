import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbConnecting: Promise<void> | undefined
  dbInitialized: boolean | undefined
}

/**
 * Create a PrismaClient with robust connection handling:
 * - SQLite WAL mode for concurrent reads
 * - busy_timeout for write contention
 * - Connection pool settings
 * - Query timeout to prevent hanging requests
 * - Error logging in all environments
 */
function createPrismaClient(): PrismaClient {
  // Add SQLite pragmas to DATABASE_URL for better concurrency
  let url = process.env.DATABASE_URL || '';
  if (url.startsWith('file:') && !url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}connection_limit=10&busy_timeout=10000`;
  }

  return new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
    datasources: {
      db: { url },
    },
  });
}

// Log Prisma events for debugging
function setupPrismaLogging(client: PrismaClient) {
  if (typeof client.on === 'function') {
    client.on('error' as any, (e: any) => {
      console.error('[PRISMA ERROR]', e.message);
    });
    client.on('warn' as any, (e: any) => {
      console.warn('[PRISMA WARN]', e.message);
    });
  }
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient();

// Setup logging for the newly created client
if (!globalForPrisma.prisma) {
  setupPrismaLogging(db);
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * Initialize SQLite pragmas for optimal performance under load.
 * MUST be called once on server startup.
 * - WAL mode: allows concurrent reads while writing
 * - busy_timeout: retries writes instead of immediate SQLITE_BUSY error
 * - synchronous=NORMAL: safe with WAL, much faster writes
 * - cache_size: larger cache for 10K users
 * - temp_store: memory-based temp tables
 */
export async function initializeDatabase(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;

  try {
    // Use $queryRawUnsafe for PRAGMA statements since SQLite returns results
    await db.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await db.$queryRawUnsafe('PRAGMA busy_timeout=10000');
    await db.$queryRawUnsafe('PRAGMA synchronous=NORMAL');
    await db.$queryRawUnsafe('PRAGMA cache_size=-64000'); // 64MB cache
    await db.$queryRawUnsafe('PRAGMA temp_store=MEMORY');
    await db.$queryRawUnsafe('PRAGMA mmap_size=268435456'); // 256MB mmap
    console.log('[DB] SQLite pragmas initialized: WAL mode, busy_timeout=10s, synchronous=NORMAL');
    globalForPrisma.dbInitialized = true;
  } catch (error) {
    console.error('[DB] Failed to initialize SQLite pragmas:', error);
    // Don't throw - app can still work, just slower
    globalForPrisma.dbInitialized = true; // Mark as initialized even on error to prevent retries
  }
}

/**
 * Execute a Prisma query with retry logic.
 * Retries on connection errors and SQLITE_BUSY up to maxRetries times with exponential backoff.
 *
 * @example
 * ```ts
 * const user = await withRetry(() => db.user.findUnique({ where: { mobile } }));
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 200, context = 'DB operation' } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRetriableError =
        errorMsg.includes('SQLITE_BUSY') ||
        errorMsg.includes('database is locked') ||
        errorMsg.includes('unable to open database file') ||
        errorMsg.includes('disk I/O error') ||
        errorMsg.includes('CONNECTION') ||
        errorMsg.includes('Timed out') ||
        errorMsg.includes('Transaction already closed');

      if (isRetriableError && attempt <= maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[${context}] Retrying (${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retriable error or retries exhausted
      console.error(`[${context}] Failed after ${attempt} attempt(s):`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  throw lastError;
}

/**
 * Verify database is accessible by running a lightweight query.
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
