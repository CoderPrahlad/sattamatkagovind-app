import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const status = sanitizeText(searchParams.get('status') || '');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const tickets = await db.supportTicket.findMany({
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
    take: 200,
  });

  logger.debug('AdminTickets', `Fetched tickets by admin ${session.userId}`);
  return apiSuccess(tickets);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
