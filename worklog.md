---
Task ID: 1
Agent: Main Agent
Task: Production-ready audit and fix of entire MatkaKing project

Work Log:
- Analyzed 3 user screenshots showing: "Unexpected token '<'" error, 500 Internal Server Errors on login, HTML whitepage errors
- Read all 27 critical project files for comprehensive audit
- Identified root cause: API routes throwing unhandled errors → Next.js returns HTML error page → frontend tries to parse as JSON → crash
- Created 6 new production infrastructure files:
  1. /src/lib/rate-limit.ts - In-memory rate limiting with per-IP tracking
  2. /src/lib/cache.ts - In-memory cache with TTL for high-traffic endpoints
  3. /src/lib/logger.ts - Structured production logging
  4. /src/lib/sanitizer.ts - Input validation and XSS prevention
  5. /src/lib/api-utils.ts - API handler wrapper that ensures JSON responses ALWAYS
  6. /src/lib/fetch.ts - Updated with safeJsonParse to detect HTML responses
- Updated ALL 30+ API route files to use apiHandler wrapper (prevents HTML whitepages)
- Added rate limiting to all auth endpoints (5-10 req/15min for login/register/OTP)
- Added caching to games (15s), config (30s), banners (60s), wallet (30s)
- Added cache invalidation on mutations
- Updated frontend store to use safeJsonParse instead of res.json()
- Added timing-safe comparison for auth token verification
- Added 7 new database indexes for high-concurrency queries
- Updated error.tsx and global-error.tsx with better UX
- Attempted middleware.ts but Next.js 16 causes 404s with middleware file - moved security headers into apiHandler instead
- Updated .env with RESEND_API_KEY and ADMIN_EMAIL
- All API routes now return JSON even on errors - no more HTML whitepages
- Rate limiting working: 429 after threshold with proper JSON error messages
- Structured logging working: [Login], [API], [Games], [Cache] prefixes
- Cache working: "Cache hit" logs visible, reducing DB load

Stage Summary:
- PRIMARY FIX: "Unexpected token '<'" error completely resolved via apiHandler wrapper + safeJsonParse
- All 30+ API routes guaranteed to return JSON, never HTML
- Rate limiting active on all auth endpoints (prevents brute force)
- In-memory caching reduces DB load for read-heavy endpoints
- Input sanitization prevents XSS and injection attacks
- Structured logging for production debugging
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.) on all API responses
- 7 new database indexes for scalability
- Timing-safe token comparison prevents timing attacks
