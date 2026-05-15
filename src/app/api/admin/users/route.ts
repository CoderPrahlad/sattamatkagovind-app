import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizePagination, sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = sanitizePagination(
    Number(searchParams.get('page')) || undefined,
    Number(searchParams.get('limit')) || undefined
  );
  const search = sanitizeText(searchParams.get('search') || '');

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { mobile: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        mobile: true,
        role: true,
        balance: true,
        winningAmount: true,
        referralCode: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            bids: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  logger.info('AdminUsers', `Fetched users page=${page} by admin ${session.userId}`);
  return apiSuccess({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
