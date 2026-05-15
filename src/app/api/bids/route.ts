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

  // Validate required fields
  if (!gameId || !bidType || !number || !amount) {
    return apiError('gameId, bidType, number, and amount are required');
  }

  // Validate bidType
  if (!isValidBidType(bidType)) {
    return apiError('bidType must be "single" or "jodi"');
  }

  // Validate number format
  if (!isValidBidNumber(number, bidType)) {
    return apiError(bidType === 'single' ? 'Single bid number must be 0-9' : 'Jodi bid number must be 00-99');
  }

  // Validate amount
  if (!isValidAmount(amount, 1)) {
    return apiError('Amount must be a number greater than 0');
  }

  // Check max bid amount from config
  const maxBidConfig = await db.gameConfig.findUnique({
    where: { key: 'max_bid_amount' },
  });
  const maxBidAmount = maxBidConfig ? parseFloat(maxBidConfig.value) : 10000;

  if (amount > maxBidAmount) {
    return apiError(`Maximum bid amount is ₹${maxBidAmount}`);
  }

  // Check game exists and is accepting bids
  const game = await db.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return apiError('Game not found', 404);
  }

  if (!game.isOpen) {
    return apiError('Game is currently closed');
  }

  // SERVER IS THE SINGLE SOURCE OF TRUTH for dates — ignore client's targetDate
  // The server decides today vs tomorrow based on IST time and game state
  const today = getTodayIST();
  const tomorrow = getTomorrowIST();

  // Check if result exists for today
  const todayResult = await db.gameResult.findFirst({
    where: { gameId, date: today },
  });

  // Check if currently in closing window
  const isClosingNow = isInClosingWindow(game.openTime, game.closeTime);

  // Determine target date based on server-side game state:
  // 1. If today's result is declared → bid for tomorrow
  // 2. If currently in closing window → bid for tomorrow
  // 3. Otherwise → bid for today
  let resolvedTargetDate: string;
  if (todayResult) {
    // Result already declared for today, so bid for tomorrow
    resolvedTargetDate = tomorrow;
  } else if (isClosingNow) {
    // In closing window — allow next-day bids
    resolvedTargetDate = tomorrow;
  } else {
    // Normal: bid for today
    resolvedTargetDate = today;
  }

  // For next-day bids: allowed only after result is declared OR during closing window
  if (resolvedTargetDate === tomorrow) {
    if (!todayResult && !isClosingNow) {
      return apiError('Next-day bidding is not available yet. It opens after the result is declared or during the closing window.');
    }
  }

  // Create bid, deduct balance, and create transaction in a transaction
  const result = await db.$transaction(async (tx) => {
    // Deduct from user balance — only succeeds if balance >= amount
    const updateResult = await tx.user.updateMany({
      where: { id: session.userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (updateResult.count === 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // Create wallet transaction
    const transaction = await tx.walletTransaction.create({
      data: {
        userId: session.userId,
        type: 'bid',
        amount: -amount,
        status: 'approved',
      },
    });

    // Create bid with targetDate
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

  // Invalidate wallet cache
  cacheDeleteByPrefix(`wallet:${session.userId}`);

  logger.info('Bid', 'Bid placed', { userId: session.userId, gameId, bidType, number, amount, targetDate: resolvedTargetDate });

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
      game: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return apiSuccess(bids);
}, { rateLimit: RATE_LIMITS.GENERAL });
