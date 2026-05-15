import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Default config keys with their default values
const DEFAULT_CONFIGS = [
  { key: 'whatsapp_number', value: '919999999999' },
  { key: 'telegram_link', value: '' },
  { key: 'telegram_enabled', value: 'false' },
  { key: 'min_withdraw_amount', value: '500' },
  { key: 'min_deposit_amount', value: '200' },
  { key: 'max_bid_amount', value: '10000' },
  { key: 'max_numbers_per_bid', value: '10' },
  { key: 'upi_id', value: '' },
  { key: 'qr_code_url', value: '' },
  { key: 'payment_methods', value: '["upi","bank"]' },
  { key: 'site_name', value: 'MatkaKing' },
  { key: 'referral_bonus_percentage', value: '10' },
  { key: 'referral_bonus_max_amount', value: '50' },
  { key: 'referral_bonus_enabled', value: 'true' },
  { key: 'welcome_bonus', value: '100' },
];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

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

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin config fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { configs } = body;

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        { success: false, error: 'configs array is required' },
        { status: 400 }
      );
    }

    // Validate config keys against whitelist
    const ALLOWED_KEYS = DEFAULT_CONFIGS.map(c => c.key);
    const unknownKeys = configs.map((c: { key: string }) => c.key).filter((k: string) => !ALLOWED_KEYS.includes(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unknown config keys: ${unknownKeys.join(', ')}` },
        { status: 400 }
      );
    }

    const results = await db.$transaction(
      configs.map((config: { key: string; value: string }) =>
        db.gameConfig.upsert({
          where: { key: config.key },
          update: { value: config.value },
          create: { key: config.key, value: config.value },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Config updated successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin config update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
