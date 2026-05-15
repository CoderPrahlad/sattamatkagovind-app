import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { db } from '@/lib/db';

const CONFIG_CACHE_KEY = 'config:public';

export const GET = apiHandler(async () => {
  // Check cache first
  const cached = cacheGet<{
    whatsappNumber: string;
    telegramLink: string;
    telegramEnabled: boolean;
    upiId: string;
    qrCodeUrl: string;
    paymentMethods: string[];
    minDepositAmount: number;
    siteName: string;
    referralBonusEnabled: boolean;
    referralBonusPercentage: number;
    referralBonusMaxAmount: number;
  }>(CONFIG_CACHE_KEY);
  if (cached) {
    logger.debug('Config', 'Cache hit');
    return apiSuccess(cached);
  }

  const publicKeys = [
    'whatsapp_number',
    'telegram_link',
    'telegram_enabled',
    'upi_id',
    'qr_code_url',
    'payment_methods',
    'min_deposit_amount',
    'site_name',
    'referral_bonus_enabled',
    'referral_bonus_percentage',
    'referral_bonus_max_amount',
  ];

  const configs = await db.gameConfig.findMany({
    where: { key: { in: publicKeys } },
  });

  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

  // Parse payment methods from JSON string, default to ['upi', 'bank']
  let paymentMethods: string[] = ['upi', 'bank'];
  if (configMap['payment_methods']) {
    try {
      const parsed = JSON.parse(configMap['payment_methods']);
      if (Array.isArray(parsed)) {
        paymentMethods = parsed;
      }
    } catch {
      // Keep default
    }
  }

  const data = {
    whatsappNumber: configMap['whatsapp_number'] || '919999999999',
    telegramLink: configMap['telegram_link'] || '',
    telegramEnabled: configMap['telegram_enabled'] === 'true',
    upiId: configMap['upi_id'] || '',
    qrCodeUrl: (configMap['qr_code_url'] || '').replace(/^\/uploads\//, '/api/uploads/'),
    paymentMethods,
    minDepositAmount: configMap['min_deposit_amount']
      ? parseFloat(configMap['min_deposit_amount'])
      : 200,
    siteName: configMap['site_name'] || 'MatkaKing',
    referralBonusEnabled: configMap['referral_bonus_enabled'] === 'true',
    referralBonusPercentage: configMap['referral_bonus_percentage']
      ? parseFloat(configMap['referral_bonus_percentage'])
      : 10,
    referralBonusMaxAmount: configMap['referral_bonus_max_amount']
      ? parseFloat(configMap['referral_bonus_max_amount'])
      : 50,
  };

  // Cache the result
  cacheSet(CONFIG_CACHE_KEY, data, CACHE_TTL.CONFIG);

  return apiSuccess(data);
}, { rateLimit: RATE_LIMITS.GENERAL });
