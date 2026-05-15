'use client';

import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import {
  Crown, LogOut, LayoutDashboard, Users, CreditCard,
  Gamepad2, Trophy, Image as ImageIcon, Bell, Settings, Menu, X,
  BarChart3, Headphones, TrendingUp, Activity, Wallet, Gift
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore } from '@/store';
import { ViewBoundary } from '../admin/AdminShared';

// ── Lazy-loaded admin view components ──
const AdminDashboardView = lazy(() => import('../admin/AdminDashboard'));
const AdminUsersView = lazy(() => import('../admin/AdminUsers'));
const AdminWalletView = lazy(() => import('../admin/AdminWallet'));
const AdminGamesView = lazy(() => import('../admin/AdminGames'));
const AdminResultsView = lazy(() => import('../admin/AdminResults'));
const AdminBidsView = lazy(() => import('../admin/AdminBids'));
const AdminTicketsView = lazy(() => import('../admin/AdminTickets'));
const AdminAnalyticsView = lazy(() => import('../admin/AdminAnalytics'));
const AdminBannersView = lazy(() => import('../admin/AdminBanners'));
const AdminNotificationsView = lazy(() => import('../admin/AdminNotifications'));
const AdminConfigView = lazy(() => import('../admin/AdminConfig'));
const AdminReferralsView = lazy(() => import('../admin/AdminReferrals'));

// ── Loading skeleton for Suspense fallback ──
function ViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl bg-gray-800/50" />)}
      </div>
      <Skeleton className="h-64 rounded-xl bg-gray-800/50" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl bg-gray-800/50" />)}
      </div>
    </div>
  );
}

type AdminView =
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-wallet'
  | 'admin-games'
  | 'admin-results'
  | 'admin-banners'
  | 'admin-notifications'
  | 'admin-config'
  | 'admin-bids'
  | 'admin-tickets'
  | 'admin-analytics'
  | 'admin-referrals';

const adminNavItems: { key: AdminView; icon: typeof LayoutDashboard; label: string }[] = [
  { key: 'admin-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'admin-users', icon: Users, label: 'Users' },
  { key: 'admin-wallet', icon: CreditCard, label: 'Wallet' },
  { key: 'admin-games', icon: Gamepad2, label: 'Games' },
  { key: 'admin-results', icon: Trophy, label: 'Results' },
  { key: 'admin-bids', icon: TrendingUp, label: 'Bids' },
  { key: 'admin-tickets', icon: Headphones, label: 'Tickets' },
  { key: 'admin-referrals', icon: Gift, label: 'Referrals' },
  { key: 'admin-analytics', icon: BarChart3, label: 'Analytics' },
  { key: 'admin-banners', icon: ImageIcon, label: 'Banners' },
  { key: 'admin-notifications', icon: Bell, label: 'Alerts' },
  { key: 'admin-config', icon: Settings, label: 'Config' },
];

export default function AdminShell() {
  const { currentView, navigate, logout, fetchAdminDashboard, fetchAdminUsers, fetchAdminWalletRequests, fetchAdminConfigs, fetchGames, fetchAdminBids, fetchAdminTickets, fetchAdminReferrals, setAdminMode } = useGameStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lastKnownPendingIds = useRef<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);

  // Track whether initial data load has completed for each view
  const [viewLoaded, setViewLoaded] = useState<Record<string, boolean>>({});

  const [istTime, setIstTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istDate = new Date(utcMs + 5.5 * 60 * 60 * 1000);
      const h = String(istDate.getHours()).padStart(2, '0');
      const m = String(istDate.getMinutes()).padStart(2, '0');
      const s = String(istDate.getSeconds()).padStart(2, '0');
      setIstTime(`${h}:${m}:${s} IST`);
    };
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const pollPending = async () => {
      try {
        const token = useGameStore.getState().authToken;
        if (!token) return;
        const res = await fetch('/api/admin/wallet?status=pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          const rawData = json.data || [];
          // API may return {transactions: [...]} or [...]
          const pending = Array.isArray(rawData) ? rawData : (rawData.transactions || []);
          const currentIds = new Set(pending.map((t: { id: string }) => t.id));
          const prevIds = lastKnownPendingIds.current;
          const hasNew = !prevIds || [...currentIds].some(id => !prevIds.has(id));
          if (hasNew && prevIds && prevIds.size > 0 && currentIds.size > 0) {
            audioRef.current?.play().catch(() => {});
          }
          lastKnownPendingIds.current = currentIds;
          setPendingCount(currentIds.size);
        }
      } catch {}
    };
    pollPending();
    const id = setInterval(pollPending, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchGames();
    if (currentView === 'admin-dashboard') {
      fetchAdminDashboard().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-dashboard': true })));
    }
    if (currentView === 'admin-users') {
      fetchAdminUsers().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-users': true })));
    }
    if (currentView === 'admin-wallet') {
      fetchAdminWalletRequests().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-wallet': true })));
    }
    if (currentView === 'admin-config') {
      fetchAdminConfigs().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-config': true })));
    }
    if (currentView === 'admin-bids') {
      fetchAdminBids().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-bids': true })));
    }
    if (currentView === 'admin-tickets') {
      fetchAdminTickets().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-tickets': true })));
    }
    if (currentView === 'admin-referrals') {
      fetchAdminReferrals().finally(() => setViewLoaded(prev => ({ ...prev, 'admin-referrals': true })));
    }
  }, [currentView, fetchAdminDashboard, fetchAdminUsers, fetchAdminWalletRequests, fetchAdminConfigs, fetchGames, fetchAdminBids, fetchAdminTickets, fetchAdminReferrals]);

  const handleNavigate = (view: AdminView) => {
    navigate(view);
    setSidebarOpen(false);
  };

  // Determine if current view has completed its initial data load
  const isViewLoaded = viewLoaded[currentView] ?? false;

  const renderAdminView = () => {
    const views: Record<string, React.ReactNode> = {
      'admin-dashboard': <AdminDashboardView />,
      'admin-users': <AdminUsersView loaded={isViewLoaded} />,
      'admin-wallet': <AdminWalletView loaded={isViewLoaded} />,
      'admin-games': <AdminGamesView />,
      'admin-results': <AdminResultsView />,
      'admin-banners': <AdminBannersView />,
      'admin-notifications': <AdminNotificationsView />,
      'admin-config': <AdminConfigView />,
      'admin-bids': <AdminBidsView loaded={isViewLoaded} />,
      'admin-tickets': <AdminTicketsView loaded={isViewLoaded} />,
      'admin-referrals': <AdminReferralsView />,
      'admin-analytics': <AdminAnalyticsView />,
    };
    return (
      <ViewBoundary>
        <Suspense fallback={<ViewSkeleton />}>
          {views[currentView] || <AdminDashboardView />}
        </Suspense>
      </ViewBoundary>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-950 flex">
      <audio ref={audioRef} src="/notification.wav" preload="auto" />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 bg-gray-900 border-r border-gray-800/50 transform transition-transform duration-200 lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800/50 shrink-0">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-emerald-400" />
              <span className="text-lg font-bold text-white tracking-tight">Matka<span className="text-emerald-400">King</span></span>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-4 py-3 flex items-center justify-between shrink-0">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">ADMIN PANEL</Badge>
            <span className="text-[10px] font-mono text-gray-500">{istTime}</span>
          </div>
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {adminNavItems.map((item) => {
              const isActive = currentView === item.key;
              const badge = item.key === 'admin-wallet' && pendingCount > 0 ? pendingCount : 0;
              return (
                <button key={item.key} onClick={() => handleNavigate(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}>
                  <item.icon className="w-4.5 h-4.5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5 animate-pulse">{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-800/50 shrink-0 space-y-1">
            <button onClick={() => setAdminMode(false)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-all">
              <Crown className="w-4.5 h-4.5" /> User App
            </button>
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="w-4.5 h-4.5" /> Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="shrink-0 sticky top-0 z-30 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-gray-300" />
            </button>
            <h1 className="text-base font-semibold text-white">{adminNavItems.find((item) => item.key === currentView)?.label ?? 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-emerald-400 font-medium hidden sm:inline">System Online</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">{istTime}</span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-y-auto">
          <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {renderAdminView()}
          </motion.div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50 lg:hidden">
          <div className="flex items-center justify-around h-16 px-1 overflow-x-auto">
            {adminNavItems.slice(0, 7).map((item) => {
              const isActive = currentView === item.key;
              return (
                <button key={item.key} onClick={() => handleNavigate(item.key)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-150 min-w-[56px] ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                  <item.icon className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </div>
    </div>
  );
}
