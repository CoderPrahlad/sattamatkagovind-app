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

  /**
   * BALANCE SPLIT LOGIC:
   * Ideal split: 35% from winningAmount, 10% from referralBalance, 55% from deposit
   * 
   * deposit = balance - winningAmount - referralBalance
   * (balance is total of all three)
   * 
   * If any source is insufficient, the shortfall is covered by deposit.
   * If total is still insufficient → error.
   */
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Ideal shares
  const idealWinning  = round2(amount * 0.35);
  const idealReferral = round2(amount * 0.10);
  const idealDeposit  = round2(amount - idealWinning - idealReferral);

  // Actual available in each bucket
  const availableWinning  = user.winningAmount;
  const availableReferral = user.referralBalance;
  // deposit = total balance minus the other two tracked buckets
  const availableDeposit  = round2(user.balance - user.winningAmount - user.referralBalance);

  // Clamp each bucket to what's available; shortfall rolls to deposit
  const actualWinning  = round2(Math.min(idealWinning, availableWinning));
  const winningShortfall = round2(idealWinning - actualWinning);

  const actualReferral = round2(Math.min(idealReferral, availableReferral));
  const referralShortfall = round2(idealReferral - actualReferral);

  const depositNeeded = round2(idealDeposit + winningShortfall + referralShortfall);
  const actualDeposit = round2(Math.min(depositNeeded, availableDeposit));

  const totalCovered = round2(actualWinning + actualReferral + actualDeposit);

  if (totalCovered < amount) {
    return apiError(
      `Insufficient balance. Required: ₹${amount} | Available — Winning: ₹${availableWinning}, Referral: ₹${availableReferral}, Deposit: ₹${availableDeposit}`
    );
  }

  const result = await db.$transaction(async (tx) => {
    // 1. Deduct winningAmount bucket
    if (actualWinning > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, winningAmount: { gte: actualWinning } },
        data: {
          winningAmount: { decrement: actualWinning },
          balance: { decrement: actualWinning },
        },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
    }

    // 2. Deduct referralBalance bucket
    if (actualReferral > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, referralBalance: { gte: actualReferral } },
        data: {
          referralBalance: { decrement: actualReferral },
          balance: { decrement: actualReferral },
        },
      });
      if (r.count === 0) throw new Error('INSUFFICIENT_BALANCE');
    }

    // 3. Deduct deposit (balance only, no separate bucket field)
    if (actualDeposit > 0) {
      const r = await tx.user.updateMany({
        where: { id: session.userId, balance: { gte: actualDeposit } },
        data: { balance: { decrement: actualDeposit } },
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
        adminNote: `Winning: ₹${actualWinning} | Referral: ₹${actualReferral} | Deposit: ₹${actualDeposit}`,
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
    winningUsed: actualWinning,
    referralUsed: actualReferral,
    depositUsed: actualDeposit,
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