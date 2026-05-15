'use client';

import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';

interface RecentResultItem {
  gameId: string;
  gameName: string;
  result: { id: string; result: string; date: string; declaredAt: string } | null;
}

export default function AdminResultsView() {
  const { games, declareResult, fetchGames } = useGameStore();
  const [selectedGameId, setSelectedGameId] = useState('');
  const [resultNumber, setResultNumber] = useState('');
  const getNowIST = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const [resultDate, setResultDate] = useState(() => {
    const istNow = getNowIST();
    return `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [recentResults, setRecentResults] = useState<RecentResultItem[]>([]);
  const [todayResultsList, setTodayResultsList] = useState<{ gameId: string; gameName: string; openTime: string; closeTime: string; todayResult: { id: string; result: string; date: string; declaredAt: string } | null }[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/games/results');
      const json = await res.json();
      if (json.success && json.data) {
        // New format: { todayResults: [...], recentResults: [...] }
        if (Array.isArray(json.data.todayResults)) {
          setTodayResultsList(json.data.todayResults);
        }
        if (Array.isArray(json.data.recentResults)) {
          setRecentResults(json.data.recentResults);
        }
        // Backward compat: if old format (flat array)
        if (Array.isArray(json.data)) {
          setRecentResults(json.data);
        }
      }
    } catch {} finally { setLoadingRecent(false); }
  };

  useEffect(() => { fetchResults(); }, []);

  const handleSubmit = async () => {
    if (!selectedGameId || !resultNumber.trim()) return;
    setMessage(null);
    setSubmitting(true);
    try {
      await declareResult(selectedGameId, resultNumber.trim(), resultDate);
      setMessage({ type: 'success', text: 'Result declared successfully!' });
      setResultNumber('');
      await fetchResults();
      // Refresh games to update todayResultDeclared/nextDayBiddingAvailable
      fetchGames();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to declare result. Try again.';
      setMessage({ type: 'error', text: msg });
    } finally { setSubmitting(false); }
  };

  // Build today's results list for display from API data
  const todayGamesList = (games || []).map(g => {
    const apiToday = todayResultsList.find(t => t.gameId === g.id);
    return {
      game: g,
      todayResult: apiToday?.todayResult
        ? { result: { id: apiToday.todayResult.id, result: apiToday.todayResult.result, date: apiToday.todayResult.date, declaredAt: apiToday.todayResult.declaredAt } }
        : null,
    };
  });

  const hasTodayResults = todayGamesList.some(g => g.todayResult !== null);

  return (
    <div className="space-y-6">
      {/* Declare Result Form */}
      <Card className="bg-gray-900 border-emerald-500/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4"><Trophy className="w-5 h-5 text-yellow-400" /><h3 className="text-base font-semibold text-white">Declare Result</h3></div>
          {message && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>{message.text}</div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Select Game</label>
              <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                <option value="">-- Choose a game --</option>
                {(games || []).map((g) => <option key={g.id} value={g.id}>{g.name} (Closing: {g.openTime} - {g.closeTime})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Result Number</label>
              <input type="text" value={resultNumber} onChange={(e) => setResultNumber(e.target.value)} placeholder="Enter result (e.g. 5 or 23)"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-1 block">Date</label>
              <input type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white mt-1" disabled={submitting || !selectedGameId || !resultNumber.trim()} onClick={handleSubmit}>
              {submitting ? 'Declaring...' : 'Declare Result'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Results */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" />Today's Results</h3>
          <Badge className="bg-gray-800 text-gray-400 text-[11px]">{todayGamesList.filter(g => g.todayResult !== null).length}/{(games || []).length} declared</Badge>
        </div>
        {/* Declaration Progress Bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-yellow-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(games || []).length > 0 ? Math.round((todayGamesList.filter(g => g.todayResult !== null).length / (games || []).length) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 font-medium tabular-nums min-w-[36px] text-right">{(games || []).length > 0 ? Math.round((todayGamesList.filter(g => g.todayResult !== null).length / (games || []).length) * 100) : 0}%</span>
        </div>
        {(games || []).length === 0 ? (
          <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-sm text-gray-500">No games configured</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayGamesList.map(({ game, todayResult }) => (
              <Card key={game.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{game.name}</p>
                    <p className="text-[10px] text-gray-500">{game.openTime} - {game.closeTime} IST</p>
                    {todayResult?.result?.declaredAt && (
                      <p className="text-[10px] text-gray-600">Declared: {new Date(todayResult.result.declaredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>
                  {todayResult?.result ? (
                    <span className="text-xl font-extrabold text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/20 shrink-0">{todayResult.result.result}</span>
                  ) : (
                    <Badge className="bg-gray-800 text-gray-500 border-gray-700 text-[10px] shrink-0">Waiting</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Results History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">Recent Results History</h3>
          <Badge className="bg-gray-800 text-gray-400 text-[11px]">{recentResults.filter(r => r.result !== null).length} entries</Badge>
        </div>
        {loadingRecent ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-gray-800/50" />)}</div>
        ) : recentResults.filter(r => r.result !== null).length === 0 ? (
          <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-sm text-gray-500">No results declared yet</p></CardContent></Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(recentResults.filter(r => r.result !== null)).map((r) => (
              <Card key={r.gameId + '-' + (r.result?.date ?? 'none')} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{r.gameName}</p>
                      <p className="text-[11px] text-gray-500">{r.result?.date ? new Date(r.result.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}</p>
                      {r.result?.declaredAt && (
                        <p className="text-[10px] text-gray-600">at {new Date(r.result.declaredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                    </div>
                    {r.result && (
                      <span className="text-xl font-extrabold text-yellow-400 bg-yellow-500/10 px-4 py-1 rounded-lg border border-yellow-500/20">{r.result.result}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
