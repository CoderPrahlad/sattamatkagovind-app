import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
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

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error('Public config fetch error:', error);
    // Return fallback data with fallback flag so client knows it's not live
    return NextResponse.json(
      {
        success: true,
        fallback: true,
        data: {
          whatsappNumber: '919999999999',
          telegramLink: '',
          telegramEnabled: false,
          upiId: '',
          qrCodeUrl: '',
          paymentMethods: ['upi', 'bank'],
          minDepositAmount: 200,
          siteName: 'MatkaKing',
          referralBonusEnabled: true,
          referralBonusPercentage: 10,
          referralBonusMaxAmount: 50,
        },
      },
    );
  }
}
