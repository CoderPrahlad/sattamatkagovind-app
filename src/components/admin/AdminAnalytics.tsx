'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { safeJsonParse } from '@/lib/fetch';

export default function AdminAnalyticsView() {
  const [data, setData] = useState<{
    revenueChart: { date: string; revenue: number; payout: number; profit: number }[];
    topGames: { id: string; name: string; bidCount: number }[];
    topUsers: { id: string; name: string; mobile: string; bidCount: number }[];
    bidTypeDistribution: { single: number; jodi: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = useGameStore.getState().authToken;
        const res = await fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } });
        const json = await safeJsonParse(res);
        if (json.success) setData(json.data);
      } catch {} finally { setLoading(false); }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-xl bg-gray-800/50" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">Failed to load analytics</p></CardContent></Card>
      </div>
    );
  }

  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Analytics</h2>

      {/* Revenue Chart */}
      <Card className="bg-gray-900 border-emerald-500/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" />Revenue Chart (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '#374151', borderRadius: '8px', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4]} name="Revenue" />
                <Bar dataKey="payout" fill="#ef4444" radius={[4]} name="Payout" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Games */}
        <Card className="bg-gray-900 border-emerald-500/20 hover:border-emerald-500/40 transition-colors duration-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">🏆 Top Games by Bids</h3>
            {data.topGames.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {data.topGames.slice(0, 5).map((g, i) => (
                  <div key={g.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                      <span className="text-sm text-white">{g.name}</span>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">{g.bidCount} bids</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card className="bg-gray-900 border-sky-500/20 hover:border-sky-500/40 transition-colors duration-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">💰 Top Users by Spending</h3>
            {data.topUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {data.topUsers.slice(0, 5).map((u, i) => (
                  <div key={u.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-gray-500">{u.mobile}</p>
                      </div>
                    </div>
                    <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px]">{u.bidCount}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bid Type Distribution */}
        <Card className="bg-gray-900 border-yellow-500/20 hover:border-yellow-500/40 transition-colors duration-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">📊 Bid Type Distribution</h3>
            {data.bidTypeDistribution.total === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            ) : (
              <div className="h-48 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Single', value: data.bidTypeDistribution.single, fill: PIE_COLORS[0] },
                        { name: 'Jodi', value: data.bidTypeDistribution.jodi, fill: PIE_COLORS[1] },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell key="cell-0" fill={PIE_COLORS[0]} />
                      <Cell key="cell-1" fill={PIE_COLORS[1]} />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '#374151', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 space-y-0.5 text-center">
                  <p className="text-xs text-gray-400">Single: {data.bidTypeDistribution.single} ({Math.round(data.bidTypeDistribution.single / data.bidTypeDistribution.total * 100)}%)</p>
                  <p className="text-xs text-gray-400">Jodi: {data.bidTypeDistribution.jodi} ({Math.round(data.bidTypeDistribution.jodi / data.bidTypeDistribution.total * 100)}%)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
