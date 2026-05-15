import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText, isValidDateString } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { getTodayIST, getTomorrowIST } from '@/lib/time';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const status = sanitizeText(searchParams.get('status') || '');
  const gameId = sanitizeText(searchParams.get('gameId') || '');
  const userId = sanitizeText(searchParams.get('userId') || '');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const targetDate = sanitizeText(searchParams.get('targetDate') || '');

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (gameId) where.gameId = gameId;
  if (userId) where.userId = userId;
  if (targetDate) where.targetDate = targetDate;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom && isValidDateString(dateFrom)) {
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo && isValidDateString(dateTo)) {
      (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }
  }

  const [bids, summary] = await Promise.all([
    db.bid.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        },
        game: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.bid.aggregate({
      where,
      _count: true,
      _sum: {
        amount: true,
        winAmount: true,
      },
    }),
  ]);

  const pendingCount = await db.bid.count({ where: { ...where, status: 'pending' } });
  const wonCount = await db.bid.count({ where: { ...where, status: 'won' } });
  const lostCount = await db.bid.count({ where: { ...where, status: 'lost' } });

  // Compute today and tomorrow for next-day badge
  const today = getTodayIST();
  const tomorrow = getTomorrowIST();

  logger.info('AdminBids', `Fetched bids by admin ${session.userId}`);
  return apiSuccess({
    bids,
    today,
    tomorrow,
    summary: {
      totalBids: summary._count,
      totalAmount: summary._sum.amount || 0,
      pendingBids: pendingCount,
      wonBids: wonCount,
      lostBids: lostCount,
      totalPayout: summary._sum.winAmount || 0,
    },
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
