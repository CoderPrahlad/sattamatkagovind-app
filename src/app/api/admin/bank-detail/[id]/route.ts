import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// GET: Admin views any user's bank detail by user ID
export const GET = apiHandler(async (request, context) => {
  const session = await requireAdmin(request);
  const params = await context!.params;
  const id = params.id;

  const bankDetail = await db.bankDetail.findUnique({
    where: { userId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobile: true,
        },
      },
    },
  });

  if (!bankDetail) {
    logger.debug('AdminBankDetail', `No bank detail found for user ${id} by admin ${session.userId}`);
    return apiSuccess(null, 'No bank detail found for this user');
  }

  logger.debug('AdminBankDetail', `Bank detail fetched for user ${id} by admin ${session.userId}`);
  return apiSuccess(bankDetail);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
