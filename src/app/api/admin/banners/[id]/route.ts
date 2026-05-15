import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText, isValidUrl } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';

export const PUT = apiHandler(async (request, context) => {
  const params = await context!.params;
  const id = params.id;
  const session = await requireAdmin(request);

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { title, subtitle, ctaText, ctaLink, imageUrl, isActive } = body as Record<string, unknown>;

  const banner = await db.banner.findUnique({
    where: { id },
  });

  if (!banner) {
    return apiError('Banner not found', 404);
  }

  // Validate URLs if provided
  if (ctaLink && !isValidUrl(String(ctaLink))) {
    return apiError('CTA link must be a valid URL');
  }
  if (imageUrl && !isValidUrl(String(imageUrl))) {
    return apiError('Image URL must be a valid URL');
  }

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = sanitizeText(String(title));
  if (subtitle !== undefined) updateData.subtitle = subtitle ? sanitizeText(String(subtitle)) : null;
  if (ctaText !== undefined) updateData.ctaText = ctaText ? sanitizeText(String(ctaText)) : null;
  if (ctaLink !== undefined) updateData.ctaLink = ctaLink ? String(ctaLink) : null;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl ? String(imageUrl) : null;
  if (typeof isActive === 'boolean') updateData.isActive = isActive;

  const updatedBanner = await db.banner.update({
    where: { id },
    data: updateData,
  });

  // Invalidate banners cache
  cacheDeleteByPrefix('banners:');

  logger.info('AdminBanners', `Banner ${id} updated by admin ${session.userId}`);
  return apiSuccess(updatedBanner, 'Banner updated successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });

export const DELETE = apiHandler(async (request, context) => {
  const params = await context!.params;
  const id = params.id;
  const session = await requireAdmin(request);

  const banner = await db.banner.findUnique({
    where: { id },
  });

  if (!banner) {
    return apiError('Banner not found', 404);
  }

  await db.banner.delete({
    where: { id },
  });

  // Invalidate banners cache
  cacheDeleteByPrefix('banners:');

  logger.info('AdminBanners', `Banner ${id} deleted by admin ${session.userId}`);
  return apiSuccess(null, 'Banner deleted successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
