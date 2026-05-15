/**
 * In-memory cache with TTL support.
 * Used for frequently accessed data like site config, games list, etc.
 * Reduces database load for read-heavy endpoints.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

// Cache storage
const cache = new Map<string, CacheEntry<unknown>>();

// Cache statistics for monitoring
let hits = 0;
let misses = 0;

// Default TTL values (in milliseconds)
export const CACHE_TTL = {
  CONFIG: 30 * 1000,          // 30 seconds - site config changes rarely
  GAMES: 15 * 1000,           // 15 seconds - games list
  GAME_DETAIL: 10 * 1000,     // 10 seconds - single game
  BANNERS: 60 * 1000,         // 60 seconds - banners change rarely
  USER_SESSION: 30 * 1000,    // 30 seconds - user session data
  ADMIN_STATS: 10 * 1000,     // 10 seconds - admin dashboard stats
  REFERRAL: 30 * 1000,        // 30 seconds - referral data
  BANK_DETAIL: 60 * 1000,     // 60 seconds - bank details
} as const;

/**
 * Get a value from cache.
 * Returns null if not found or expired.
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    misses++;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    misses++;
    return null;
  }

  hits++;
  return entry.value as T;
}

/**
 * Set a value in cache with TTL.
 */
export function cacheSet<T>(key: string, value: T, ttlMs: number = 30_000): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

/**
 * Delete a value from cache.
 */
export function cacheDelete(key: string): boolean {
  return cache.delete(key);
}

/**
 * Delete all cache entries matching a prefix.
 */
export function cacheDeleteByPrefix(prefix: string): number {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Clear all cache entries.
 */
export function cacheClear(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

/**
 * Get cache statistics.
 */
export function cacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = hits + misses;
  return {
    size: cache.size,
    hits,
    misses,
    hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : 'N/A',
  };
}

/**
 * Get or set a cache value (compute-if-absent pattern).
 * If the key exists and is not expired, returns the cached value.
 * If not, calls the factory function, caches the result, and returns it.
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs: number = 30_000
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  cacheSet(key, value, ttlMs);
  return value;
}

// Cleanup expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }
  }, 60 * 1000);
}
