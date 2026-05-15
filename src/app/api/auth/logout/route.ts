import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const POST = apiHandler(async () => {
  // Token-based auth: the client handles logout by clearing localStorage.
  // Server-side token remains valid until 2-hour expiry (stateless design).
  // This endpoint exists for the client to have a successful logout handshake.
  return apiSuccess(null, 'Logged out successfully');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'logout' });
