import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';

export const PUT = apiHandler(async (request, context) => {
  const params = await context!.params;
  const id = params.id;
  const session = await requireAdmin(request);

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const game = await db.game.findUnique({
    where: { id },
  });

  if (!game) {
    return apiError('Game not found', 404);
  }

  // Allow updating openTime, closeTime, isOpen, and sortOrder.
  // Only name is locked to prevent accidental renaming.
  const updateData: Record<string, unknown> = {};
  if ((body as Record<string, unknown>).openTime !== undefined) {
    updateData.openTime = String((body as Record<string, unknown>).openTime);
  }
  if ((body as Record<string, unknown>).closeTime !== undefined) {
    updateData.closeTime = String((body as Record<string, unknown>).closeTime);
  }
  if ((body as Record<string, unknown>).isOpen !== undefined) {
    updateData.isOpen = (body as Record<string, unknown>).isOpen;
  }
  if ((body as Record<string, unknown>).sortOrder !== undefined) {
    updateData.sortOrder = Number((body as Record<string, unknown>).sortOrder);
  }

  if (Object.keys(updateData).length === 0) {
    return apiError('No valid fields to update.');
  }

  const updatedGame = await db.game.update({
    where: { id },
    data: updateData,
  });

  // Invalidate games cache
  cacheDeleteByPrefix('games:');

  logger.info('AdminGames', `Game ${id} updated by admin ${session.userId}`, updateData);
  return apiSuccess(updatedGame, 'Game updated successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });

export const DELETE = apiHandler(async (request, context) => {
  const params = await context!.params;
  const id = params.id;
  const session = await requireAdmin(request);

  await db.game.delete({ where: { id } });

  // Invalidate games cache
  cacheDeleteByPrefix('games:');

  logger.info('AdminGames', `Game ${id} deleted by admin ${session.userId}`);
  return apiSuccess(null, 'Game deleted successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
