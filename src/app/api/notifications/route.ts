import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);

  const notifications = await db.notification.findMany({
    where: {
      OR: [
        { userId: session.userId },
        { userId: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return apiSuccess(notifications);
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'notificationsGet' });

export const PUT = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const body = await request.json();
  const { notificationIds } = body;

  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return apiError('notificationIds array is required');
  }

  await db.notification.updateMany({
    where: {
      id: { in: notificationIds },
      OR: [
        { userId: session.userId },
        { userId: null },
      ],
    },
    data: { isRead: true },
  });

  return apiSuccess(null, 'Notifications marked as read');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'notificationsPut' });
