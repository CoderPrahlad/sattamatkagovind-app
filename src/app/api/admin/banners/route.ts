import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText, isValidUrl } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  const banners = await db.banner.findMany({
    orderBy: { createdAt: 'desc' },
  });

  logger.debug('AdminBanners', `Fetched banners by admin ${session.userId}`);
  return apiSuccess(banners);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });

export const POST = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { title, subtitle, ctaText, ctaLink, imageUrl } = body as Record<string, unknown>;

  if (!title) {
    return apiError('Title is required');
  }

  // Validate URLs if provided
  if (ctaLink && !isValidUrl(String(ctaLink))) {
    return apiError('CTA link must be a valid URL');
  }
  if (imageUrl && !isValidUrl(String(imageUrl))) {
    return apiError('Image URL must be a valid URL');
  }

  const banner = await db.banner.create({
    data: {
      title: sanitizeText(String(title)),
      subtitle: subtitle ? sanitizeText(String(subtitle)) : null,
      ctaText: ctaText ? sanitizeText(String(ctaText)) : null,
      ctaLink: ctaLink ? String(ctaLink) : null,
      imageUrl: imageUrl ? String(imageUrl) : null,
    },
  });

  // Invalidate banners cache
  cacheDeleteByPrefix('banners:');

  logger.info('AdminBanners', `Banner created "${String(title)}" by admin ${session.userId}`);
  return apiSuccess(banner, 'Banner created successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
