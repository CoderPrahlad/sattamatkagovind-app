import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizePagination, sanitizeText, isValidDateString } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { searchParams } = new URL(request.url);
  const status = sanitizeText(searchParams.get('status') || '');
  const type = sanitizeText(searchParams.get('type') || '');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const search = sanitizeText(searchParams.get('search') || '');
  const { page, limit, skip } = sanitizePagination(
    Number(searchParams.get('page')) || undefined,
    Number(searchParams.get('limit')) || undefined
  );

  // Build where clause
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom && isValidDateString(dateFrom)) {
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo && isValidDateString(dateTo)) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = toDate;
    }
  }

  // Search by user name or mobile
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search } },
        { mobile: { contains: search } },
      ],
    };
  }

  // Get total count for pagination
  const total = await db.walletTransaction.count({ where });

  const transactions = await db.walletTransaction.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobile: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  logger.info('AdminWallet', `Fetched transactions page=${page} by admin ${session.userId}`);
  return apiSuccess({
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
