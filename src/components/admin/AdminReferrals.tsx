'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Gift, Users, Search, ChevronDown, ChevronUp, CheckCircle2,
  Clock, IndianRupee, UserCheck, Copy
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore, AdminReferralItem, AdminReferralStats } from '@/store';
import { toast } from '@/hooks/use-toast';

export default function AdminReferralsView() {
  const { adminReferrals, adminReferralStats, fetchAdminReferrals, navigate } = useGameStore();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchAdminReferrals().finally(() => setLoading(false));
  }, [fetchAdminReferrals]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      fetchAdminReferrals(search).finally(() => setLoading(false));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, fetchAdminReferrals]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: `Referral code ${code} copied` });
  };

  const stats: AdminReferralStats | null = adminReferralStats;

  if (loading && adminReferrals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl bg-gray-800/50" />)}
        </div>
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-gray-800/50" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-300">Referrers</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalReferrers ?? 0}</p>
            <p className="text-[10px] text-purple-400/70 mt-0.5">Users who referred others</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-300">Referred Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalReferredUsers ?? 0}</p>
            <p className="text-[10px] text-blue-400/70 mt-0.5">Total users referred</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">Bonus Paid</span>
            </div>
            <p className="text-2xl font-bold text-white">₹{(stats?.totalBonusPaid ?? 0).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-emerald-400/70 mt-0.5">Total bonus distributed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-300">1st Recharge Done</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalBonusClaimed ?? 0}</p>
            <p className="text-[10px] text-green-400/70 mt-0.5">Bonus claimed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border-amber-500/20 col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-300">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalBonusPending ?? 0}</p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">Awaiting 1st recharge</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, mobile, or referral code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/25 text-xs px-3 py-1.5 shrink-0 font-semibold">
          {adminReferrals.length} Referrers
        </Badge>
      </div>

      {/* Referral List */}
      {adminReferrals.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-8 text-center">
            <Gift className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No referrals yet</p>
            <p className="text-xs text-gray-600 mt-1">Referral data will appear when users refer others</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto">
          {adminReferrals.map((referrer: AdminReferralItem) => {
            const isExpanded = expandedId === referrer.id;
            return (
              <Card key={referrer.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-200">
                <CardContent className="p-4">
                  {/* Header Row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : referrer.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{referrer.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">
                          {referrer.referralCode}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyCode(referrer.referralCode); }}
                          className="p-0.5 text-gray-500 hover:text-purple-400 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {!referrer.isActive && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/20">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{referrer.mobile}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {/* Quick Stats */}
                      <div className="hidden sm:flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-purple-400">
                          <Users className="w-3 h-3" />
                          <span>{referrer.totalReferred}</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400">
                          <IndianRupee className="w-3 h-3" />
                          <span>₹{referrer.totalBonusEarned.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-400">{referrer.completedReferrals}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-amber-400">{referrer.pendingReferrals}</span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Mobile Quick Stats */}
                  <div className="flex sm:hidden items-center gap-3 text-xs mt-2">
                    <div className="flex items-center gap-1 text-purple-400">
                      <Users className="w-3 h-3" />
                      <span>{referrer.totalReferred} referred</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400">
                      <IndianRupee className="w-3 h-3" />
                      <span>₹{referrer.totalBonusEarned.toLocaleString('en-IN')} earned</span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-800/50 space-y-3">
                      {/* Summary Row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-purple-400">{referrer.totalReferred}</p>
                          <p className="text-[10px] text-gray-500">Total Referred</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-green-400">{referrer.completedReferrals}</p>
                          <p className="text-[10px] text-gray-500">1st Recharge Done</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-amber-400">{referrer.pendingReferrals}</p>
                          <p className="text-[10px] text-gray-500">Pending</p>
                        </div>
                      </div>

                      {/* Referred Users List */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Referred Users
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {referrer.referredUsers.map((u) => (
                            <div key={u.id} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{u.name}</p>
                                <p className="text-[10px] text-gray-500">{u.mobile} • Joined {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] text-gray-500">₹{(u.balance ?? 0).toLocaleString('en-IN')}</span>
                                {u.referralBonusClaimed ? (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Earned
                                  </Badge>
                                ) : (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                    <Clock className="w-2.5 h-2.5 mr-0.5" /> Pending
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bonus Transactions */}
                      {referrer.bonusTransactions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" /> Bonus History
                          </p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {referrer.bonusTransactions.map((tx) => (
                              <div key={tx.id} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-emerald-400">+₹{tx.amount.toLocaleString('en-IN')}</span>
                                  <span className="text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {tx.adminNote && (
                                  <p className="text-[10px] text-gray-400 mt-1">{tx.adminNote}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
