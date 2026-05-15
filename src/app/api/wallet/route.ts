import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, cacheDeleteByPrefix, CACHE_TTL } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);

  // Check cache first
  const cacheKey = `wallet:${session.userId}`;
  const cached = cacheGet<{
    balance: number;
    winningAmount: number;
    transactions: unknown[];
  }>(cacheKey);
  if (cached) {
    logger.debug('Wallet', 'Cache hit', { userId: session.userId });
    return apiSuccess(cached);
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      balance: true,
      winningAmount: true,
    },
  });

  if (!user) {
    return apiError('User not found', 404);
  }

  const transactions = await db.walletTransaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const data = {
    balance: user.balance,
    winningAmount: user.winningAmount,
    transactions,
  };

  // Cache the result
  cacheSet(cacheKey, data, CACHE_TTL.USER_SESSION);

  return apiSuccess(data);
}, { rateLimit: RATE_LIMITS.GENERAL });
