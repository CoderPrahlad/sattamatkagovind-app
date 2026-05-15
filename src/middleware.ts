import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── In-memory rate limiter for API routes ──
// For 10K users, this prevents abuse on auth and financial endpoints

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimits.entries()) {
      if (val.resetAt < now) rateLimits.delete(key);
    }
  }, 60000);
}

// Rate limit configurations per route pattern
const RATE_LIMIT_CONFIGS: { pattern: RegExp; limit: number; windowMs: number }[] = [
  // Auth endpoints — strict limits
  { pattern: /^\/api\/auth\/login/, limit: 10, windowMs: 60000 },          // 10 login attempts per minute
  { pattern: /^\/api\/auth\/register/, limit: 5, windowMs: 60000 },        // 5 registrations per minute
  { pattern: /^\/api\/auth\/send-otp/, limit: 5, windowMs: 60000 },        // 5 OTP requests per minute
  { pattern: /^\/api\/auth\/forgot-password/, limit: 5, windowMs: 60000 }, // 5 reset attempts per minute
  { pattern: /^\/api\/auth\/admin-otp/, limit: 5, windowMs: 60000 },       // 5 admin OTP per minute

  // Financial endpoints — moderate limits
  { pattern: /^\/api\/wallet\/recharge/, limit: 10, windowMs: 60000 },     // 10 recharges per minute
  { pattern: /^\/api\/wallet\/withdraw/, limit: 10, windowMs: 60000 },     // 10 withdrawals per minute
  { pattern: /^\/api\/bids/, limit: 30, windowMs: 60000 },                 // 30 bids per minute

  // Admin endpoints — generous limits
  { pattern: /^\/api\/admin/, limit: 100, windowMs: 60000 },               // 100 admin requests per minute

  // General API — default limit
  { pattern: /^\/api\//, limit: 60, windowMs: 60000 },                     // 60 requests per minute default
];

function getRateLimitConfig(pathname: string): { limit: number; windowMs: number } {
  // Check configs in order — first match wins (more specific patterns first)
  for (const config of RATE_LIMIT_CONFIGS) {
    if (config.pattern.test(pathname)) {
      return { limit: config.limit, windowMs: config.windowMs };
    }
  }
  return { limit: 60, windowMs: 60000 }; // Default: 60/min
}

function getClientId(request: NextRequest): string {
  // Use IP address as client identifier
  // Behind proxy: x-forwarded-for → first IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for GET requests on non-sensitive endpoints
  if (request.method === 'GET' && !pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const config = getRateLimitConfig(pathname);
  const clientId = getClientId(request);
  const key = `${clientId}:${pathname}`;
  const now = Date.now();

  const entry = rateLimits.get(key);
  let count: number;
  let resetAt: number;

  if (!entry || entry.resetAt < now) {
    // New window
    count = 1;
    resetAt = now + config.windowMs;
    rateLimits.set(key, { count, resetAt });
  } else {
    // Existing window — increment
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
