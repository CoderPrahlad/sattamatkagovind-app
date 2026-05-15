import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PUT: Mark notifications as read by IDs
export const PUT = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return apiError('ids array is required');
  }

  await db.notification.updateMany({
    where: {
      id: { in: ids },
      OR: [
        { userId: session.userId },
        { userId: null },
      ],
    },
    data: { isRead: true },
  });

  return apiSuccess(null, 'Notifications marked as read');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'notificationsReadPut' });
