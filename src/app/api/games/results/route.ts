import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTodayIST } from '@/lib/time';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const daysParam = searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90);

    if (!gameId) {
      const today = getTodayIST();

      // Fetch all games with today's result
      const games = await db.game.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          results: {
            where: { date: today },
            take: 1,
          },
        },
      });

      // Today's results per game (null = waiting)
      const todayResults = games.map(game => ({
        gameId: game.id,
        gameName: game.name,
        openTime: game.openTime,
        closeTime: game.closeTime,
        todayResult: game.results.length > 0
          ? { id: game.results[0].id, result: game.results[0].result, date: game.results[0].date, declaredAt: game.results[0].declaredAt.toISOString() }
          : null,
      }));

      // Recent results history (last 30 days, all games, ordered by date desc)
      const thirtyDaysAgo = new Date(today + 'T00:00:00Z');
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const recentResults = await db.gameResult.findMany({
        where: { date: { gte: startDateStr, lte: today } },
        include: { game: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { declaredAt: 'desc' }],
        take: 50,
      });

      const recentList = recentResults.map(r => ({
        gameId: r.game.id,
        gameName: r.game.name,
        result: { id: r.id, result: r.result, date: r.date, declaredAt: r.declaredAt.toISOString() },
      }));

      return NextResponse.json({
        success: true,
        data: {
          todayResults,
          recentResults: recentList,
        },
      });
    }

    // Return results for specific game with full date range
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: { id: true, name: true },
    });

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Build the full date range (today going back N days) using IST
    const today = getTodayIST();
    const todayDate = new Date(today + 'T00:00:00Z');
    const daysArray: { date: string; result: { id: string; result: string; declaredAt: string; status: string } | null }[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      daysArray.push({ date: dateStr, result: null });
    }

    // Fetch all results for this game in the date range
    const startDate = daysArray[daysArray.length - 1].date;
    const results = await db.gameResult.findMany({
      where: {
        gameId,
        date: { gte: startDate, lte: today },
      },
      orderBy: { date: 'desc' },
    });

    // Build a map of date -> result
    const resultMap = new Map<string, { id: string; result: string; declaredAt: string; status: string }>();
    for (const r of results) {
      resultMap.set(r.date, {
        id: r.id,
        result: r.result,
        declaredAt: r.declaredAt.toISOString(),
        status: 'declared',
      });
    }

    // Fill in the results — today's result first, then previous days
    // For dates without results, return status "waiting"
    const filledDays = daysArray.map(day => {
      const existing = resultMap.get(day.date);
      if (existing) {
        return { date: day.date, result: existing };
      }
      // No result yet — return null so old cached JS also shows "Waiting"
      return {
        date: day.date,
        result: null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        gameName: game.name,
        days: filledDays,
        results: results, // Also include raw results for backward compat
      },
    });
  } catch (error: unknown) {
    console.error('Game results error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
