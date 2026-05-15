/**
 * Production-grade API utilities.
 * Ensures ALL API routes return proper JSON responses — NEVER HTML.
 * This is the PRIMARY fix for the "Unexpected token '<'" whitepage error.
 * Also adds security headers, CORS support, and request tracing.
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';
import { rateLimitResponse, RATE_LIMITS } from './rate-limit';
import type { RateLimitConfig } from './rate-limit';

// Security headers added to all API responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Standard API response structure.
 * Every response follows this format for consistency.
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  retryAfter?: number; // For rate-limited responses
}

/**
 * Create a success JSON response.
 */
export function apiSuccess<T>(data: T, message?: string, status: number = 200): NextResponse {
  const response: ApiResponse<T> = { success: true, data, ...(message && { message }) };
  return NextResponse.json(response, { status });
}

/**
 * Create an error JSON response.
 * This is CRITICAL - ensures errors are always JSON, never HTML.
 */
export function apiError(error: string, status: number = 400, retryAfter?: number): NextResponse {
  const response: ApiResponse = { 
    success: false, 
    error,
    ...(retryAfter && { retryAfter }),
  };
  return NextResponse.json(response, { status });
}

/**
 * Rate limit error response.
 */
export function rateLimitError(retryAfterMs: number): NextResponse {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { 
      success: false, 
      error: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
      retryAfter: retryAfterSec,
    },
    { 
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  );
}

/**
 * Safely parse JSON body from request.
 * Returns parsed body or null with an error response.
 */
export async function parseJsonBody(request: Request): Promise<{ data: Record<string, unknown> | null; error: NextResponse | null }> {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      return { data: null, error: apiError('Request body is empty', 400) };
    }
    const data = JSON.parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { data: null, error: apiError('Request body must be a JSON object', 400) };
    }
    return { data, error: null };
  } catch {
    return { data: null, error: apiError('Invalid JSON in request body', 400) };
  }
}

/**
 * Check rate limit and return error response if limited.
 * Returns null if the request is allowed.
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
  suffix?: string
): NextResponse | null {
  const result = rateLimitResponse(request, config, suffix);
  if (result.limited) {
    return rateLimitError(result.retryAfterMs);
  }
  return null;
}

/**
 * Wrap an API route handler with production-grade error handling.
 * This is the SINGLE MOST IMPORTANT function for preventing HTML whitepages.
 * 
 * Usage:
 * ```ts
 * export const POST = apiHandler(async (request) => {
 *   // ... your route logic
 *   return apiSuccess({ data });
 * }, { rateLimit: RATE_LIMITS.LOGIN });
 * ```
 */
export function apiHandler(
  handler: (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
  options?: {
    rateLimit?: RateLimitConfig;
    rateLimitSuffix?: string;
    methods?: string[];
  }
): (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (request: Request, context?: { params: Promise<Record<string, string>> }) => {
    const startTime = Date.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Check HTTP method
      if (options?.methods && !options.methods.includes(method)) {
        return apiError(`Method ${method} not allowed`, 405);
      }

      // Check rate limit
      if (options?.rateLimit) {
        const rateLimitResult = checkRateLimit(request, options.rateLimit, options.rateLimitSuffix);
        if (rateLimitResult) {
          logger.warn('RateLimit', `${method} ${path} rate limited`);
          return rateLimitResult;
        }
      }

      // Execute handler
      const result = await handler(request, context);

      // Add security headers to all API responses
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        result.headers.set(key, value);
      }

      // Add CORS headers if origin is present
      const origin = request.headers.get('origin');
      if (origin) {
        result.headers.set('Access-Control-Allow-Origin', origin);
        result.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        result.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
        result.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      // Log the request
      const duration = Date.now() - startTime;
      logger.apiRequest(method, path, result.status, duration);

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      // AuthError handling
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const authError = error as { statusCode: number; message: string };
        logger.warn('AuthError', `${method} ${path} → ${authError.statusCode}`, { message: authError.message });
        return apiError(authError.message, authError.statusCode);
      }

      // Generic error - ALWAYS return JSON, NEVER let Next.js render HTML
      logger.error('API', `${method} ${path} UNHANDLED ERROR (${duration}ms)`, error);
      
      // In production, don't leak error details
      const message = process.env.NODE_ENV === 'production'
        ? 'An internal error occurred. Please try again.'
        : (error instanceof Error ? error.message : 'Unknown error');

      return apiError(message, 500);
    }
  };
}

/**
 * Convenience: Create a rate-limited route handler.
 * Combines common auth + rate limiting + error handling.
 */
export function withRateLimit(
  handler: (request: Request) => Promise<NextResponse>,
  config: RateLimitConfig,
  suffix?: string
): (request: Request) => Promise<NextResponse> {
  return apiHandler(handler, { rateLimit: config, rateLimitSuffix: suffix });
}
