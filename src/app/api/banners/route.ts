import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { db } from '@/lib/db';

const BANNERS_CACHE_KEY = 'banners:active';

export const GET = apiHandler(async () => {
  // Check cache first
  const cached = cacheGet<unknown[]>(BANNERS_CACHE_KEY);
  if (cached) {
    logger.debug('Banners', 'Cache hit');
    return apiSuccess(cached);
  }

  const banners = await db.banner.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  // Cache the result
  cacheSet(BANNERS_CACHE_KEY, banners, CACHE_TTL.BANNERS);

  return apiSuccess(banners);
}, { rateLimit: RATE_LIMITS.GENERAL });
