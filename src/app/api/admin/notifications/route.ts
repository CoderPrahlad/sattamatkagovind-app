import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const POST = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { title, message, type, userId } = body as Record<string, unknown>;

  if (!title || !message) {
    return apiError('Title and message are required');
  }

  const notification = await db.notification.create({
    data: {
      title: sanitizeText(String(title)),
      message: sanitizeText(String(message)),
      type: type ? sanitizeText(String(type)) : 'info',
      userId: userId ? String(userId) : null,
    },
  });

  logger.info('AdminNotifications', `Notification created "${String(title)}" by admin ${session.userId}${userId ? ` for user ${String(userId)}` : ' (global)'}`);
  return apiSuccess(notification, userId ? 'Notification sent to user' : 'Global notification created');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
