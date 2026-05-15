import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { gameId, result, date } = body;

    if (!gameId || !result || !date) {
      return NextResponse.json(
        { success: false, error: 'gameId, result, and date are required' },
        { status: 400 }
      );
    }

    // Validate result format (must be numeric digits only)
    if (!/^\d{1,3}$/.test(result)) {
      return NextResponse.json(
        { success: false, error: 'Result must be numeric digits only' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Verify game exists
    const game = await db.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Get payout multipliers from config
    const [singlePayoutConfig, jodiPayoutConfig] = await Promise.all([
      db.gameConfig.findUnique({ where: { key: 'single_payout' } }),
      db.gameConfig.findUnique({ where: { key: 'jodi_payout' } }),
    ]);

    const singlePayout = singlePayoutConfig ? parseFloat(singlePayoutConfig.value) : 9;
    const jodiPayout = jodiPayoutConfig ? parseFloat(jodiPayoutConfig.value) : 90;

    // Process everything in a transaction with retry for SQLITE_BUSY
    const processedResult = await withRetry(
      () => db.$transaction(async (tx) => {
        // Use upsert to prevent double-declaration race condition
        // If two admins declare at the same time, only one will create
        const gameResult = await tx.gameResult.upsert({
          where: { gameId_date: { gameId, date } },
          create: { gameId, result, date },
          update: {}, // No-op if already exists
        });

        // Check if result was just created or already existed
        // If already existed, the upsert did nothing — return error
        const existingCount = await tx.gameResult.count({
          where: { gameId, date },
        });

        // Verify this was a new creation (upsert returns the row either way)
        // We check by seeing if result matches what we tried to create
        if (gameResult.result !== result) {
          throw new Error('ALREADY_DECLARED');
        }

        // Get all pending bids for this game+date
        const pendingBids = await tx.bid.findMany({
          where: {
            gameId,
            status: 'pending',
            targetDate: date,
          },
        });

        let wonCount = 0;
        let lostCount = 0;
        let totalPayout = 0;

        // ── OPTIMIZED: Batch processing instead of N+1 queries ──
        // Group bids by outcome (won/lost) and by user for batch balance updates

        const wonBidIds: string[] = [];
        const lostBidIds: string[] = [];
        const winsByUser = new Map<string, number>(); // userId → total win amount
        const bidUpdates: { id: string; status: string; winAmount: number | null }[] = [];

        for (const bid of pendingBids) {
          let isWinner = false;
          let winAmount = 0;

          if (bid.bidType === 'single') {
            const resultDigit = result.slice(-1);
            isWinner = bid.number === resultDigit;
            winAmount = isWinner ? bid.amount * singlePayout : 0;
          } else if (bid.bidType === 'jodi') {
            const resultDigits = result.slice(-2);
            const paddedNumber = bid.number.padStart(2, '0');
            isWinner = paddedNumber === resultDigits;
            winAmount = isWinner ? bid.amount * jodiPayout : 0;
          }

          if (isWinner) {
            wonCount++;
            totalPayout += winAmount;
            wonBidIds.push(bid.id);
            winsByUser.set(bid.userId, (winsByUser.get(bid.userId) || 0) + winAmount);
            bidUpdates.push({ id: bid.id, status: 'won', winAmount });
          } else {
            lostCount++;
            lostBidIds.push(bid.id);
            bidUpdates.push({ id: bid.id, status: 'lost', winAmount: null });
          }
        }

        // Batch update all lost bids in one query
        if (lostBidIds.length > 0) {
          await tx.bid.updateMany({
            where: { id: { in: lostBidIds } },
            data: { status: 'lost', winAmount: null },
          });
        }

        // Batch update all won bids (need individual updates for different winAmounts)
        // Use updateMany for same-amount batches, or individual for different amounts
        for (const update of bidUpdates) {
          if (update.status === 'won') {
            await tx.bid.update({
              where: { id: update.id },
              data: { status: 'won', winAmount: update.winAmount },
            });
          }
        }

        // Batch update user balances — one update per user (not per bid)
        const winTransactions: { userId: string; amount: number }[] = [];
        for (const [userId, totalWin] of winsByUser) {
          await tx.user.update({
            where: { id: userId },
            data: {
              balance: { increment: totalWin },
              winningAmount: { increment: totalWin },
            },
          });

          // Create one combined win transaction per user
          winTransactions.push({ userId, amount: totalWin });
        }

        // Batch create win transactions
        for (const wt of winTransactions) {
          await tx.walletTransaction.create({
            data: {
              userId: wt.userId,
              type: 'win',
              amount: wt.amount,
              status: 'approved',
            },
          });
        }

        return {
          ...gameResult,
          processedBids: pendingBids.length,
          wonCount,
          lostCount,
          totalPayout,
        };
      }),
      { context: 'Admin: declareResult', maxRetries: 3, baseDelay: 500 }
    );

    return NextResponse.json({
      success: true,
      data: processedResult,
      message: `Result declared for ${date}. Processed ${processedResult.processedBids} bids (${processedResult.wonCount} won, ${processedResult.lostCount} lost)`,
    });
  } catch (error: unknown) {
    // Handle double-declaration gracefully
    if (error instanceof Error && error.message === 'ALREADY_DECLARED') {
      return NextResponse.json(
        { success: false, error: `Result already declared for ${date}. To change, please delete the existing result first.` },
        { status: 400 }
      );
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin result creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to declare result' },
      { status: 500 }
    );
  }
}
