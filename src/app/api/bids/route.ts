import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getTodayIST, getTomorrowIST, isInClosingWindow } from '@/lib/time';

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { gameId, bidType, number, amount } = body;

    // Validate required fields
    if (!gameId || !bidType || !number || !amount) {
      return NextResponse.json(
        { success: false, error: 'gameId, bidType, number, and amount are required' },
        { status: 400 }
      );
    }

    // Validate bidType
    if (bidType !== 'single' && bidType !== 'jodi') {
      return NextResponse.json(
        { success: false, error: 'bidType must be "single" or "jodi"' },
        { status: 400 }
      );
    }

    // Validate number format
    if (bidType === 'single') {
      const num = parseInt(number, 10);
      if (isNaN(num) || num < 0 || num > 9 || number.length > 1) {
        return NextResponse.json(
          { success: false, error: 'Single bid number must be 0-9' },
          { status: 400 }
        );
      }
    } else {
      const num = parseInt(number, 10);
      if (isNaN(num) || num < 0 || num > 99 || number.length > 2) {
        return NextResponse.json(
          { success: false, error: 'Jodi bid number must be 00-99' },
          { status: 400 }
        );
      }
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a number greater than 0' },
        { status: 400 }
      );
    }

    // Check max bid amount from config
    const maxBidConfig = await db.gameConfig.findUnique({
      where: { key: 'max_bid_amount' },
    });
    const maxBidAmount = maxBidConfig ? parseFloat(maxBidConfig.value) : 10000;

    if (amount > maxBidAmount) {
      return NextResponse.json(
        { success: false, error: `Maximum bid amount is ₹${maxBidAmount}` },
        { status: 400 }
      );
    }

    // Check game exists and is accepting bids
    const game = await db.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    if (!game.isOpen) {
      return NextResponse.json(
        { success: false, error: 'Game is currently closed' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { success: false, error: 'Next-day bidding is not available yet. It opens after the result is declared or during the closing window.' },
          { status: 400 }
        );
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

    return NextResponse.json({
      success: true,
      data: result,
      message: resolvedTargetDate === today
        ? 'Bid placed successfully'
        : `Bid placed for ${resolvedTargetDate}`,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
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
    console.error('Bid creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to place bid' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
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

    return NextResponse.json({
      success: true,
      data: bids,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Bids fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}
