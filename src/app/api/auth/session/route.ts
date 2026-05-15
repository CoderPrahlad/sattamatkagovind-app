import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { createAuthToken, verifyAuthToken } from '@/lib/auth';

export const GET = apiHandler(async (request) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return apiError('Not authenticated', 401);
  }

  const user = await db.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      balance: true,
      winningAmount: true,
      referralCode: true,
      referredBy: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    return apiError('Not authenticated', 401);
  }

  // Only refresh token if it's >75% expired (saves CPU under 10K users)
  const tokenAge = Date.now() - decoded.issuedAt;
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours
  let newToken: string | undefined;
  if (tokenAge > maxAge * 0.75) {
    newToken = createAuthToken(user.id, user.role);
  }

  return apiSuccess({ ...user, token: newToken || token });
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'session' });
