import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';

// Default config keys with their default values
const DEFAULT_CONFIGS = [
  { key: 'whatsapp_number', value: '919999999999' },
  { key: 'telegram_link', value: '' },
  { key: 'telegram_enabled', value: 'false' },
  { key: 'min_withdraw_amount', value: '500' },
  { key: 'min_deposit_amount', value: '200' },
  { key: 'max_deposit_amount', value: '100000' },
  { key: 'max_bid_amount', value: '10000' },
  { key: 'max_numbers_per_bid', value: '10' },
  { key: 'upi_id', value: '' },
  { key: 'qr_code_url', value: '' },
  { key: 'payment_methods', value: '["upi","bank"]' },
  { key: 'site_name', value: 'MatkaKing' },

  // ── Referral System Configs (Admin Panel se change kar sakte ho) ──
  // ✅ CHANGED: Default referral % is now 1 (was 10)
  { key: 'referral_bonus_percentage', value: '1' },

  // ✅ NEW: Lifetime referral % - referrer ko har deposit pe itna % milega
  { key: 'referral_deposit_percent', value: '1' },

  { key: 'referral_bonus_max_amount', value: '50' },
  { key: 'referral_bonus_enabled', value: 'true' },

  // ✅ NEW: Referred user ko 1st deposit pe kitna ₹ bonus milega
  { key: 'first_deposit_bonus_amount', value: '50' },

  // ✅ NEW: Minimum deposit amount to qualify for first deposit bonus
  { key: 'first_deposit_min_amount', value: '500' },

  { key: 'signup_bonus', value: '0' },
];

export const GET = apiHandler(async (request) => {
  const session = await requireAdmin(request);

  // Seed missing configs with defaults (batch upsert in transaction for efficiency)
  const existingConfigs = await db.gameConfig.findMany({
    select: { key: true },
  });
  const existingKeys = new Set(existingConfigs.map(c => c.key));
  const missingConfigs = DEFAULT_CONFIGS.filter(c => !existingKeys.has(c.key));

  if (missingConfigs.length > 0) {
    await db.$transaction(
      missingConfigs.map(config =>
        db.gameConfig.create({
          data: { key: config.key, value: config.value },
        })
      )
    );
  }

  const configs = await db.gameConfig.findMany({
    orderBy: { key: 'asc' },
  });

  logger.debug('AdminConfig', `Fetched config by admin ${session.userId}`);
  return apiSuccess(configs);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });

export const PUT = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { configs } = body as Record<string, unknown>;

  if (!configs || !Array.isArray(configs)) {
    return apiError('configs array is required');
  }

  // Validate config keys against whitelist
  const ALLOWED_KEYS = DEFAULT_CONFIGS.map(c => c.key);
  const unknownKeys = (configs as { key: string }[]).map((c) => c.key).filter((k) => !ALLOWED_KEYS.includes(k));
  if (unknownKeys.length > 0) {
    return apiError(`Unknown config keys: ${unknownKeys.join(', ')}`);
  }

  // Sanitize config values
  const sanitizedConfigs = (configs as { key: string; value: string }[]).map((config) => ({
    key: sanitizeText(config.key, 50),
    value: sanitizeText(config.value, 2000),
  }));

  const results = await db.$transaction(
    sanitizedConfigs.map((config) =>
      db.gameConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: { key: config.key, value: config.value },
      })
    )
  );

  // Invalidate config cache
  cacheDeleteByPrefix('config:');
  cacheDeleteByPrefix('site_config');

  logger.info('AdminConfig', `Config updated by admin ${session.userId}. Keys: ${sanitizedConfigs.map(c => c.key).join(', ')}`);
  return apiSuccess(results, 'Config updated successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });