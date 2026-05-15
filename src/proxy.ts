import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── In-memory rate limiter for API routes ──
// For 10K users, this prevents abuse on auth and financial endpoints
// Lazy cleanup happens when map grows too large

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Lazy cleanup: remove expired entries when map grows too large
const MAX_RATE_LIMIT_ENTRIES = 10000;
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, val] of rateLimits.entries()) {
    if (val.resetAt < now) rateLimits.delete(key);
  }
}

// Rate limit configurations per route pattern
const RATE_LIMIT_CONFIGS: { pattern: RegExp; limit: number; windowMs: number }[] = [
  // Auth endpoints — strict limits
  { pattern: /^\/api\/auth\/login/, limit: 10, windowMs: 60000 },
  { pattern: /^\/api\/auth\/register/, limit: 5, windowMs: 60000 },
  { pattern: /^\/api\/auth\/send-otp/, limit: 5, windowMs: 60000 },
  { pattern: /^\/api\/auth\/forgot-password/, limit: 5, windowMs: 60000 },
  { pattern: /^\/api\/auth\/admin-otp/, limit: 5, windowMs: 60000 },

  // Financial endpoints — moderate limits
  { pattern: /^\/api\/wallet\/recharge/, limit: 10, windowMs: 60000 },
  { pattern: /^\/api\/wallet\/withdraw/, limit: 10, windowMs: 60000 },
  { pattern: /^\/api\/bids/, limit: 30, windowMs: 60000 },

  // Admin endpoints — generous limits
  { pattern: /^\/api\/admin/, limit: 100, windowMs: 60000 },

  // General API — default limit
  { pattern: /^\/api\//, limit: 60, windowMs: 60000 },
];

function getRateLimitConfig(pathname: string): { limit: number; windowMs: number } {
  for (const config of RATE_LIMIT_CONFIGS) {
    if (config.pattern.test(pathname)) {
      return { limit: config.limit, windowMs: config.windowMs };
    }
  }
  return { limit: 60, windowMs: 60000 };
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for GET requests on non-sensitive endpoints
  if (request.method === 'GET' && !pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Skip for health check and init
  if (pathname === '/api/health' || pathname === '/api/init') {
    return NextResponse.next();
  }

  // Lazy cleanup when map gets too large
  if (rateLimits.size > MAX_RATE_LIMIT_ENTRIES) {
    cleanupExpiredEntries();
  }

  const config = getRateLimitConfig(pathname);
  const clientId = getClientId(request);
  const key = `${clientId}:${pathname}`;
  const now = Date.now();

  const entry = rateLimits.get(key);
  let count: number;
  let resetAt: number;

  if (!entry || entry.resetAt < now) {
    count = 1;
    resetAt = now + config.windowMs;
    rateLimits.set(key, { count, resetAt });
  } else {
    count = entry.count + 1;
    resetAt = entry.resetAt;
    entry.count = count;
  }

  // Check if rate limit exceeded
  if (count > config.limit) {
    const retryAfter = Math.ceil((resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        },
      }
    );
  }

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(config.limit));
  response.headers.set('X-RateLimit-Remaining', String(config.limit - count));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
