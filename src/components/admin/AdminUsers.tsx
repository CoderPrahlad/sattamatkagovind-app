'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Wallet, UserPlus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from './AdminShared';
import { safeJsonParse } from '@/lib/fetch';

export default function AdminUsersView({ loaded }: { loaded?: boolean }) {
  const { adminUsers, fetchAdminUsers, toggleUser } = useGameStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [balanceUserId, setBalanceUserId] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceOp, setBalanceOp] = useState<'add' | 'subtract'>('add');

  // Debounced search - avoid API call on every keystroke
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchAdminUsers(1, search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, fetchAdminUsers]);

  const filteredUsers = (adminUsers || []).filter(u => {
    if (statusFilter === 'active') return u.isActive;
    if (statusFilter === 'inactive') return !u.isActive;
    return true;
  });

  // Show skeleton while initial data is loading
  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-lg bg-gray-800/50" />
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-gray-800/50" />)}</div>
      </div>
    );
  }

  const handleBalanceAdjust = async (userId: string) => {
    const amt = parseFloat(balanceAmount);
    if (!amt || amt <= 0) return;
    const token = useGameStore.getState().authToken;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceAdjustment: balanceOp === 'add' ? amt : -amt }),
      });
      const json = await safeJsonParse(res);
      if (json.success) {
        toast({ title: 'Updated', description: 'Balance adjusted' });
        fetchAdminUsers(1, search);
        setBalanceUserId(null);
        setBalanceAmount('');
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Search with Total Users Badge */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search users by name or mobile..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50" />
        </div>
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-xs px-3 py-1.5 shrink-0 font-semibold">
          {(adminUsers || []).length} Users
        </Badge>
      </div>
      {/* Status Filter Buttons */}
      <div className="flex gap-2">
        {([
          { key: 'all' as const, label: 'All' },
          { key: 'active' as const, label: 'Active' },
          { key: 'inactive' as const, label: 'Inactive' },
        ]).map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === f.key ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10' : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-800 hover:text-gray-300'}`}>
            {f.label}
            {f.key === 'active' && <span className="ml-1.5 text-[10px] opacity-70">({(adminUsers || []).filter(u => u.isActive).length})</span>}
            {f.key === 'inactive' && <span className="ml-1.5 text-[10px] opacity-70">({(adminUsers || []).filter(u => !u.isActive).length})</span>}
          </button>
        ))}
      </div>
      {filteredUsers.length === 0 && loaded ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><Users className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No users found</p><p className="text-xs text-gray-600 mt-1">New users will appear here when they register</p></CardContent></Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
          {filteredUsers.map((u) => (
            <Card key={u.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{u.name}</p>
                      <StatusBadge status={u.isActive ? 'approved' : 'rejected'} />
                    </div>
                    <p className="text-[11px] text-gray-500">{u.mobile}</p>
                    <p className="text-[11px] text-gray-500">Balance: ₹{(u.balance ?? 0).toLocaleString('en-IN')} &bull; Bids: {u._count?.bids ?? 0} &bull; Txns: {u._count?.transactions ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs h-7 px-2" onClick={() => setBalanceUserId(balanceUserId === u.id ? null : u.id)}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline"
                      className={`text-xs h-7 px-2 ${u.isActive ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
                      onClick={() => toggleUser(u.id, !u.isActive)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
                {balanceUserId === u.id && (
                  <div className="mt-3 pt-3 border-t border-gray-800/50 flex gap-2 items-end">
                    <div className="flex gap-1">
                      <button onClick={() => setBalanceOp('add')} className={`px-2 py-1 rounded text-xs font-medium ${balanceOp === 'add' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}><UserPlus className="w-3 h-3 inline mr-0.5" />Add</button>
                      <button onClick={() => setBalanceOp('subtract')} className={`px-2 py-1 rounded text-xs font-medium ${balanceOp === 'subtract' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}><Minus className="w-3 h-3 inline mr-0.5" />Sub</button>
                    </div>
                    <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Amount" className="flex-1 px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-xs" />
                    <Button size="sm" className="bg-emerald-500 text-white text-xs h-7 px-3" onClick={() => handleBalanceAdjust(u.id)}>Apply</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
