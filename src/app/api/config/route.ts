import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache';
import { db } from '@/lib/db';

const CONFIG_CACHE_KEY = 'config:public';

export const GET = apiHandler(async () => {
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
    firstDepositBonusAmount: number;
    firstDepositMinAmount: number;
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
    'referral_deposit_percent',
    'referral_bonus_percentage',
    'referral_bonus_max_amount',
    'first_deposit_bonus_amount',
    'first_deposit_min_amount',
  ];

  const configs = await db.gameConfig.findMany({
    where: { key: { in: publicKeys } },
  });

  const configMap: Record<string, string> = {};
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

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
    // referral_deposit_percent = admin panel wala actual field
    // referral_bonus_percentage = fallback
    referralBonusPercentage: configMap['referral_deposit_percent']
      ? parseFloat(configMap['referral_deposit_percent'])
      : configMap['referral_bonus_percentage']
        ? parseFloat(configMap['referral_bonus_percentage'])
        : 1,
    referralBonusMaxAmount: configMap['referral_bonus_max_amount']
      ? parseFloat(configMap['referral_bonus_max_amount'])
      : 50,
    firstDepositBonusAmount: configMap['first_deposit_bonus_amount']
      ? parseFloat(configMap['first_deposit_bonus_amount'])
      : 50,
    firstDepositMinAmount: configMap['first_deposit_min_amount']
      ? parseFloat(configMap['first_deposit_min_amount'])
      : 500,
  };

  cacheSet(CONFIG_CACHE_KEY, data, CACHE_TTL.CONFIG);

  return apiSuccess(data);
}, { rateLimit: RATE_LIMITS.GENERAL });