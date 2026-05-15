import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { db } from '@/lib/db';
import { getTodayIST, getTomorrowIST, isInClosingWindow } from '@/lib/time';

const GAMES_CACHE_KEY = 'games:list';

export const GET = apiHandler(async () => {
  // Check cache first
  const cached = cacheGet<unknown[]>(GAMES_CACHE_KEY);
  if (cached) {
    logger.debug('Games', 'Cache hit');
    return apiSuccess(cached);
  }

  const today = getTodayIST();

  const games = await db.game.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      results: {
        where: { date: today },
        take: 1,
      },
    },
  });

  // Compute tomorrow's date in IST
  const tomorrow = getTomorrowIST();

  const gamesWithStatus = games.map((game) => {
    const todayResultDeclared = game.results.length > 0;
    // Bidding is OPEN when game is active AND NOT in closing window AND result not declared
    const isCurrentlyClosed = isInClosingWindow(game.openTime, game.closeTime);
    const isAcceptingBids = game.isOpen && !isCurrentlyClosed && !todayResultDeclared;

    return {
      id: game.id,
      name: game.name,
      // openTime repurposed as closeFrom, closeTime as closeUntil
      closeFrom: game.openTime,
      closeUntil: game.closeTime,
      openTime: game.openTime,
      closeTime: game.closeTime,
      isOpen: game.isOpen,
      sortOrder: game.sortOrder,
      isAcceptingBids,
      isCurrentlyClosed,
      todayResult: game.results.length > 0 ? game.results[0] : null,
      todayResultDeclared,
      nextDayBiddingAvailable: game.isOpen && todayResultDeclared,
      nextDayDate: tomorrow,
    };
  });

  // Cache the result
  cacheSet(GAMES_CACHE_KEY, gamesWithStatus, CACHE_TTL.GAMES);

  return apiSuccess(gamesWithStatus);
}, { rateLimit: RATE_LIMITS.GENERAL });
