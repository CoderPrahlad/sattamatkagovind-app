'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Download, Smartphone, Eye, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { StatusBadge } from './AdminShared';

export default function AdminWalletView({ loaded: viewLoaded }: { loaded?: boolean }) {
  const { adminWalletRequests, approveRejectWallet, fetchAdminWalletRequests } = useGameStore();
  const [filter, setFilter] = useState<string>('pending');
  const [walletTab, setWalletTab] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [screenshotModal, setScreenshotModal] = useState<{ url: string; name: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; userName: string } | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    fetchAdminWalletRequests({ status: filter || undefined });
  }, [filter, fetchAdminWalletRequests]);

  const walletList = adminWalletRequests || [];

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (walletList.length >= 0) isFirstLoad.current = false;
  }, [walletList]);

  if (!viewLoaded) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl bg-gray-800/50" />)}</div>
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-gray-800/50" />)}</div>
      </div>
    );
  }
  const filteredByTab = walletTab === 'all' ? walletList : walletList.filter(t => t.type === walletTab);
  const pendingDeposits = walletList.filter(t => t.type === 'deposit' && t.status === 'pending').length;
  const pendingWithdrawals = walletList.filter(t => t.type === 'withdrawal' && t.status === 'pending').length;
  const totalDeposits = walletList.filter(t => t.type === 'deposit').length;
  const totalWithdrawals = walletList.filter(t => t.type === 'withdrawal').length;

  const handleApplyFilters = () => {
    fetchAdminWalletRequests({
      status: filter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const handleAction = async (id: string, status: string, adminNote?: string) => {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set([...prev, id]));
    await approveRejectWallet(id, status, adminNote);
    setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleRejectClick = (id: string, userName: string) => {
    setRejectComment('');
    setRejectModal({ id, userName });
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    await handleAction(rejectModal.id, 'rejected', rejectComment.trim() || undefined);
    setRejectModal(null);
  };

  const handleDownloadScreenshot = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'screenshot.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40 transition-colors duration-200">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-yellow-400">{pendingDeposits}</p>
            <p className="text-[10px] text-gray-500">Pending Deposits</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40 transition-colors duration-200">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-orange-400">{pendingWithdrawals}</p>
            <p className="text-[10px] text-gray-500">Pending Withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Deposit / Withdrawal Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'all' as const, label: 'All' },
          { key: 'deposit' as const, label: 'Deposit' },
          { key: 'withdrawal' as const, label: 'Withdrawal' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setWalletTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              walletTab === tab.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-800'
            }`}>
            {tab.label}
            {tab.key === 'deposit' && <span className="ml-1.5 text-[10px] opacity-70">({totalDeposits})</span>}
            {tab.key === 'withdrawal' && <span className="ml-1.5 text-[10px] opacity-70">({totalWithdrawals})</span>}
          </button>
        ))}
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected'].map((status) => (
          <button key={status} onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === status ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-800'}`}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All Status'}
          </button>
        ))}
      </div>

      <Card className="bg-gray-900 border-gray-800/50">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs" />
            </div>
            <Button size="sm" className="bg-emerald-500 text-white text-xs" onClick={handleApplyFilters}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      {isFirstLoad && walletList.length === 0 ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-gray-800/50" />)}</div>
      ) : filteredByTab.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50"><CardContent className="p-8 text-center"><CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No {filter || ''} {walletTab !== 'all' ? walletTab : ''} transactions</p><p className="text-xs text-gray-600 mt-1">Adjust filters to see more results</p></CardContent></Card>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
          {filteredByTab.map((tx) => (
            <Card key={tx.id} className="bg-gray-900 border-gray-800/50 hover:border-gray-700/50 transition-colors duration-150">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{tx.user.name}</p><StatusBadge status={tx.status} /></div>
                    <p className="text-[11px] text-gray-500">{tx.user.mobile}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{tx.type} &bull; ₹{Math.abs(tx.amount).toLocaleString('en-IN')}</p>

                    {/* Bank/UPI details for withdrawals */}
                    {tx.type === 'withdrawal' && tx.bankAccount && (
                      <div className="mt-2 bg-gray-800/30 rounded-lg p-2 space-y-0.5">
                        <p className="text-[10px] text-gray-500 font-medium">Payment Details:</p>
                        {tx.bankAccount && <p className="text-[10px] text-gray-400">Bank: {tx.bankAccount}</p>}
                      </div>
                    )}
                    {tx.upiNumber && (
                      <div className="mt-1 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-gray-500" />
                        <p className="text-[10px] text-gray-400">UPI: {tx.upiNumber}</p>
                      </div>
                    )}

                    {/* UTR Number for deposits */}
                    {tx.type === 'deposit' && tx.utrNumber && (
                      <div className="mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-500" />
                        <p className="text-[10px] text-emerald-400 font-medium">UTR: {tx.utrNumber}</p>
                      </div>
                    )}

                    {/* Screenshot for deposits */}
                    {tx.type === 'deposit' && tx.screenshotUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => setScreenshotModal({ url: tx.screenshotUrl!.replace(/^\/uploads\//, '/api/uploads/'), name: `${tx.user.name}_screenshot` })}
                          className="group relative"
                        >
                          <img
                            src={tx.screenshotUrl.replace(/^\/uploads\//, '/api/uploads/')}
                            alt="Payment screenshot"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-700 group-hover:border-emerald-500/40 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDownloadScreenshot(tx.screenshotUrl!.replace(/^\/uploads\//, '/api/uploads/'), `${tx.user.name}_screenshot.png`)}
                            className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
                            title="Download screenshot"
                          >
                            <Download className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show admin rejection note for rejected transactions */}
                    {tx.status === 'rejected' && tx.adminNote && (
                      <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                        <p className="text-[10px] text-red-400 font-medium">Reason: {tx.adminNote}</p>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-600 mt-1">{new Date(tx.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  {tx.status === 'pending' && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs h-7 px-3" disabled={processingIds.has(tx.id)}
                        onClick={() => handleAction(tx.id, 'approved')}>
                        {processingIds.has(tx.id) ? '...' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs h-7 px-3 hover:bg-red-500/10" disabled={processingIds.has(tx.id)}
                        onClick={() => handleRejectClick(tx.id, tx.user.name)}>
                        {processingIds.has(tx.id) ? '...' : 'Reject'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rejection Comment Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="relative w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-sm font-bold">!</div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Reject Request</h3>
                    <p className="text-[10px] text-gray-500">{rejectModal.userName}</p>
                  </div>
                </div>
                <button onClick={() => setRejectModal(null)} className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">Rejection Reason <span className="text-gray-600">(optional)</span></label>
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="e.g. Screenshot not clear, UTR not found, Amount mismatch..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-gray-700 text-gray-400 text-sm" onClick={() => setRejectModal(null)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-red-500 hover:bg-red-400 text-white text-sm" onClick={handleRejectConfirm}>
                    Reject Request
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {screenshotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setScreenshotModal(null)}>
          <div className="relative max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-3 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Payment Screenshot</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadScreenshot(screenshotModal.url, `${screenshotModal.name}.png`)}
                    className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setScreenshotModal(null)}
                    className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <img
                  src={screenshotModal.url}
                  alt="Full screenshot"
                  className="w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
