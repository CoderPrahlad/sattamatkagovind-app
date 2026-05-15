/**
 * In-memory rate limiter for API routes.
 * Supports per-IP and per-user rate limiting.
 * Uses sliding window algorithm.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  maxRequests: number;
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 10 },         // 10 per 15 min
  REGISTER: { windowMs: 60 * 60 * 1000, maxRequests: 5 },       // 5 per hour
  SEND_OTP: { windowMs: 15 * 60 * 1000, maxRequests: 5 },       // 5 per 15 min
  VERIFY_OTP: { windowMs: 15 * 60 * 1000, maxRequests: 10 },    // 10 per 15 min
  FORGOT_PASSWORD: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
  ADMIN_OTP: { windowMs: 15 * 60 * 1000, maxRequests: 5 },      // 5 per 15 min

  // Transaction endpoints - moderate limits
  BID: { windowMs: 60 * 1000, maxRequests: 30 },                // 30 per minute
  RECHARGE: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10 per hour
  WITHDRAW: { windowMs: 60 * 60 * 1000, maxRequests: 5 },       // 5 per hour

  // General API - relaxed limits
  GENERAL: { windowMs: 60 * 1000, maxRequests: 60 },             // 60 per minute
  ADMIN_GENERAL: { windowMs: 60 * 1000, maxRequests: 120 },      // 120 per minute
} as const;

// In-memory store
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Check if a request should be rate limited.
 * Returns { allowed: boolean, retryAfterMs: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs: number; remaining: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  // No entry or expired window - allow and create new entry
  if (!entry || now > entry.resetTime) {
    store.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - 1 };
  }

  // Within window - check count
  if (entry.count >= config.maxRequests) {
    const retryAfterMs = entry.resetTime - now;
    return { allowed: false, retryAfterMs, remaining: 0 };
  }

  // Increment count
  entry.count++;
  return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - entry.count };
}

/**
 * Get client identifier from request.
 * Uses X-Forwarded-For header (from proxy) or falls back to connection info.
 */
export function getClientIdentifier(request: Request, suffix?: string): string {
  // Check X-Forwarded-For (set by reverse proxy like Caddy/Nginx)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    return suffix ? `${ip}:${suffix}` : ip;
  }

  // Check X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return suffix ? `${realIp}:${suffix}` : realIp;
  }

  // Fallback - use user-agent hash as a rough identifier
  const ua = request.headers.get('user-agent') || 'unknown';
  return suffix ? `ua:${hashString(ua)}:${suffix}` : `ua:${hashString(ua)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Rate limit check for API route handlers.
 * Returns a NextResponse-like error if rate limited, null if allowed.
 */
export function rateLimitResponse(
  request: Request,
  config: RateLimitConfig,
  identifierSuffix?: string
): { limited: boolean; retryAfterMs: number; remaining: number } {
  const identifier = getClientIdentifier(request, identifierSuffix);
  const result = checkRateLimit(identifier, config);
  return {
    limited: !result.allowed,
    retryAfterMs: result.retryAfterMs,
    remaining: result.remaining,
  };
}
