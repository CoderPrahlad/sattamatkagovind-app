import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeName, sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, cacheDeleteByPrefix, CACHE_TTL } from '@/lib/cache';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  // Check cache
  const cacheKey = 'games:admin_list';
  const cached = cacheGet<typeof undefined>(cacheKey);
  if (cached) {
    logger.debug('AdminGames', 'Cache hit for admin games list');
    return apiSuccess(cached);
  }

  const games = await db.game.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          bids: true,
          results: true,
        },
      },
    },
  });

  cacheSet(cacheKey, games, CACHE_TTL.GAMES);
  logger.info('AdminGames', `Fetched games list by admin ${session.userId}`);
  return apiSuccess(games);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });

export const POST = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { name, openTime, closeTime, sortOrder } = body as Record<string, unknown>;

  if (!name || !openTime || !closeTime) {
    return apiError('name, openTime, and closeTime are required');
  }

  const sanitizedName = sanitizeName(String(name));

  const game = await db.game.create({
    data: { name: sanitizedName, openTime: String(openTime), closeTime: String(closeTime), sortOrder: Number(sortOrder) || 0, isOpen: true },
  });

  // Invalidate games cache
  cacheDeleteByPrefix('games:');

  logger.info('AdminGames', `Game created "${sanitizedName}" by admin ${session.userId}`);
  return apiSuccess(game, 'Game created successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
