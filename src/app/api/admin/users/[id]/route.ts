import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const PUT = apiHandler(async (request, context) => {
  const params = await context!.params;
  const id = params.id;
  const session = await requireAdmin(request);

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { isActive, balance, balanceAdjustment } = body as Record<string, unknown>;

  const user = await db.user.findUnique({
    where: { id },
  });

  if (!user) {
    return apiError('User not found', 404);
  }

  const updateData: Record<string, unknown> = {};
  if (typeof isActive === 'boolean') updateData.isActive = isActive;
  if (typeof balance === 'number') updateData.balance = balance;
  if (typeof balanceAdjustment === 'number') {
    const newBalance = user.balance + (balanceAdjustment as number);
    updateData.balance = Math.max(0, newBalance);
  }

  const updatedUser = await db.user.update({
    where: { id },
    data: updateData,
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
    },
  });

  logger.info('AdminUsers', `User ${id} updated by admin ${session.userId}`, updateData);
  return apiSuccess(updatedUser, 'User updated successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
