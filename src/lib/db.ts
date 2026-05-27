import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a PrismaClient optimized for Hostinger MySQL (shared hosting).
 * - connection_limit=3: Hostinger shared hosting allows very few simultaneous connections
 * - pool_timeout=20: wait up to 20s for a connection from pool before error
 * - connect_timeout=30: wait up to 30s to establish initial connection
 * - socket_timeout=30: wait up to 30s for query response
 */
function createPrismaClient(): PrismaClient {
  const baseUrl = process.env.DATABASE_URL || '';

  if (!baseUrl) {
    throw new Error('[DB] DATABASE_URL environment variable is not set!');
  }

  // Add MySQL connection pool params if not already present
  let url = baseUrl;
  if (!url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}connection_limit=3&pool_timeout=20&connect_timeout=30&socket_timeout=30`;
  }

  console.log(`[DB] Database URL resolved to: ${url.split('?')[0]}`);

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
  globalForPrisma.prisma ?? createPrismaClient();

if (!globalForPrisma.prisma) {
  setupPrismaLogging(db);
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * MySQL does NOT need PRAGMA initialization (that's SQLite only).
 * This function is kept for compatibility but does nothing for MySQL.
 */
export async function initializeDatabase(): Promise<void> {
  // MySQL: no initialization needed
  // SQLite PRAGMA statements removed — they cause errors on MySQL
  console.log('[DB] MySQL database ready.');
}

/**
 * Execute a Prisma query with retry logic.
 * Retries on connection errors and transaction timeouts.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 300, context = 'DB operation' } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);

      const isRetriableError =
        errorMsg.includes('Can\'t reach database server') ||
        errorMsg.includes('Connection refused') ||
        errorMsg.includes('Unable to start a transaction') ||
        errorMsg.includes('Transaction already closed') ||
        errorMsg.includes('Timed out') ||
        errorMsg.includes('connection pool') ||
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ETIMEDOUT');

      if (isRetriableError && attempt <= maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[${context}] Retrying (${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error(
        `[${context}] Failed after ${attempt} attempt(s):`,
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