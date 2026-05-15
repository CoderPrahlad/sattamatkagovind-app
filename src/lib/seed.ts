/**
 * Database Seed Utility - Fast idempotent seeder
 * Uses count() checks instead of findUnique+update for speed
 * Called automatically on every app startup via /api/init
 */
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// Prevent concurrent seed runs
let seeding = false;
let lastSeedTime = 0;
const SEED_COOLDOWN_MS = 60_000; // Only re-seed every 60 seconds

// Track if we've ever done a full seed (survives cooldown gap)
let hasEverSeeded = false;

export async function seedDatabase(): Promise<{
  seeded: boolean;
  message: string;
  details: string[];
}> {
  const now = Date.now();
  if (seeding) return { seeded: false, message: 'Seed already in progress', details: [] };
  if (now - lastSeedTime < SEED_COOLDOWN_MS && hasEverSeeded) return { seeded: false, message: 'Recently seeded', details: [] };

  seeding = true;
  const details: string[] = [];

  try {
    // ── Quick check: do we even need to seed? ──
    const userCount = await db.user.count();
    const gameCount = await db.game.count();
    const configCount = await db.gameConfig.count();

    // If all tables have data, skip entirely (much faster than per-row checks)
    if (userCount >= 2 && gameCount >= 5 && configCount >= 15 && hasEverSeeded) {
      lastSeedTime = Date.now();
      return { seeded: false, message: 'Database up to date (fast check)', details: [] };
    }

    // ── 1. Ensure Admin User (create only, never update existing) ──
    const adminMobile = process.env.ADMIN_MOBILE || '9999999999';
    const adminPass = process.env.ADMIN_PASSWORD ? await hashPassword(process.env.ADMIN_PASSWORD) : await hashPassword('admin123');
    const adminReferral = 'ADMIN_MK';

    // Use count first (faster than findUnique for existence check)
    const adminExists = await db.user.count({ where: { mobile: adminMobile } });
    if (!adminExists) {
      await db.user.create({
        data: {
          name: 'Admin',
          mobile: adminMobile,
          password: adminPass,
          role: 'admin',
          balance: 0,
          winningAmount: 0,
          referralCode: adminReferral,
          isActive: true,
        },
      });
      details.push('Admin user created');
    }

    // ── 2. Ensure Demo User (create only) ──
    const demoMobile = process.env.DEMO_MOBILE || '9876543210';
    const demoPass = process.env.DEMO_PASSWORD ? await hashPassword(process.env.DEMO_PASSWORD) : await hashPassword('user123');
    const demoReferral = 'DEMO_MK';

    const demoExists = await db.user.count({ where: { mobile: demoMobile } });
    if (!demoExists) {
      await db.user.create({
        data: {
          name: 'Rahul Sharma',
          mobile: demoMobile,
          password: demoPass,
          role: 'user',
          balance: 500,
          winningAmount: 0,
          referralCode: demoReferral,
          isActive: true,
        },
      });
      details.push('Demo user created');
    }

    // ── 3. Ensure Default Games (create only, never modify existing) ──
    const defaultGames = [
      { name: 'Kalyan', openTime: '01:00', closeTime: '03:30', sortOrder: 1 },
      { name: 'Disawar', openTime: '15:00', closeTime: '17:00', sortOrder: 2 },
      { name: 'Ghaziabad', openTime: '01:01', closeTime: '03:10', sortOrder: 3 },
      { name: 'Faridabad', openTime: '18:00', closeTime: '20:00', sortOrder: 4 },
      { name: 'Gali', openTime: '20:00', closeTime: '22:00', sortOrder: 5 },
    ];

    // Batch check with a single query
    const existingGameNames = new Set(
      (await db.game.findMany({ where: { name: { in: defaultGames.map(g => g.name) } }, select: { name: true } })).map(g => g.name)
    );

    const gamesToCreate = defaultGames.filter(g => !existingGameNames.has(g.name));
    if (gamesToCreate.length > 0) {
      await db.game.createMany({ data: gamesToCreate.map(g => ({ ...g, isOpen: true })) });
      details.push(`${gamesToCreate.length} game(s) created`);
    }

    // ── 4. Ensure Default Config Values (create only) ──
    const defaultConfigs: Record<string, string> = {
      single_payout: '9',
      jodi_payout: '90',
      min_bid_amount: '10',
      max_bid_amount: '10000',
      min_withdraw_amount: '500',
      min_deposit_amount: '200',
      referral_bonus_percentage: '10',
      referral_bonus_max_amount: '50',
      referral_bonus_enabled: 'true',
      whatsapp_number: '919999999999',
      telegram_link: '',
      telegram_enabled: 'false',
      max_numbers_per_bid: '10',
      upi_id: '',
      qr_code_url: '',
      payment_methods: '["upi","bank"]',
      site_name: 'MatkaKing',
      welcome_bonus: '100',
    };

    const existingConfigKeys = new Set(
      (await db.gameConfig.findMany({ where: { key: { in: Object.keys(defaultConfigs) } }, select: { key: true } })).map(c => c.key)
    );

    const configsToCreate = Object.entries(defaultConfigs).filter(([key]) => !existingConfigKeys.has(key));
    if (configsToCreate.length > 0) {
      await db.gameConfig.createMany({ data: configsToCreate.map(([key, value]) => ({ key, value })) });
      details.push(`${configsToCreate.length} config(s) created`);
    }

    hasEverSeeded = true;
    lastSeedTime = Date.now();
    const seeded = details.length > 0;
    return {
      seeded,
      message: seeded ? `Database initialized with ${details.length} items` : 'Database already up to date',
      details,
    };
  } catch (error) {
    console.error('[SEED ERROR]', error);
    return {
      seeded: false,
      message: 'Seed failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      details: [],
    };
  } finally {
    seeding = false;
  }
}
