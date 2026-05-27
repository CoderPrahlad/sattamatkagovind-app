import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { isValidResult, isValidDateString } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const POST = apiHandler(async (request) => {
  const session = await requireAdmin(request);
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { gameId, result, date } = body as Record<string, unknown>;

  if (!gameId || !result || !date) {
    return apiError('gameId, result, and date are required');
  }

  // Validate result format (must be numeric digits only)
  if (!isValidResult(String(result))) {
    return apiError('Result must be numeric digits only');
  }

  if (!isValidDateString(String(date))) {
    return apiError('Invalid date format. Use YYYY-MM-DD.');
  }

  const dateStr = String(date);
  const resultStr = String(result);
  const gameIdStr = String(gameId);

  // 1. FAST READ: Verify game exists (Outside Transaction)
  const game = await db.game.findUnique({
    where: { id: gameIdStr },
  });

  if (!game) {
    return apiError('Game not found', 404);
  }

  // 2. FAST READ: Check if result is already declared to avoid double processing
  const existingResult = await db.gameResult.findUnique({
    where: { gameId_date: { gameId: gameIdStr, date: dateStr } }
  });

  if (existingResult) {
    return apiError('Result already declared for this date', 400);
  }

  // 3. FAST READ: Get configs and all pending bids in parallel
  const [singlePayoutConfig, jodiPayoutConfig, pendingBids] = await Promise.all([
    db.gameConfig.findUnique({ where: { key: 'single_payout' } }),
    db.gameConfig.findUnique({ where: { key: 'jodi_payout' } }),
    db.bid.findMany({
      where: {
        gameId: gameIdStr,
        status: 'pending',
        targetDate: dateStr,
      },
    })
  ]);

  const singlePayout = singlePayoutConfig ? parseFloat(singlePayoutConfig.value) : 9;
  const jodiPayout = jodiPayoutConfig ? parseFloat(jodiPayoutConfig.value) : 90;

  // 4. IN-MEMORY CALCULATIONS (No Database Lock, Lightning Fast)
  let wonCount = 0;
  let lostCount = 0;
  let totalPayout = 0;

  const lostBidIds: string[] = [];
  const winsByUser = new Map<string, number>(); // userId → total win amount
  const bidUpdates: { id: string; status: string; winAmount: number | null }[] = [];

  for (const bid of pendingBids) {
    let isWinner = false;
    let winAmount = 0;

    if (bid.bidType === 'single') {
      const resultDigit = resultStr.slice(-1);
      isWinner = bid.number === resultDigit;
      winAmount = isWinner ? bid.amount * singlePayout : 0;
    } else if (bid.bidType === 'jodi') {
      const resultDigits = resultStr.slice(-2);
      const paddedNumber = bid.number.padStart(2, '0');
      isWinner = paddedNumber === resultDigits;
      winAmount = isWinner ? bid.amount * jodiPayout : 0;
    }

    if (isWinner) {
      wonCount++;
      totalPayout += winAmount;
      winsByUser.set(bid.userId, (winsByUser.get(bid.userId) || 0) + winAmount);
      bidUpdates.push({ id: bid.id, status: 'won', winAmount });
    } else {
      lostCount++;
      lostBidIds.push(bid.id);
      bidUpdates.push({ id: bid.id, status: 'lost', winAmount: null });
    }
  }

  // 5. BUILD SEQUENTIAL TRANSACTION ARRAY (Bypasses 5-second timeout)
  const queries = [];

  // 5a. Create the Game Result
  queries.push(
    db.gameResult.create({
      data: { gameId: gameIdStr, result: resultStr, date: dateStr }
    })
  );

  // 5b. Batch update all lost bids
  if (lostBidIds.length > 0) {
    queries.push(
      db.bid.updateMany({
        where: { id: { in: lostBidIds } },
        data: { status: 'lost', winAmount: null },
      })
    );
  }

  // 5c. Individually update won bids
  for (const update of bidUpdates) {
    if (update.status === 'won') {
      queries.push(
        db.bid.update({
          where: { id: update.id },
          data: { status: 'won', winAmount: update.winAmount },
        })
      );
    }
  }

  // 5d. Batch update user balances & create win wallet transactions
  for (const [userId, totalWin] of winsByUser) {
    queries.push(
      db.user.update({
        where: { id: userId },
        data: {
          balance: { increment: totalWin },
          winningAmount: { increment: totalWin },
        },
      })
    );

    queries.push(
      db.walletTransaction.create({
        data: {
          userId: userId,
          type: 'win',
          amount: totalWin,
          status: 'approved',
          adminNote: `Win payout for ${dateStr} on game result ${resultStr}`,
        },
      })
    );
  }

  // 6. EXECUTE ALL QUERIES IN ONE BATCH
  const transactionResults = await withRetry(
    () => db.$transaction(queries),
    { context: 'Admin: declareResult', maxRetries: 3, baseDelay: 500 }
  );

  // The first query in our array was the GameResult creation
  const createdGameResult = transactionResults[0];

  const finalResponse = {
    ...createdGameResult,
    processedBids: pendingBids.length,
    wonCount,
    lostCount,
    totalPayout,
  };

  logger.info('AdminResults', `Result declared for game ${gameIdStr} date ${dateStr} by admin ${session.userId}. Processed ${pendingBids.length} bids (${wonCount} won, ${lostCount} lost)`);
  
  return apiSuccess(
    finalResponse,
    `Result declared for ${dateStr}. Processed ${pendingBids.length} bids (${wonCount} won, ${lostCount} lost)`
  );
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });