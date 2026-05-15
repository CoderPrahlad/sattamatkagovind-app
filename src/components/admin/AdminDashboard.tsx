'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, Activity, TrendingUp, TrendingDown, Gamepad2,
  Plus, Trophy, Bell, Wallet, ArrowUpRight, Clock, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { StatusBadge } from './AdminShared';

export default function AdminDashboardView() {
  const { adminStats, navigate, games } = useGameStore();
  const stats = adminStats;

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl bg-gray-800/50" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl bg-gray-800/50" />)}
        </div>
        <Skeleton className="h-64 rounded-xl bg-gray-800/50" />
      </div>
    );
  }

  const safeStats = {
    users: stats.users || { total: 0, active: 0 },
    bids: stats.bids || { today: 0, pending: 0 },
    revenue: stats.revenue || 0,
    payouts: stats.payouts || 0,
    profit: stats.profit || 0,
    pendingDeposits: stats.pendingDeposits || 0,
    pendingWithdrawals: stats.pendingWithdrawals || 0,
    recentActivity: Array.isArray(stats.recentActivity) ? stats.recentActivity : [],
  };

  const statCards = [
    { label: 'Total Users', value: safeStats.users.total, sub: `${safeStats.users.active} active`, color: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-600/5', border: 'border-emerald-500/20', icon: Users },
    { label: "Today's Bids", value: safeStats.bids.today, sub: `${safeStats.bids.pending} pending`, color: 'text-sky-400', bg: 'from-sky-500/15 to-sky-600/5', border: 'border-sky-500/20', icon: Activity },
    { label: 'Revenue', value: `₹${safeStats.revenue.toLocaleString('en-IN')}`, sub: 'Total bid amounts', color: 'text-yellow-400', bg: 'from-yellow-500/15 to-amber-600/5', border: 'border-yellow-500/20', icon: TrendingUp },
    { label: 'Profit', value: `₹${safeStats.profit.toLocaleString('en-IN')}`, sub: `Payouts: ₹${safeStats.payouts.toLocaleString('en-IN')}`, color: safeStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400', bg: safeStats.profit >= 0 ? 'from-emerald-500/15 to-emerald-600/5' : 'from-red-500/15 to-red-600/5', border: safeStats.profit >= 0 ? 'border-emerald-500/20' : 'border-red-500/20', icon: safeStats.profit >= 0 ? TrendingUp : TrendingDown },
  ];

  const activeGamesCount = (games || []).filter(g => g.isOpen).length;

  return (
    <div className="space-y-6">
      {/* ── Hero Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: safeStats.users.total.toLocaleString('en-IN'), icon: Users, borderColor: 'border-l-emerald-500', bgGrad: 'from-emerald-500/10 to-emerald-600/5', textColor: 'text-emerald-400', iconBg: 'bg-emerald-500/15' },
          { label: "Today's Bids", value: safeStats.bids.today.toLocaleString('en-IN'), icon: Activity, borderColor: 'border-l-blue-500', bgGrad: 'from-blue-500/10 to-blue-600/5', textColor: 'text-blue-400', iconBg: 'bg-blue-500/15' },
          { label: "Today's Revenue", value: `\u20B9${safeStats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, borderColor: 'border-l-yellow-500', bgGrad: 'from-yellow-500/10 to-yellow-600/5', textColor: 'text-yellow-400', iconBg: 'bg-yellow-500/15' },
          { label: 'Active Games', value: activeGamesCount, icon: Gamepad2, borderColor: 'border-l-purple-500', bgGrad: 'from-purple-500/10 to-purple-600/5', textColor: 'text-purple-400', iconBg: 'bg-purple-500/15' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <Card className={`bg-gradient-to-br ${card.bgGrad} border-l-4 ${card.borderColor} border border-gray-800/30 hover:shadow-lg hover:shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 cursor-default`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                    <card.icon className={`w-5 h-5 ${card.textColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{card.label}</p>
                    <p className={`text-lg font-bold ${card.textColor} truncate`}>{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Quick Actions Bar ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => navigate('admin-games')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all whitespace-nowrap hover:shadow-md hover:shadow-emerald-500/10">
          <Plus className="w-4 h-4" /> Add Game
        </button>
        <button onClick={() => navigate('admin-results')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all whitespace-nowrap hover:shadow-md hover:shadow-yellow-500/10">
          <Trophy className="w-4 h-4" /> Declare Result
        </button>
        <button onClick={() => navigate('admin-notifications')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/20 hover:border-blue-500/40 transition-all whitespace-nowrap hover:shadow-md hover:shadow-blue-500/10">
          <Bell className="w-4 h-4" /> Send Notification
        </button>
        <button onClick={() => navigate('admin-wallet')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/20 hover:border-orange-500/40 transition-all whitespace-nowrap hover:shadow-md hover:shadow-orange-500/10">
          <Wallet className="w-4 h-4" /> Pending Wallet
        </button>
      </div>

      {/* ── Existing Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className={`bg-gradient-to-br ${card.bg} ${card.border}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{card.label}</p>
                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center"><card.icon className={`w-4 h-4 ${card.color}`} /></div>
              </div>
              <p className={`text-2xl font-bold ${card.color} mt-2`}>{card.value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-gray-900 border-yellow-500/20 cursor-pointer hover:border-yellow-500/40 transition-colors" onClick={() => navigate('admin-wallet')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-yellow-400" /></div>
                <h3 className="text-sm font-semibold text-white">Pending Deposits</h3>
              </div>
              {safeStats.pendingDeposits > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-semibold">{safeStats.pendingDeposits}</Badge>}
            </div>
            {safeStats.pendingDeposits === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>All caught up!</span></div>
            ) : (
              <button className="w-full px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold"><Wallet className="w-4 h-4 mr-2 inline" />Review {safeStats.pendingDeposits} Deposit{safeStats.pendingDeposits > 1 ? 's' : ''}</button>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors" onClick={() => navigate('admin-wallet')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center"><Wallet className="w-4 h-4 text-orange-400" /></div>
                <h3 className="text-sm font-semibold text-white">Pending Withdrawals</h3>
              </div>
              {safeStats.pendingWithdrawals > 0 && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-semibold">{safeStats.pendingWithdrawals}</Badge>}
            </div>
            {safeStats.pendingWithdrawals === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>All caught up!</span></div>
            ) : (
              <button className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold"><Wallet className="w-4 h-4 mr-2 inline" />Review {safeStats.pendingWithdrawals} Withdrawal{safeStats.pendingWithdrawals > 1 ? 's' : ''}</button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500" />Recent Activity</h3>
            <span className="text-[11px] text-gray-500">Last 10 bids</span>
          </div>
          {(safeStats.recentActivity || []).length === 0 ? (
            <div className="text-center py-6"><Activity className="w-8 h-8 text-gray-700 mx-auto mb-2" /><p className="text-sm text-gray-500">No recent activity</p></div>
          ) : (
            <div className="space-y-0 max-h-80 overflow-y-auto">
              {safeStats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-800/30 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${activity.status === 'won' ? 'bg-emerald-500/15' : activity.status === 'lost' ? 'bg-red-500/10' : 'bg-gray-800'}`}>
                      <Gamepad2 className={`w-4 h-4 ${activity.status === 'won' ? 'text-emerald-400' : activity.status === 'lost' ? 'text-red-400' : 'text-gray-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{activity.user?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-gray-500 truncate">{activity.game?.name || 'Game'} &bull; {activity.bidType} &bull; #{activity.number} &bull; ₹{activity.amount}</p>
                    </div>
                  </div>
                  <StatusBadge status={activity.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
