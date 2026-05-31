import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { isValidBidNumber, isValidBidType, isValidAmount } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { cacheDeleteByPrefix } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getTodayIST, getTomorrowIST, isInClosingWindow } from '@/lib/time';

export const POST = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const gameId = body.gameId as string;
  const bidType = body.bidType as string;
  const number = body.number as string;
  const amount = body.amount as number;

  if (!gameId || !bidType || !number || !amount) {
    return apiError('gameId, bidType, number, and amount are required');
  }

  if (!isValidBidType(bidType)) {
    return apiError('bidType must be "single" or "jodi"');
  }

  if (!isValidBidNumber(number, bidType)) {
    return apiError(bidType === 'single' ? 'Single bid number must be 0-9' : 'Jodi bid number must be 00-99');
  }

  if (!isValidAmount(amount, 1)) {
    return apiError('Amount must be a number greater than 0');
  }

  const maxBidConfig = await db.gameConfig.findUnique({
    where: { key: 'max_bid_amount' },
  });
  const maxBidAmount = maxBidConfig ? parseFloat(maxBidConfig.value) : 10000;

  if (amount > maxBidAmount) {
    return apiError(`Maximum bid amount is ₹${maxBidAmount}`);
  }

  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return apiError('Game not found', 404);
  if (!game.isOpen) return apiError('Game is currently closed');

  const today = getTodayIST();
  const tomorrow = getTomorrowIST();

  const todayResult = await db.gameResult.findFirst({
    where: { gameId, date: today },
  });

  const isClosingNow = isInClosingWindow(game.openTime, game.closeTime);

  let resolvedTargetDate: string;
  if (todayResult) {
    resolvedTargetDate = tomorrow;
  } else if (isClosingNow) {
    resolvedTargetDate = tomorrow;
  } else {
    resolvedTargetDate = today;
  }

  if (resolvedTargetDate === tomorrow && !todayResult && !isClosingNow) {
    return apiError('Next-day bidding is not available yet.');
  }

  // Get user balances
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { balance: true, winningAmount: true, referralBalance: true },
  });

  if (!user) return apiError('User not found', 404);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // deposit bucket = total balance minus winningAmount minus referralBalance
  const depositBalance = round2(user.balance - user.winningAmount - user.referralBalance);

  /**
   * NEW BET LOGIC:
   * 1. PEHLE deposit balance se cut karo
   * 2. Deposit kam pad gaya → winningAmount se baaki cut karo
   * 3. Phir bhi kam → referralBalance se cut karo
   */
  let fromDeposit = 0;
  let fromWinning = 0;
  let fromReferral = 0;

  let remaining = amount;

  // Step 1: Deposit balance use karo
  const useDeposit = Math.min(remaining, depositBalance);
  fromDeposit = round2(useDeposit);
  remaining = round2(remaining - fromDeposit);

  // Step 2: Winning amount use karo
  if (remaining > 0) {
    const useWinning = Math.min(remaining, user.winningAmount);
    fromWinning = round2(useWinning);
    remaining = round2(remaining - fromWinning);
  }

  // Step 3: Referral balance use karo (last resort)
  if (remaining > 0) {
    const useReferral = Math.min(remaining, user.referralBalance);
    fromReferral = round2(useReferral);
    remaining = round2(remaining - fromReferral);
  }

  // Check if total covered
  const totalCovered = round2(fromDeposit + fromWinning + fromReferral);

  if (totalCovered < amount) {
    return apiError(
      `Insufficient balance. Required: ₹${amount} | Available — Deposit: ₹${depositBalance}, Winning: ₹${user.winningAmount}, Bonus: ₹${user.referralBalance}`
    );
  }

  const result = await db.$transaction(async (tx) => {
    // 1. Deduct from deposit (balance)
    if (fromDeposit > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, balance: { gte: fromDeposit } },
        data: { balance: { decrement: fromDeposit } },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
    }

    // 2. Deduct from winningAmount (and balance)
    if (fromWinning > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, winningAmount: { gte: fromWinning } },
        data: {
          winningAmount: { decrement: fromWinning },
          balance: { decrement: fromWinning },
        },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
    }

    // 3. Deduct from referralBalance (and balance)
    if (fromReferral > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, referralBalance: { gte: fromReferral } },
        data: {
          referralBalance: { decrement: fromReferral },
          balance: { decrement: fromReferral },
        },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
    }

    // Create wallet transaction
    await tx.walletTransaction.create({
      data: {
        userId: session.userId,
        type: 'bid',
        amount: -amount,
        status: 'approved',
        adminNote: `Deposit: ₹${fromDeposit} | Winning: ₹${fromWinning} | Bonus: ₹${fromReferral}`,
      },
    });

    const bid = await tx.bid.create({
      data: {
        userId: session.userId,
        gameId,
        bidType,
        number,
        amount,
        status: 'pending',
        targetDate: resolvedTargetDate,
      },
    });

    return bid;
  });

  cacheDeleteByPrefix(`wallet:${session.userId}`);

  logger.info('Bid', 'Bid placed', {
    userId: session.userId,
    gameId, bidType, number, amount,
    depositUsed: fromDeposit,
    winningUsed: fromWinning,
    bonusUsed: fromReferral,
    targetDate: resolvedTargetDate,
  });

  return apiSuccess(result, resolvedTargetDate === today
    ? 'Bid placed successfully'
    : `Bid placed for ${resolvedTargetDate}`);
}, { rateLimit: RATE_LIMITS.BID, rateLimitSuffix: 'bid' });

export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const gameId = searchParams.get('gameId');

  const where: Record<string, unknown> = { userId: session.userId };
  if (status) where.status = status;
  if (gameId) where.gameId = gameId;

  const bids = await db.bid.findMany({
    where,
    include: {
      game: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return apiSuccess(bids);
}, { rateLimit: RATE_LIMITS.GENERAL });