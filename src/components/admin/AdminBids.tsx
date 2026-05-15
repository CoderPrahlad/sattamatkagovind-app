'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from './AdminShared';

export default function AdminBidsView({ loaded }: { loaded?: boolean }) {
  const { adminBids, adminBidsSummary, bidFilterGameId, fetchAdminBids, games } = useGameStore();

  // Compute today/tomorrow for next-day badge (toISOString is UTC, use manual formatting)
  const getNowIST = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const istNow = getNowIST();
  const todayStr = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
  const tomorrowDate = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  const [filters, setFilters] = useState({ status: '', gameId: '', dateFrom: '', dateTo: '', userSearch: '', targetDate: '' });
  const [exporting, setExporting] = useState(false);

  // Use bidFilterGameId from store (set when navigating from Games view) directly in the fetch
  const effectiveGameId = filters.gameId || bidFilterGameId || '';

  useEffect(() => {
    const hasFilters = filters.status || effectiveGameId || filters.dateFrom || filters.dateTo || filters.targetDate;
    fetchAdminBids(hasFilters ? { ...filters, gameId: effectiveGameId } : undefined);
  }, [filters.status, effectiveGameId, filters.dateFrom, filters.dateTo, filters.targetDate, fetchAdminBids]);

  const bids = adminBids || [];

  // Show skeleton while initial data is loading
  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-lg bg-gray-800/50" />
        <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-gray-800/50" />)}</div>
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-gray-800/50" />)}</div>
      </div>
    );
  }

  // Client-side filter by userSearch
  const filteredBids = bids.filter((bid) => {
    if (!filters.userSearch) return true;
    const q = filters.userSearch.toLowerCase();
    return (
      bid.user?.name?.toLowerCase().includes(q) ||
      bid.user?.mobile?.includes(q)
    );
  });

  const handleExport = async (format: string) => {
    setExporting(true);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.gameId) params.set('gameId', filters.gameId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.targetDate) params.set('targetDate', filters.targetDate);
    if (format) params.set('format', format);
    const query = params.toString() ? `?${params.toString()}` : '';
    const token = useGameStore.getState().authToken;
    try {
      const res = await fetch(`/api/admin/bids/export${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        // Try to read error message
        let errMsg = 'Export failed';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch { errMsg = `Server error (${res.status})`; }
        toast({ title: 'Export Failed', description: errMsg, variant: 'destructive' });
        return;
      }
      // Check content type to handle error JSON vs binary blob
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const errData = await res.json();
          toast({ title: 'Export Failed', description: errData.error || 'Unknown error', variant: 'destructive' });
          return;
        } catch { /* fall through */ }
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        toast({ title: 'Export Failed', description: 'Empty file received', variant: 'destructive' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bids_export_${new Date().toISOString().split('T')[0]}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export Complete', description: `${bids.length} bids exported as ${format.toUpperCase()}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not download file. Please try again.';
      toast({ title: 'Export Failed', description: message, variant: 'destructive' });
    }
    finally { setExporting(false); }
  };

  const s = adminBidsSummary;

  return (
    <div className="space-y-4">
      {/* Top Export Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Bid Management</span>
          {bids.length > 0 && <Badge className="bg-gray-800 text-gray-400 text-[10px]">{bids.length} bids</Badge>}
        </div>
        <Button size="sm" variant="outline" className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10 text-xs" onClick={() => handleExport('csv')} disabled={exporting}>
          <Download className={`w-3.5 h-3.5 mr-1.5 ${exporting ? 'animate-pulse' : ''}`} /> {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>
      {s && (
        <div className="grid grid-cols-3 lg:grid-cols-7 gap-2">
          {[
            { label: 'Total Bids', value: s.totalBids, color: 'text-white' },
            { label: 'Total Amount', value: `₹${s.totalAmount.toLocaleString('en-IN')}`, color: 'text-yellow-400' },
            { label: 'Won', value: s.wonBids, color: 'text-emerald-400' },
            { label: 'Lost', value: s.lostBids, color: 'text-red-400' },
            { label: 'Pending', value: s.pendingBids, color: 'text-sky-400' },
            { label: 'Payout', value: `₹${s.totalPayout.toLocaleString('en-IN')}`, color: 'text-orange-400' },
            { label: 'Profit', value: `₹${(s.totalAmount - s.totalPayout).toLocaleString('en-IN')}`, color: (s.totalAmount - s.totalPayout) >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map((c) => (
            <Card key={c.label} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
              <CardContent className="p-3 text-center">
                <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input type="text" value={filters.userSearch} onChange={(e) => setFilters({ ...filters, userSearch: e.target.value })} placeholder="Search user..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">Game</label>
              <select value={filters.gameId} onChange={(e) => setFilters({ ...filters, gameId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
                <option value="">All Games</option>
                {(games || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">Target Date</label>
              <select value={filters.targetDate} onChange={(e) => setFilters({ ...filters, targetDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
                <option value="">All Dates</option>
                <option value={todayStr}>Today</option>
                <option value={tomorrowStr}>Tomorrow</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
            </div>
            <div className="min-w-[120px]">
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => handleExport('xlsx')}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredBids.length === 0 && loaded ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No bids found</p><p className="text-xs text-gray-600 mt-1">Try adjusting your filters</p></CardContent></Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {(filteredBids || []).map((bid) => (
            <Card key={bid.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${bid.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' : bid.status === 'lost' ? 'bg-red-500/10 text-red-400' : 'bg-gray-800 text-gray-300'}`}>
                    {bid.number}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {bid.user?.name || 'Unknown'} <span className="text-gray-500 font-normal">({bid.user?.mobile || 'N/A'})</span>
                      {bid.targetDate && bid.targetDate > todayStr && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/25">NEXT DAY</span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500">{bid.game?.name || 'Game'} &bull; <span className="capitalize">{bid.bidType}</span> &bull; #{bid.number} &bull; ₹{bid.amount}{bid.winAmount ? ` &bull; Won ₹${bid.winAmount}` : ''}</p>
                    <p className="text-[10px] text-gray-600">{bid.targetDate ? `Bid for ${bid.targetDate}` : ''} &bull; Placed: {new Date(bid.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <StatusBadge status={bid.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
