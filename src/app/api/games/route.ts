import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTodayIST, getTomorrowIST, isInClosingWindow } from '@/lib/time';

export async function GET() {
  try {
    const today = getTodayIST();

    const games = await db.game.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        results: {
          where: { date: today },
          take: 1,
        },
      },
    });

    // Compute tomorrow's date in IST
    const tomorrow = getTomorrowIST();

    const gamesWithStatus = games.map((game) => {
      const todayResultDeclared = game.results.length > 0;
      // Bidding is OPEN when game is active AND NOT in closing window AND result not declared
      const isCurrentlyClosed = isInClosingWindow(game.openTime, game.closeTime);
      const isAcceptingBids = game.isOpen && !isCurrentlyClosed && !todayResultDeclared;

      return {
        id: game.id,
        name: game.name,
        // openTime repurposed as closeFrom, closeTime as closeUntil
        closeFrom: game.openTime,
        closeUntil: game.closeTime,
        openTime: game.openTime,
        closeTime: game.closeTime,
        isOpen: game.isOpen,
        sortOrder: game.sortOrder,
        isAcceptingBids,
        isCurrentlyClosed,
        todayResult: game.results.length > 0 ? game.results[0] : null,
        todayResultDeclared,
        nextDayBiddingAvailable: game.isOpen && todayResultDeclared,
        nextDayDate: tomorrow,
      };
    });

    return NextResponse.json({
      success: true,
      data: gamesWithStatus,
    });
  } catch (error: unknown) {
    console.error('Games error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}
