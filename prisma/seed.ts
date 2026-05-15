import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "crypto";

const prisma = new PrismaClient();

function generateReferralCode(): string {
  return randomUUID().slice(0, 8).toUpperCase();
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'game_sim_salt').digest('hex');
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // --- Admin User ---
  const admin = await prisma.user.upsert({
    where: { mobile: "9999999999" },
    update: {},
    create: {
      name: "Admin",
      mobile: "9999999999",
      password: hashPassword("admin123"),
      role: "admin",
      referralCode: generateReferralCode(),
      isActive: true,
    },
  });
  console.log(`✅ Admin user created: ${admin.name} (${admin.mobile})`);

  // --- Demo User ---
  const demoUser = await prisma.user.upsert({
    where: { mobile: "9876543210" },
    update: {},
    create: {
      name: "Rahul Sharma",
      mobile: "9876543210",
      password: hashPassword("user123"),
      role: "user",
      balance: 5280,
      winningAmount: 2450,
      referralCode: generateReferralCode(),
      referredBy: admin.id,
      isActive: true,
    },
  });
  console.log(
    `✅ Demo user created: ${demoUser.name} (${demoUser.mobile}), balance: ₹${demoUser.balance}`
  );

  // --- Games ---
  // openTime = Closing From (when bidding stops), closeTime = Closing Until (when bidding resumes)
  const gamesData = [
    { name: "Kalyan", openTime: "14:00", closeTime: "16:00", sortOrder: 1 },
    { name: "Disawar", openTime: "15:00", closeTime: "17:00", sortOrder: 2 },
    { name: "Ghaziabad", openTime: "16:00", closeTime: "18:00", sortOrder: 3 },
    { name: "Faridabad", openTime: "18:00", closeTime: "20:00", sortOrder: 4 },
    { name: "Gali", openTime: "20:00", closeTime: "22:00", sortOrder: 5 },
  ];

  const games: Record<string, { id: string; name: string }> = {};
  for (const g of gamesData) {
    const game = await prisma.game.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });
    games[g.name] = game;
    console.log(
      `✅ Game created: ${game.name} (${game.openTime} - ${game.closeTime})`
    );
  }

  // --- Game Results (past 5 days for each game) ---
  console.log("\n📊 Creating game results...");
  let resultCount = 0;
  // Clear existing results for clean re-seed
  await prisma.gameResult.deleteMany({});
  for (const gameName of Object.keys(games)) {
    const game = games[gameName];
    for (let daysAgo = 0; daysAgo < 5; daysAgo++) {
      const resultNum = Math.floor(Math.random() * 10).toString();
      await prisma.gameResult.create({
        data: {
          gameId: game.id,
          result: resultNum,
          date: getDateStr(daysAgo),
        },
      });
      resultCount++;
    }
  }
  console.log(`✅ ${resultCount} game results created across 5 games × 5 days`);

  // --- Sample Bids for demo user ---
  console.log("\n🎰 Creating sample bids...");
  const bidData = [
    {
      gameName: "Gali",
      bidType: "single",
      number: "7",
      amount: 100,
      status: "won",
      winAmount: 900,
    },
    {
      gameName: "Disawar",
      bidType: "jodi",
      number: "45",
      amount: 50,
      status: "lost",
    },
    {
      gameName: "Kalyan",
      bidType: "single",
      number: "3",
      amount: 200,
      status: "pending",
    },
    {
      gameName: "Ghaziabad",
      bidType: "single",
      number: "1",
      amount: 150,
      status: "won",
      winAmount: 1350,
    },
    {
      gameName: "Faridabad",
      bidType: "jodi",
      number: "89",
      amount: 100,
      status: "pending",
    },
    {
      gameName: "Gali",
      bidType: "jodi",
      number: "23",
      amount: 200,
      status: "won",
      winAmount: 1800,
    },
    {
      gameName: "Disawar",
      bidType: "single",
      number: "5",
      amount: 80,
      status: "lost",
    },
  ];

  for (const bid of bidData) {
    await prisma.bid.create({
      data: {
        userId: demoUser.id,
        gameId: games[bid.gameName].id,
        bidType: bid.bidType,
        number: bid.number,
        amount: bid.amount,
        status: bid.status,
        winAmount: bid.winAmount ?? null,
        targetDate: getDateStr(Math.floor(Math.random() * 3)),
      },
    });
  }
  console.log(`✅ ${bidData.length} sample bids created for ${demoUser.name}`);

  // --- Sample Wallet Transactions for demo user ---
  console.log("\n💰 Creating sample wallet transactions...");
  const txData = [
    {
      type: "deposit",
      amount: 5000,
      status: "approved",
      upiNumber: "9876543210@upi",
    },
    {
      type: "bid",
      amount: 100,
      status: "approved",
    },
    {
      type: "win",
      amount: 900,
      status: "approved",
    },
    {
      type: "bid",
      amount: 50,
      status: "approved",
    },
    {
      type: "bid",
      amount: 200,
      status: "approved",
    },
    {
      type: "win",
      amount: 1350,
      status: "approved",
    },
    {
      type: "bid",
      amount: 150,
      status: "approved",
    },
    {
      type: "bid",
      amount: 100,
      status: "approved",
    },
    {
      type: "win",
      amount: 1800,
      status: "approved",
    },
    {
      type: "withdrawal",
      amount: 2000,
      status: "approved",
      bankAccount: "XXXX XXXX 4532",
    },
  ];

  for (const tx of txData) {
    await prisma.walletTransaction.create({
      data: {
        userId: demoUser.id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        upiNumber: tx.upiNumber ?? null,
        bankAccount: tx.bankAccount ?? null,
      },
    });
  }
  console.log(
    `✅ ${txData.length} wallet transactions created for ${demoUser.name}`
  );

  // --- Sample Banners ---
  console.log("\n🖼️ Creating sample banners...");
  const bannerData = [
    {
      title: "Welcome to Matka King!",
      subtitle: "Play and win big with India's most trusted platform",
      ctaText: "Play Now",
      ctaLink: "/play",
    },
    {
      title: "₹500 Welcome Bonus",
      subtitle: "Get ₹500 on your first deposit. Use code: WELCOME500",
      ctaText: "Claim Now",
      ctaLink: "/wallet",
    },
    {
      title: "Refer & Earn ₹200",
      subtitle: "Share your referral code with friends and earn ₹200 for each referral",
      ctaText: "Invite Friends",
      ctaLink: "/referral",
    },
    {
      title: "Festival Special - Double Winnings!",
      subtitle: "All Jodi wins pay double this week. Don't miss out!",
      ctaText: "Play Now",
      ctaLink: "/play",
    },
  ];

  for (const banner of bannerData) {
    await prisma.banner.create({ data: banner });
  }
  console.log(`✅ ${bannerData.length} banners created`);

  // --- Sample Notifications ---
  console.log("\n🔔 Creating sample notifications...");
  const notificationData = [
    {
      userId: demoUser.id,
      title: "Welcome to Matka King!",
      message:
        "Start playing your favourite games. Deposit now and get a ₹500 welcome bonus!",
      type: "offer",
    },
    {
      userId: demoUser.id,
      title: "Bid Won! 🎉",
      message:
        "Congratulations! You won ₹900 on Gali Single (Number: 7). Amount credited to wallet.",
      type: "success",
    },
    {
      userId: demoUser.id,
      title: "Withdrawal Processed",
      message:
        "Your withdrawal of ₹2,000 has been processed and sent to your bank account.",
      type: "info",
    },
    {
      userId: demoUser.id,
      title: "Festival Offer",
      message:
        "This Diwali, get double winnings on all Jodi bets! Offer valid till Nov 15.",
      type: "offer",
    },
    {
      userId: null,
      title: "System Maintenance",
      message:
        "Scheduled maintenance tonight from 2:00 AM to 3:00 AM IST. Services will be temporarily unavailable.",
      type: "warning",
    },
    {
      userId: demoUser.id,
      title: "Refer & Earn",
      message:
        "Share your referral code RAHUL2024 and earn ₹200 for every friend who joins!",
      type: "offer",
    },
  ];

  for (const n of notificationData) {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
      },
    });
  }
  console.log(
    `✅ ${notificationData.length} notifications created (${
      notificationData.filter((n) => n.userId).length
    } for user, ${
      notificationData.filter((n) => !n.userId).length
    } global)`
  );

  // --- Game Config ---
  console.log("\n⚙️ Creating game config...");
  const configData = [
    { key: "single_payout", value: "9" },
    { key: "jodi_payout", value: "90" },
    { key: "min_bid_amount", value: "10" },
    { key: "max_bid_amount", value: "10000" },
    { key: "min_withdraw_amount", value: "500" },
    { key: "min_deposit_amount", value: "200" },
    { key: "referral_bonus", value: "200" },
    { key: "whatsapp_number", value: "919999999999" },
    { key: "telegram_link", value: "" },
    { key: "telegram_enabled", value: "false" },
  ];

  for (const c of configData) {
    await prisma.gameConfig.upsert({
      where: { key: c.key },
      update: { value: c.value },
      create: c,
    });
  }
  console.log(`✅ ${configData.length} game config entries created`);

  // --- Summary ---
  const totalUsers = await prisma.user.count();
  const totalGames = await prisma.game.count();
  const totalResults = await prisma.gameResult.count();
  const totalBids = await prisma.bid.count();
  const totalTx = await prisma.walletTransaction.count();
  const totalBanners = await prisma.banner.count();
  const totalNotifications = await prisma.notification.count();
  const totalConfig = await prisma.gameConfig.count();

  console.log("\n" + "═".repeat(50));
  console.log("📊 DATABASE SEED SUMMARY");
  console.log("═".repeat(50));
  console.log(`  Users:           ${totalUsers}`);
  console.log(`  Games:           ${totalGames}`);
  console.log(`  Game Results:    ${totalResults}`);
  console.log(`  Bids:            ${totalBids}`);
  console.log(`  Transactions:    ${totalTx}`);
  console.log(`  Banners:         ${totalBanners}`);
  console.log(`  Notifications:   ${totalNotifications}`);
  console.log(`  Game Configs:    ${totalConfig}`);
  console.log("═".repeat(50));
  console.log("✅ Seeding completed successfully!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
