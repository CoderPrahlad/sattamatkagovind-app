'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Crown, Bell, Wallet, Home, Gamepad2, Ticket,
  User, ChevronRight, LogOut, RefreshCw, ArrowLeft, Timer,
  MessageCircle, TrendingUp, Trophy, Zap, Headphones, Send,
  ChevronDown, ChevronUp, Plus, Clock, Calendar, AlertCircle,
  Copy, Check, Trash2, Eye, QrCode, Building2, Smartphone, CreditCard,
  ArrowDownLeft, ArrowUpRight, Gift, Share2, Users, IndianRupee
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameStore, type GameItem, type BannerItem, type ReferralEarning } from '@/store';
import { isInClosingWindow, getNowIST, getClosingWindowStatus } from '@/lib/time';
import { safeJsonParse } from '@/lib/fetch';
import { toast } from '@/hooks/use-toast';

export default function AppShell() {
  const {
    user, currentView, navigate, games, banners, notifications,
    fetchGames, fetchBanners, fetchNotifications, fetchWallet, logout,
    siteConfig, fetchSiteConfig,
  } = useGameStore();

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  // Auto-refresh games every 10 seconds for near-instant result updates
  useEffect(() => {
    if (currentView === 'home' || currentView === 'game-play') {
      const id = setInterval(() => fetchGames(), 10000);
      return () => clearInterval(id);
    }
  }, [currentView, fetchGames]);

  // Midnight auto-refresh: detect when IST crosses midnight and refresh
  useEffect(() => {
    if (currentView !== 'home' && currentView !== 'game-play') return;
    let lastISTDate = '';
    const checkMidnight = () => {
      const ist = getNowIST();
      const todayStr = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
      if (lastISTDate && lastISTDate !== todayStr) {
        // Midnight crossed - refresh everything
        fetchGames();
        useGameStore.getState().fetchBids();
        useGameStore.getState().fetchWallet();
      }
      lastISTDate = todayStr;
    };
    checkMidnight();
    const id = setInterval(checkMidnight, 2000);
    return () => clearInterval(id);
  }, [currentView, fetchGames]);

  // Fetch public site config on mount
  useEffect(() => {
    fetchSiteConfig();
  }, [fetchSiteConfig]);

  useEffect(() => {
    if (currentView === 'home') {
      fetchGames();
      fetchBanners();
    }
    if (currentView === 'wallet') {
      fetchWallet();
    }
    if (currentView === 'my-bids') {
      useGameStore.getState().fetchBids();
    }
    if (currentView === 'notifications') {
      fetchNotifications();
    }
    if (currentView === 'support') {
      useGameStore.getState().fetchTickets();
    }
    if (currentView === 'profile') {
      useGameStore.getState().fetchReferralEarnings();
    }
  }, [currentView, fetchGames, fetchBanners, fetchWallet, fetchNotifications]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'game-play':
        return <GamePlayView />;
      case 'my-bids':
        return <MyBidsView />;
      case 'wallet':
        return <WalletView />;
      case 'notifications':
        return <NotificationsView />;
      case 'support':
        return <SupportView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Matka<span className="text-emerald-400">King</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Wallet balance */}
            <button
              onClick={() => navigate('wallet')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                ₹{(user?.balance ?? 0).toLocaleString('en-IN')}
              </span>
            </button>
            {/* Notification bell */}
            <button
              onClick={() => navigate('notifications')}
              className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4.5 h-4.5 min-w-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderCurrentView()}
        </motion.div>
      </main>

      {/* Telegram FAB */}
      {siteConfig.telegramEnabled && siteConfig.telegramLink && (
        <a
          href={siteConfig.telegramLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Telegram Channel"
        >
          <Send className="w-5 h-5 text-white" />
        </a>
      )}

      {/* WhatsApp Support FAB */}
      <a
        href={`https://wa.me/${siteConfig.whatsappNumber}?text=Hi%20I%20need%20help%20with%20MatkaKing`}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed z-40 w-12 h-12 rounded-full bg-green-500 hover:bg-green-400 shadow-lg shadow-green-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${siteConfig.telegramEnabled && siteConfig.telegramLink ? 'right-[4.5rem] bottom-20' : 'right-4 bottom-20'}`}
        aria-label="WhatsApp Support"
      >
        <MessageCircle className="w-5 h-5 text-white" />
      </a>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {[
            { key: 'home' as const, icon: Home, label: 'Home' },
            { key: 'game-play' as const, icon: Gamepad2, label: 'Play' },
            { key: 'my-bids' as const, icon: Ticket, label: 'Bids' },
            { key: 'wallet' as const, icon: Wallet, label: 'Wallet' },
            { key: 'profile' as const, icon: User, label: 'Profile' },
          ].map((tab) => {
            const isActive = currentView === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-400' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Safe area for mobile */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

// ============ Views ============

function HomeView() {
  const { games, banners, selectGame, user, bids, navigate } = useGameStore();
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    if ((banners || []).length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % (banners || []).length);
    }, 4000);
    return () => clearInterval(timer);
  }, [(banners || []).length]);

  const totalBids = (bids || []).length;

  return (
    <div className="space-y-5">
      {/* Welcome Section */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Welcome, {user?.name?.split(' ')[0] ?? 'Player'}! 👋
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">Place your bids and win big today</p>
          </div>
          <button
            onClick={() => {
              useGameStore.getState().fetchGames();
              useGameStore.getState().fetchBanners();
              useGameStore.getState().fetchBids();
            }}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-500 hover:text-emerald-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-emerald-400">₹{(user?.balance ?? 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Balance</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center mx-auto mb-1.5">
                <Trophy className="w-4 h-4 text-yellow-400" />
              </div>
              <p className="text-lg font-bold text-yellow-400">₹{(user?.winningAmount ?? 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Winnings</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center mx-auto mb-1.5">
                <Ticket className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-lg font-bold text-sky-400">{totalBids}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Total Bids</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <div className="px-4">
          <div className="relative overflow-hidden rounded-xl">
            <BannerCard banner={banners[currentBanner]} />
            {banners.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {banners.slice(0, 3).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentBanner ? 'w-6 bg-emerald-400' : 'w-1.5 bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Games List */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            Available Games
          </h3>
          <span className="text-xs text-gray-500">{games.length} games</span>
        </div>
        {games.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl bg-gray-800/50" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <GameCard key={game.id} game={game} onSelect={() => selectGame(game)} />
            ))}
          </div>
        )}
      </div>

      {/* Support Link */}
      <div className="px-4 pb-4">
        <button
          onClick={() => navigate('support')}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-900 border border-gray-800/50 hover:border-emerald-500/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Need Help?</p>
              <p className="text-xs text-gray-500">Create a support ticket</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

function BannerCard({ banner }: { banner: BannerItem }) {
  const gradients = [
    'from-emerald-600/30 via-emerald-500/20 to-teal-500/10',
    'from-amber-600/30 via-yellow-500/20 to-orange-500/10',
    'from-pink-600/30 via-rose-500/20 to-red-500/10',
    'from-violet-600/30 via-purple-500/20 to-fuchsia-500/10',
  ];
  const gradientIndex = banner.id.length % gradients.length;

  return (
    <Card className={`bg-gradient-to-r ${gradients[gradientIndex]} border-white/10`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <h4 className="text-sm font-bold text-white truncate">{banner.title}</h4>
            </div>
            {banner.subtitle && <p className="text-xs text-gray-200/80 mt-1 leading-relaxed">{banner.subtitle}</p>}
            {banner.ctaText && (
              <div className="mt-3">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold text-white hover:bg-white/25 transition-colors cursor-pointer">
                  {banner.ctaText}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCard({ game, onSelect }: { game: GameItem; onSelect: () => void }) {
  // Initialize from the API's isAcceptingBids field, then update locally via timer
  const [localIsOpen, setLocalIsOpen] = useState(game.isAcceptingBids && !game.todayResultDeclared);
  const [countdown, setCountdown] = useState('');
  const [closingLabel, setClosingLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      if (!game.isOpen) { setLocalIsOpen(false); setCountdown(''); setClosingLabel(''); return; }
      // If result declared today, same-day bidding is closed
      if (game.todayResultDeclared) {
        setLocalIsOpen(false);
        setCountdown('');
        setClosingLabel('');
        return;
      }
      // INVERTED LOGIC: bidding is OPEN except during closing window
      const isClosing = isInClosingWindow(game.openTime, game.closeTime);
      setLocalIsOpen(!isClosing);

      const ist = getNowIST();
      const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
      const [fh, fm] = game.openTime.split(':').map(Number);
      const [uh, um] = game.closeTime.split(':').map(Number);
      const fromSec = fh * 3600 + fm * 60;
      const untilSec = uh * 3600 + um * 60;

      let targetSec: number;
      if (isClosing) {
        // Countdown to when closing ends (untilSec)
        setClosingLabel(`Resumes at ${game.closeTime}`);
        if (untilSec <= fromSec) {
          targetSec = nowSec >= fromSec ? (24 * 3600 - nowSec) + untilSec : untilSec - nowSec;
        } else {
          targetSec = untilSec - nowSec;
        }
      } else {
        // Countdown to when closing starts (fromSec)
        setClosingLabel(`Closing at ${game.openTime}`);
        let diff = fromSec - nowSec;
        if (diff < 0) diff += 24 * 3600;
        targetSec = diff;
      }

      if (targetSec > 0) {
        const h = String(Math.floor(targetSec / 3600)).padStart(2, '0');
        const m = String(Math.floor((targetSec % 3600) / 60)).padStart(2, '0');
        const s = String(targetSec % 60).padStart(2, '0');
        setCountdown(`${h}:${m}:${s}`);
      } else {
        setCountdown('');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game.openTime, game.closeTime, game.isOpen, game.todayResultDeclared]);

  // Format next day date for display
  const formatNextDayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Determine the status badge
  const getStatusBadge = () => {
    if (game.todayResultDeclared && game.nextDayBiddingAvailable) {
      return { text: `● Bid for ${formatNextDayDateShort(game.nextDayDate)}`, className: 'bg-sky-500/15 text-sky-400 border-sky-500/30 text-[11px] font-semibold' };
    }
    if (game.todayResultDeclared) {
      return { text: '● Closed', className: 'bg-red-500/15 text-red-400 border-red-500/30 text-[11px] font-semibold' };
    }
    if (localIsOpen) {
      return { text: '● Open', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px] font-semibold' };
    }
    if (game.isOpen) {
      return { text: '● Closing', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[11px]' };
    }
    return { text: '● Offline', className: 'bg-gray-800 text-gray-500 text-[11px]' };
  };

  const formatNextDayDateShort = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <Card
      className="bg-gray-900 border-gray-800/50 hover:border-emerald-500/30 active:scale-[0.98] transition-all duration-200 cursor-pointer group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${localIsOpen ? 'bg-emerald-500/20 border-emerald-500/30 animate-pulse' : game.todayResultDeclared ? 'bg-sky-500/15 border-sky-500/30' : 'bg-gray-800 border-gray-700'}`}>
              <Gamepad2 className={`w-5 h-5 ${localIsOpen ? 'text-emerald-400' : game.todayResultDeclared ? 'text-sky-400' : 'text-gray-500'}`} />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">{game.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Closing: {game.openTime} – {game.closeTime}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge className={statusBadge.className}>
              {statusBadge.text}
            </Badge>
            {countdown && closingLabel && (
              <div className="text-right">
                <span className="text-[10px] text-gray-500 block">{closingLabel}</span>
                <span className="text-[10px] font-mono text-gray-400 tabular-nums">{countdown}</span>
              </div>
            )}
            {game.todayResult ? (
              <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2.5 py-0.5 rounded-md border border-yellow-500/20">
                {game.todayResult.result}
              </span>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-800/50 px-2.5 py-0.5 rounded-md border border-gray-700/30">
                ⏳ Waiting
              </span>
            )}
            {game.todayResultDeclared && game.nextDayBiddingAvailable && (
              <span className="text-[9px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20 leading-tight">
                Next: {formatNextDayDate(game.nextDayDate)}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useCountdown(closeFromStr: string, closeUntilStr: string) {
  const [countdown, setCountdown] = useState('');
  const [status, setStatus] = useState<'open' | 'closing' | 'resumes_soon'>('open');

  useEffect(() => {
    const formatDiff = (diff: number) => {
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    const tick = () => {
      const ist = getNowIST();
      const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();

      const [fh, fm] = closeFromStr.split(':').map(Number);
      const [uh, um] = closeUntilStr.split(':').map(Number);
      const fromSec = fh * 3600 + fm * 60;
      const untilSec = uh * 3600 + um * 60;

      const isClosing = isInClosingWindow(closeFromStr, closeUntilStr);

      if (isClosing) {
        setStatus('closing');
        // Countdown to when closing ends
        let diff: number;
        if (untilSec <= fromSec) {
          diff = nowSec >= fromSec ? (24 * 3600 - nowSec) + untilSec : untilSec - nowSec;
        } else {
          diff = untilSec - nowSec;
        }
        setCountdown(diff > 0 ? formatDiff(diff) : '');
      } else {
        // Not closing - countdown to when closing starts
        let diff: number;
        if (untilSec <= fromSec) {
          diff = fromSec - nowSec;
        } else {
          if (nowSec < fromSec) {
            diff = fromSec - nowSec;
          } else {
            diff = -1; // already past closing, won't close again today
          }
        }

        if (diff > 0) {
          setStatus('resumes_soon');
          setCountdown(formatDiff(diff));
        } else {
          setStatus('open');
          setCountdown('');
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closeFromStr, closeUntilStr]);

  return { countdown, status };
}

function GamePlayView() {
  const {
    selectedGame, selectedBidType, selectedNumbers, bidAmount,
    setBidType, toggleNumber, setBidAmount, placeBid,
    clearBidSelection, navigate, user, bids, fetchBids,
  } = useGameStore();

  const [customAmount, setCustomAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const hasFetchedBids = useRef(false);

  // Determine if this game has today's result declared
  const todayResultDeclared = selectedGame?.todayResultDeclared ?? false;
  const nextDayBiddingAvailable = selectedGame?.nextDayBiddingAvailable ?? false;

  const { countdown, status: timerStatus } = useCountdown(
    selectedGame?.openTime ?? '00:00',
    selectedGame?.closeTime ?? '23:59'
  );

  const quickAmounts = [10, 50, 100, 200, 500, 1000];

  // When result is declared, auto-switch to next-day bidding mode
  useEffect(() => {
    if (todayResultDeclared && nextDayBiddingAvailable) {
      useGameStore.setState({ bidTargetDate: 'tomorrow' });
    } else {
      useGameStore.setState({ bidTargetDate: 'today' });
    }
  }, [todayResultDeclared, nextDayBiddingAvailable]);

  useEffect(() => {
    if (selectedGame && !hasFetchedBids.current) {
      fetchBids({ gameId: selectedGame.id });
      hasFetchedBids.current = true;
    }
  }, [selectedGame, fetchBids]);

  const recentBids = selectedGame
    ? bids
        .filter((b) => b.gameId === selectedGame.id)
        .slice(0, 5)
    : [];

  const totalAmount = selectedNumbers.length * bidAmount;

  // Format next day date for display
  const formatNextDayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };
const handlePlaceBid = async () => {
    if (!selectedGame || selectedNumbers.length === 0) return;
    setPlacing(true);

    try {
      // Snapshot current state BEFORE placing (prevent stale closures)
      const gameId = selectedGame.id;
      const bidType = selectedBidType;
      const amt = bidAmount;
      const numbers = [...selectedNumbers];
      // Determine target: if result declared, always bid for tomorrow
      const target = (todayResultDeclared && nextDayBiddingAvailable) ? 'tomorrow' : 'today';

      let successCount = 0;
      let lastError = '';

      for (const num of numbers) {
        try {
          await placeBid(gameId, bidType, num, amt, target);
          successCount++;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Failed to place bid';
          break; // Stop on first failure to avoid partial confusing results
        }
      }

      if (successCount > 0) {
        toast({ title: 'Bid Placed!', description: successCount === numbers.length
          ? `All ${successCount} bids placed successfully${target === 'tomorrow' ? ' for next day' : ''}`
          : `${successCount}/${numbers.length} bids placed. ${lastError}`
        });
        clearBidSelection();
      }
      if (successCount === 0 && lastError) {
        toast({ title: 'Bid Failed', description: lastError, variant: 'destructive' });
      }
    } catch (e) {
      console.error("Unexpected error in bid placement:", e);
    } finally {
      // YEH SABSE ZAROORI LINE HAI!
      // Chahe success ho ya error aaye, yeh button ko 100% normal kar dega
      setPlacing(false);
    }
  };

  const handleCustomAmountSubmit = () => {
    const val = parseInt(customAmount, 10);
    if (val > 0) {
      setBidAmount(val);
      setCustomAmount('');
    }
  };

  if (!selectedGame) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No game selected</p>
        <Button variant="outline" className="mt-4 border-emerald-500/30 text-emerald-400" onClick={() => navigate('home')}>
          Go to Games
        </Button>
      </div>
    );
  }

  // Determine bid availability (inverted: disabled during closing window)
  const isBidDisabled = todayResultDeclared
    ? !nextDayBiddingAvailable  // Only disabled if next-day bidding is also unavailable
    : timerStatus === 'closing';  // Normal: disabled only during closing window

  const isNextDayBid = todayResultDeclared && nextDayBiddingAvailable;

  // Format next day date display
  const nextDayDisplay = selectedGame?.nextDayDate
    ? new Date(selectedGame.nextDayDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="p-4 space-y-4">
      {/* Game Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('home')}
            className="mt-1 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-300" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{selectedGame.name}</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Closing: {selectedGame.openTime} – {selectedGame.closeTime} IST
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={
            isNextDayBid
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 text-[11px] font-semibold shrink-0'
              : timerStatus === 'open' || timerStatus === 'resumes_soon'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0'
              : timerStatus === 'closing'
              ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 shrink-0'
              : todayResultDeclared
              ? 'bg-red-500/15 text-red-400 border-red-500/30 shrink-0'
              : 'bg-gray-800 text-gray-500 shrink-0'
          }
        >
          {isNextDayBid ? `● Bid for ${selectedGame.nextDayDate ? new Date(selectedGame.nextDayDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Next Day'}` : timerStatus === 'closing' ? '● Bidding Closed' : timerStatus === 'resumes_soon' ? `● Closing at ${selectedGame.openTime}` : todayResultDeclared ? '● Result Declared' : '● Open'}
        </Badge>
      </div>

      {/* Next Day Bidding Banner */}
      {isNextDayBid && selectedGame.nextDayDate && (
        <div className="rounded-xl bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/25 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-400">Bid for Next Day</p>
              <p className="text-base font-bold text-white mt-0.5">{nextDayDisplay}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Today&apos;s result has been declared. All new bids will be booked for {nextDayDisplay}.
          </p>
        </div>
      )}

      {/* Result Declared - Today Closed Banner */}
      {todayResultDeclared && !nextDayBiddingAvailable && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Today&apos;s Bidding Closed</p>
              <p className="text-xs text-gray-400 mt-0.5">Result has been declared. Bidding is no longer available for today.</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Result Card */}
      {selectedGame.todayResult ? (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Today&apos;s Result</p>
            <p className="text-4xl font-extrabold text-yellow-400 mt-2 tracking-wider">
              {selectedGame.todayResult.result}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Today&apos;s Result</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-2xl">⏳</span>
              <p className="text-lg font-semibold text-gray-400">Waiting for Result</p>
            </div>
            <p className="text-xs text-gray-600 mt-1">Result will be declared by admin</p>
          </CardContent>
        </Card>
      )}

      {/* Countdown Timer */}
      <Card className="bg-gray-900 border-gray-800/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              {timerStatus === 'resumes_soon' && `Bidding closes at ${selectedGame.openTime} IST`}
              {timerStatus === 'open' && 'Bidding is open'}
              {timerStatus === 'closing' && `Bidding resumes at ${selectedGame.closeTime} IST`}
            </span>
          </div>
          {countdown ? (
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {countdown}
            </span>
          ) : (
            <span className="text-sm text-gray-500">Open all day</span>
          )}
        </CardContent>
      </Card>

      {/* Bid Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setBidType('single')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200 ${
            selectedBidType === 'single'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-gray-900 text-gray-500 border-gray-800/50 hover:bg-gray-800'
          }`}
        >
          Single (0-9)
        </button>
        <button
          onClick={() => setBidType('jodi')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200 ${
            selectedBidType === 'jodi'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-gray-900 text-gray-500 border-gray-800/50 hover:bg-gray-800'
          }`}
        >
          Jodi (00-99)
        </button>
      </div>

      {/* Number Pad / Grid */}
      {selectedBidType === 'single' ? (
        <div className="grid grid-cols-5 gap-2 justify-items-center">
          {Array.from({ length: 10 }, (_, i) => {
            const num = String(i);
            const isSelected = selectedNumbers.includes(num);
            return (
              <button
                key={num}
                onClick={() => !isBidDisabled && toggleNumber(num)}
                disabled={isBidDisabled}
                className={`w-14 h-12 rounded-lg text-base font-bold transition-all duration-150 ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-105'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                } ${isBidDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {num}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-10 gap-1.5 max-h-72 overflow-y-auto rounded-lg p-1.5 bg-gray-900/50">
          {Array.from({ length: 100 }, (_, i) => {
            const num = String(i).padStart(2, '0');
            const isSelected = selectedNumbers.includes(num);
            return (
              <button
                key={num}
                onClick={() => !isBidDisabled && toggleNumber(num)}
                disabled={isBidDisabled}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition-all duration-150 ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                } ${isBidDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {num}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected numbers summary */}
      {selectedNumbers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Selected:</span>
          <div className="flex gap-1 flex-wrap">
            {selectedNumbers.map((n) => (
              <span
                key={n}
                className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-semibold"
              >
                {n}
              </span>
            ))}
          </div>
          <button
            onClick={clearBidSelection}
            className="text-xs text-gray-500 hover:text-red-400 ml-auto transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Amount Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Bid Amount</h3>
        <div className="grid grid-cols-3 gap-2">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setBidAmount(amt)}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                bidAmount === amt
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              ₹{amt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
            <input
              type="number"
              placeholder="Custom amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomAmountSubmit()}
              className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCustomAmountSubmit}
            className="bg-gray-700 hover:bg-gray-600 text-white shrink-0"
          >
            Set
          </Button>
        </div>
      </div>

      {/* Place Bid Button */}
      <div className="space-y-2">
        <button
          onClick={handlePlaceBid}
          disabled={selectedNumbers.length === 0 || isBidDisabled || placing}
          className={`w-full py-3.5 rounded-xl text-base font-bold transition-all duration-200 ${
            selectedNumbers.length === 0 || isBidDisabled || placing
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : isNextDayBid
              ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25 active:scale-[0.98]'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98]'
          }`}
        >
          {placing ? 'Placing Bids...' : selectedNumbers.length === 0
            ? 'Select Numbers to Place Bid'
            : isNextDayBid
            ? `Bid for Next Day • ${selectedNumbers.length} Number${selectedNumbers.length > 1 ? 's' : ''} • ₹${totalAmount.toLocaleString('en-IN')}`
            : `Place Bid • ${selectedNumbers.length} Number${selectedNumbers.length > 1 ? 's' : ''} • ₹${totalAmount.toLocaleString('en-IN')}`
          }
        </button>
        {user && (
          <p className="text-xs text-gray-500 text-center">
            Balance: ₹{(user.balance ?? 0).toLocaleString('en-IN')}
            {isNextDayBid && <span className="text-sky-400 ml-1">• Next Day</span>}
          </p>
        )}
      </div>

      {/* My Recent Bids for this game */}
      {recentBids.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white">My Recent Bids</h3>
          <div className="space-y-2">
            {recentBids.map((bid) => (
              <Card key={bid.id} className="bg-gray-900 border-gray-800/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      bid.status === 'won'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : bid.status === 'lost'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                    >
                      {bid.number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {bid.bidType === 'single' ? 'Single' : 'Jodi'}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(bid.createdAt).toLocaleString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">₹{bid.amount}</p>
                    <Badge
                      className={`text-[10px] ${
                        bid.status === 'won'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : bid.status === 'lost'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      {bid.winAmount ? ` +₹${bid.winAmount}` : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Last 30 Days Results */}
      <GameResultsHistory gameId={selectedGame.id} />
    </div>
  );
}

// ============ Game Results History (30 days) ============

function GameResultsHistory({ gameId }: { gameId: string }) {
  const [results, setResults] = useState<{ date: string; result: { id: string; result: string; declaredAt: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayResult, setTodayResult] = useState<{ id: string; result: string; declaredAt: string } | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/games/results?gameId=${gameId}&days=30`);
        const json = await safeJsonParse(res);
        if (json.success) {
          const data = json.data;
          if (data.days) {
            setResults(data.days);
            // Server puts today's entry first in the array — no client-side date computation needed
            const todayEntry = data.days[0];
            // Only set todayResult if the result is actually declared (has a non-empty result string)
            setTodayResult(todayEntry?.result && todayEntry.result.result ? todayEntry.result : null);
          } else {
            // Fallback for old API response format
            const fallbackResults = (data.results || []).map((r: { id: string; result: string; declaredAt: string; date: string }) => ({ date: r.date, result: r }));
            setResults(fallbackResults);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [gameId]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" /> Result History
        </h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg bg-gray-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" /> Result History
      </h3>

      {/* Today&apos;s Result Prominently */}
      <Card className={`border-2 ${todayResult ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/30' : 'bg-gray-900 border-gray-800/50'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Today&apos;s Result</p>
            <p className="text-xs text-gray-500 mt-0.5">{getNowIST().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          </div>
          {todayResult ? (
            <div className="text-right">
              <p className="text-3xl font-extrabold text-yellow-400 tracking-wider">{todayResult.result}</p>
              <p className="text-[10px] text-gray-500">Declared</p>
            </div>
          ) : (
            <div className="text-right flex items-center gap-2">
              <span className="text-sm text-gray-400">⏳</span>
              <span className="text-sm text-gray-400">Waiting for Result</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Results (skip today, already shown above) */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto rounded-lg">
        {results.slice(1).map((entry) => (
          <div
            key={entry.date}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-900/60 border border-gray-800/30"
          >
            <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
            {entry.result && entry.result.result ? (
              <span className="text-sm font-bold text-yellow-400 bg-yellow-500/10 px-3 py-0.5 rounded-md">
                {entry.result.result}
              </span>
            ) : (
              <span className="text-xs text-gray-600 italic">Waiting</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MyBidsView() {
  const { bids, fetchBids } = useGameStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBids().finally(() => setLoading(false));
  }, [fetchBids]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold text-white">My Bids</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-gray-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-white">My Bids</h2>
      {bids.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-8 text-center">
            <Ticket className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No bids placed yet</p>
            <p className="text-gray-500 text-sm mt-1">Start playing to place your first bid!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bids.map((bid) => (
            <Card key={bid.id} className="bg-gray-900 border-gray-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{bid.game?.name ?? 'Unknown Game'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {bid.bidType === 'single' ? 'Single' : 'Jodi'} • Number: {bid.number}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">₹{bid.amount}</p>
                    <Badge
                      className={`text-[10px] ${
                        bid.status === 'won'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : bid.status === 'lost'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      {bid.winAmount ? ` +₹${bid.winAmount}` : ''}
                    </Badge>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  {new Date(bid.createdAt).toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletView() {
  const { user, walletTransactions, requestRecharge, requestWithdrawal, fetchWallet, fetchBankDetail, saveBankDetail, bankDetail, siteConfig } = useGameStore();
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [upiNumber, setUpiNumber] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi'>('bank');
  const [withdrawForm, setWithdrawForm] = useState({ bankAccount: '', bankHolder: '', ifscCode: '', bankName: '', withdrawUpi: '' });
  const { bankAccount, bankHolder, ifscCode, bankName, withdrawUpi } = withdrawForm;
  // Filter only deposit & withdrawal transactions (exclude bid/win types)
  const dwTransactions = (walletTransactions || []).filter((tx) => tx.type === 'deposit' || tx.type === 'withdrawal');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Pre-fill saved bank details when fetched
  const bankDetailInitRef = useRef(false);
  useEffect(() => {
    fetchBankDetail();
  }, [fetchBankDetail]);

  useEffect(() => {
    if (bankDetail && !bankDetailInitRef.current) {
      bankDetailInitRef.current = true;
      // one-time init from async data
      setWithdrawForm({
        bankAccount: bankDetail.accountNumber || '',
        bankHolder: bankDetail.accountHolder || '',
        ifscCode: bankDetail.ifscCode || '',
        bankName: bankDetail.bankName || '',
        withdrawUpi: bankDetail.upiId || '',
      });
      if (bankDetail.upiId) setPaymentMethod('upi');
    }
  }, [bankDetail]);

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    await saveBankDetail({
      accountHolder: bankHolder,
      accountNumber: bankAccount,
      ifscCode,
      bankName,
      upiId: withdrawUpi,
    });
    setSavingDetails(false);
  };

  const handleCopyUpi = () => {
    if (siteConfig.upiId) {
      navigator.clipboard.writeText(siteConfig.upiId).then(() => {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2000);
      }).catch(() => {});
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid File', description: 'Only JPEG, PNG, WebP, and GIF images are allowed', variant: 'destructive' });
      return;
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Maximum file size is 5MB', variant: 'destructive' });
      return;
    }
    setScreenshotFile(file);
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshotPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const uploadScreenshot = async (): Promise<string | undefined> => {
    if (!screenshotFile) return undefined;
    setScreenshotUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', screenshotFile);
      const token = useGameStore.getState().authToken;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await safeJsonParse(res);
      if (!json.success) {
        toast({ title: 'Upload Failed', description: json.error || 'Failed to upload screenshot', variant: 'destructive' });
        return undefined;
      }
      return json.data.url as string;
    } catch (err) {
      const msg = err instanceof SyntaxError ? 'Server returned an invalid response. Please refresh.' :
                  err instanceof Error ? err.message : 'Failed to upload screenshot. Please try again.';
      toast({ title: 'Upload Error', description: msg, variant: 'destructive' });
      return undefined;
    } finally {
      setScreenshotUploading(false);
    }
  };

  const handleRecharge = async () => {
    if (!amount || !upiNumber) {
      setErrorMsg('Please fill in amount and UPI number');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    // Upload screenshot if provided
    let uploadedUrl: string | undefined;
    if (screenshotFile) {
      uploadedUrl = await uploadScreenshot();
      if (screenshotFile && !uploadedUrl) {
        // Screenshot upload failed, still proceed but warn
        toast({ title: 'Warning', description: 'Screenshot upload failed, proceeding without it' });
      }
    }

    await requestRecharge(amt, upiNumber, utrNumber || undefined, uploadedUrl);
    setLoading(false);
    setShowRecharge(false);
    setAmount('');
    setUpiNumber('');
    setUtrNumber('');
    removeScreenshot();
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < 500) {
      setErrorMsg('Minimum withdrawal amount is ₹500');
      return;
    }
    if (paymentMethod === 'bank' && (!bankAccount || !bankHolder)) {
      setErrorMsg('Please fill in account holder name and account number');
      return;
    }
    if (paymentMethod === 'upi' && !withdrawUpi) {
      setErrorMsg('Please fill in UPI ID');
      return;
    }
    if (user && amt > (user.balance ?? 0)) {
      setErrorMsg('Insufficient balance');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    await requestWithdrawal({
      amount: amt,
      paymentMethod,
      bankHolderName: paymentMethod === 'bank' ? bankHolder : undefined,
      bankAccountNumber: paymentMethod === 'bank' ? bankAccount : undefined,
      ifscCode: paymentMethod === 'bank' ? ifscCode : undefined,
      bankName: paymentMethod === 'bank' ? bankName : undefined,
      upiId: paymentMethod === 'upi' ? withdrawUpi : undefined,
    });
    setLoading(false);
    setShowWithdraw(false);
    setAmount('');
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-white">Wallet</h2>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 border-emerald-500/20">
        <CardContent className="p-6">
          <p className="text-sm text-gray-400">Available Balance</p>
          <p className="text-3xl font-bold text-white mt-1">₹{(user?.balance ?? 0).toLocaleString('en-IN')}</p>
          <p className="text-sm text-yellow-400 mt-1">
            Winnings: ₹{(user?.winningAmount ?? 0).toLocaleString('en-IN')}
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white"
              onClick={() => setShowRecharge(true)}
            >
              Recharge
            </Button>
            <Button
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
              onClick={() => setShowWithdraw(true)}
            >
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recharge Form with QR & UPI */}
      {showRecharge && (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Recharge</h3>

            {/* Payment Info */}
            {(siteConfig.upiId || siteConfig.qrCodeUrl) && (
              <div className="space-y-3">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400">Payment Details</p>
                  <p className="text-[10px] text-gray-500">Pay to the following UPI and submit your request:</p>
                  {siteConfig.upiId && (
                    <div className="flex items-center justify-between gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-sm font-semibold text-white truncate">{siteConfig.upiId}</span>
                      </div>
                      <button
                        onClick={handleCopyUpi}
                        className="shrink-0 p-1.5 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                  )}
                  {siteConfig.qrCodeUrl && (
                    <div className="flex justify-center">
                      <div className="bg-white p-2 rounded-lg">
                        <img src={siteConfig.qrCodeUrl} alt="Payment QR Code" className="w-40 h-40 object-contain" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-yellow-400 font-medium">Instructions:</p>
                  <ol className="text-[10px] text-gray-400 mt-1 space-y-1 list-decimal list-inside">
                    <li>Pay the desired amount to the UPI ID / QR code above</li>
                    <li>Enter the amount and your UPI ID below</li>
                    <li>Submit the request and wait for admin approval</li>
                    <li>Minimum deposit: ₹{siteConfig.minDepositAmount || 200}</li>
                  </ol>
                </div>
              </div>
            )}

            {errorMsg && showRecharge && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{errorMsg}</p>}

            {/* Minimum amount hint */}
            {(() => {
              const minAmt = siteConfig.minDepositAmount || 200;
              const isBelow = parseFloat(amount) > 0 && parseFloat(amount) < minAmt;
              return (
                <div className={"rounded-lg p-2.5 flex items-center gap-2 transition-colors " + (isBelow ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-emerald-500/5 border border-emerald-500/20")}>
                  <AlertCircle className={"w-4 h-4 shrink-0 " + (isBelow ? "text-yellow-400" : "text-emerald-400")} />
                  <p className="text-[11px] text-emerald-400 font-medium">
                    Minimum recharge amount: <span className="text-white font-bold">₹{minAmt}</span>
                    {isBelow && (
                      <span className="text-yellow-400 ml-1"> — Amount will auto-correct to ₹{minAmt} on submit</span>
                    )}
                  </p>
                </div>
              );
            })()}

            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrorMsg(''); }}
              onBlur={() => {
                const minAmt = siteConfig.minDepositAmount || 200;
                const entered = parseFloat(amount);
                if (!isNaN(entered) && entered > 0 && entered < minAmt) {
                  setAmount(String(minAmt));
                  toast({ title: 'Amount Auto-Corrected', description: `Minimum recharge is ₹${minAmt}. Amount adjusted to ₹${minAmt}.`, variant: 'default' });
                }
              }}
              className={"w-full px-3 py-2 rounded-lg bg-gray-800 text-white placeholder:text-gray-500 text-sm focus:outline-none " + (parseFloat(amount) > 0 && parseFloat(amount) < (siteConfig.minDepositAmount || 200) ? "border-yellow-500/50 focus:border-yellow-500" : "border-gray-700 focus:border-emerald-500/50")}
            />
            <input
              type="text"
              placeholder="Your UPI ID (e.g. name@upi)"
              value={upiNumber}
              onChange={(e) => { setUpiNumber(e.target.value); setErrorMsg(''); }}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
            />

            {/* UTR Number */}
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">UTR Number (Transaction Reference ID)</label>
              <input
                type="text"
                placeholder="Enter UTR number from payment"
                value={utrNumber}
                onChange={(e) => { setUtrNumber(e.target.value); setErrorMsg(''); }}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-[10px] text-gray-600 mt-1">Find this in your UPI app payment history</p>
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">Payment Screenshot (optional)</label>
              {screenshotPreview ? (
                <div className="relative">
                  <img src={screenshotPreview} alt="Screenshot preview" className="w-full h-40 object-cover rounded-lg border border-gray-700" />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {screenshotUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-lg border-2 border-dashed border-gray-700 hover:border-emerald-500/40 bg-gray-800/30 cursor-pointer transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Tap to upload screenshot</p>
                    <p className="text-[10px] text-gray-600">JPEG, PNG, WebP — Max 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleScreenshotChange}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 border-gray-700 text-gray-400" onClick={() => { setShowRecharge(false); setErrorMsg(''); removeScreenshot(); }}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-emerald-500 text-white" onClick={handleRecharge} disabled={loading || screenshotUploading}>{loading || screenshotUploading ? 'Submitting...' : 'Submit'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdraw Form with Bank/UPI */}
      {showWithdraw && (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Withdraw</h3>
            {errorMsg && showWithdraw && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{errorMsg}</p>}
            <input
              type="number"
              placeholder="Amount (min ₹500)"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrorMsg(''); }}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
            />

            {/* Payment Method Selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                }`}
              >
                <Building2 className="w-4 h-4" /> Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  paymentMethod === 'upi'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                }`}
              >
                <Smartphone className="w-4 h-4" /> UPI
              </button>
            </div>

            {paymentMethod === 'bank' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Account Holder Name *"
                  value={bankHolder}
                  onChange={(e) => { setWithdrawForm((p) => ({ ...p, bankHolder: e.target.value })); setErrorMsg(''); }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <input
                  type="text"
                  placeholder="Account Number *"
                  value={bankAccount}
                  onChange={(e) => { setWithdrawForm((p) => ({ ...p, bankAccount: e.target.value })); setErrorMsg(''); }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <input
                  type="text"
                  placeholder="IFSC Code"
                  value={ifscCode}
                  onChange={(e) => { setWithdrawForm((p) => ({ ...p, ifscCode: e.target.value })); setErrorMsg(''); }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={bankName}
                  onChange={(e) => { setWithdrawForm((p) => ({ ...p, bankName: e.target.value })); setErrorMsg(''); }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="UPI ID * (e.g. name@upi)"
                value={withdrawUpi}
                onChange={(e) => { setWithdrawForm((p) => ({ ...p, withdrawUpi: e.target.value })); setErrorMsg(''); }}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            )}

            {/* Save Details Button */}
            <Button
              size="sm"
              variant="outline"
              className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={handleSaveDetails}
              disabled={savingDetails}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              {savingDetails ? 'Saving...' : 'Save Details for Next Time'}
            </Button>

            <p className="text-[10px] text-gray-500">Min withdrawal: ₹500. Amount will be deducted immediately.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 border-gray-700 text-gray-400" onClick={() => { setShowWithdraw(false); setErrorMsg(''); }}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-emerald-500 text-white" onClick={handleWithdraw} disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions - Only Deposit & Withdrawal */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Deposit & Withdrawal History</h3>
        {dwTransactions.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800/50">
            <CardContent className="p-8 text-center">
              <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No deposit or withdrawal yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {dwTransactions.map((tx) => (
              <Card key={tx.id} className="bg-gray-900 border-gray-800/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'deposit'
                        ? 'bg-emerald-500/15 border border-emerald-500/20'
                        : 'bg-orange-500/15 border border-orange-500/20'
                    }`}>
                      {tx.type === 'deposit'
                        ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                        : <ArrowUpRight className="w-4 h-4 text-orange-400" />
                      }
                    </div>
                    <div>
                      <p className="text-sm text-white capitalize font-medium">{tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(tx.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                    </p>
                    <Badge
                      className={`text-[9px] ${
                        tx.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : tx.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {tx.status}
                    </Badge>
                    {tx.status === 'rejected' && tx.adminNote && (
                      <p className="text-[9px] text-red-400 mt-1 flex items-start gap-0.5">
                        <MessageCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                        <span>{tx.adminNote}</span>
                      </p>
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

function NotificationsView() {
  const { notifications, markNotificationsRead, fetchNotifications } = useGameStore();
  const [markingAll, setMarkingAll] = useState(false);

  const unreadIds = (notifications || []).filter((n) => !n.isRead).map((n) => n.id);

  const handleMarkAllRead = async () => {
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    await markNotificationsRead(unreadIds);
    setMarkingAll(false);
    toast({ title: 'Marked as Read', description: `${unreadIds.length} notifications` });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Notifications</h2>
        {unreadIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            {markingAll ? 'Marking...' : 'Mark All Read'}
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-8 text-center">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`bg-gray-900 border-gray-800/50 ${!notif.isRead ? 'border-l-2 border-l-emerald-500' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{notif.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                  </div>
                  <Badge
                    className={`text-[9px] shrink-0 ml-2 ${
                      notif.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : notif.type === 'warning'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : notif.type === 'offer'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {notif.type}
                  </Badge>
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  {new Date(notif.createdAt).toLocaleString('en-IN')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Support View ============

function SupportView() {
  const { supportTickets, createTicket, fetchTickets, navigate, siteConfig } = useGameStore();
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketReplies, setTicketReplies] = useState<Record<string, Array<{ id: string; message: string; isAdmin: boolean; createdAt: string }>>>({});
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  const fetchReplies = async (ticketId: string) => {
    try {
      const token = useGameStore.getState().authToken;
      const res = await fetch(`/api/tickets/${ticketId}/replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeJsonParse(res);
      if (json.success) {
        setTicketReplies((prev) => ({ ...prev, [ticketId]: json.data }));
      }
    } catch {}
  };

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    await createTicket({ subject: subject.trim(), message: message.trim(), type: issueType });
    setSubmitting(false);
    setShowForm(false);
    setSubject('');
    setMessage('');
    setIssueType('general');
  };

  const handleSendReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const token = useGameStore.getState().authToken;
      const res = await fetch(`/api/tickets/${ticketId}/replies`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const json = await safeJsonParse(res);
      if (json.success) {
        setReplyText('');
        await fetchReplies(ticketId);
      } else {
        toast({ title: 'Failed', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    }
    setSendingReply(false);
  };

  const handleToggleExpand = async (ticketId: string) => {
    if (expandedId === ticketId) {
      setExpandedId(null);
    } else {
      setExpandedId(ticketId);
      if (!ticketReplies[ticketId]) {
        await fetchReplies(ticketId);
      }
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    closed: 'bg-gray-700 text-gray-400 border-gray-600',
  };

  const statusLabels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('profile')} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-300" />
          </button>
          <h2 className="text-xl font-bold text-white">Support</h2>
        </div>
        <Button
          size="sm"
          className="bg-emerald-500 hover:bg-emerald-400 text-white"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4 mr-1" /> New Ticket
        </Button>
      </div>

      {/* Social Links - Quick Contact */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/${siteConfig.whatsappNumber}?text=Hi%20I%20need%20help%20with%20MatkaKing`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">WhatsApp</p>
            <p className="text-[10px] text-gray-500">Chat with us</p>
          </div>
        </a>
        {siteConfig.telegramEnabled && siteConfig.telegramLink && (
          <a
            href={siteConfig.telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Telegram</p>
              <p className="text-[10px] text-gray-500">Join channel</p>
            </div>
          </a>
        )}
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <Card className="bg-gray-900 border-emerald-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Create Ticket</h3>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Issue Type *</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="general">General</option>
                <option value="deposit">Deposit Issue</option>
                <option value="withdrawal">Withdrawal Issue</option>
                <option value="game">Game Issue</option>
                <option value="account">Account Problem</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of your issue"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 border-gray-700 text-gray-400" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-emerald-500 text-white" onClick={handleSubmitTicket} disabled={submitting || !subject.trim() || !message.trim()}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl bg-gray-800/50" />)}</div>
      ) : supportTickets.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-8 text-center">
            <Headphones className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No support tickets yet</p>
            <p className="text-gray-500 text-sm mt-1">Create a ticket if you need help</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {supportTickets.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            return (
              <Card key={ticket.id} className={`bg-gray-900 ${isExpanded ? 'border-emerald-500/30' : 'border-gray-800/50'}`}>
                <CardContent className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => handleToggleExpand(ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{ticket.subject}</p>
                        <Badge className={`text-[9px] ${statusColors[ticket.status] || statusColors.open}`}>
                          {statusLabels[ticket.status] || ticket.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {new Date(ticket.createdAt).toLocaleString('en-IN')}
                      </p>
                      {!isExpanded && <p className="text-xs text-gray-400 mt-1 truncate">{ticket.message}</p>}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-gray-800/50 pt-3">
                      <div className="bg-gray-800/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Your Message:</p>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{ticket.message}</p>
                      </div>

                      {/* Replies thread */}
                      {ticketReplies[ticket.id] && ticketReplies[ticket.id].length > 0 && (
                        <div className="space-y-2">
                          {ticketReplies[ticket.id].map((reply) => (
                            <div
                              key={reply.id}
                              className={`rounded-lg p-3 ${reply.isAdmin ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-gray-800/30'}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium ${reply.isAdmin ? 'text-emerald-400' : 'text-sky-400'}`}>
                                  {reply.isAdmin ? 'Admin' : 'You'}
                                </span>
                                <span className="text-[10px] text-gray-600">{new Date(reply.createdAt).toLocaleString('en-IN')}</span>
                              </div>
                              <p className="text-sm text-gray-200 whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {ticket.adminReply && !ticketReplies[ticket.id] && (
                        <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/10">
                          <p className="text-xs text-emerald-500 mb-1 font-medium">Admin Reply:</p>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{ticket.adminReply}</p>
                        </div>
                      )}

                      {/* Reply Input */}
                      {ticket.status !== 'closed' && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && expandedId && handleSendReply(expandedId)}
                              placeholder="Type your reply..."
                              className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                            />
                            <Button
                              size="sm"
                              className="bg-emerald-500 text-white shrink-0"
                              onClick={() => handleSendReply(ticket.id)}
                              disabled={sendingReply || !replyText.trim()}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {!ticket.adminReply && !ticketReplies[ticket.id]?.length && ticket.status === 'open' && (
                        <p className="text-xs text-gray-500 text-center py-2">Waiting for admin response...</p>
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

function ProfileView() {
  const { user, logout, navigate, siteConfig, referralEarnings } = useGameStore();
  const [copied, setCopied] = useState(false);

  // Build referral link using the current site URL
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?ref=${user?.referralCode || ''}`
    : '';

  const bonusPercentage = siteConfig.referralBonusPercentage || 10;
  const bonusMaxAmount = siteConfig.referralBonusMaxAmount || 50;
  const bonusEnabled = siteConfig.referralBonusEnabled;

  const handleCopyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Referral link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed', description: 'Could not copy link', variant: 'destructive' });
    }
  };

  const handleShareReferral = async () => {
    const shareText = `Join MatkaKing and play to win big! Use my referral code: ${user?.referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join MatkaKing',
          text: shareText,
          url: referralLink,
        });
      } catch {}
    } else {
      // Fallback: copy link to clipboard
      await handleCopyReferralLink();
      toast({ title: 'Link Copied!', description: 'Paste this link in WhatsApp or any app to share' });
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-white">Profile</h2>

      {/* User Info Card */}
      <Card className="bg-gray-900 border-gray-800/50">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white">{user?.name}</h3>
          <p className="text-sm text-gray-400">{user?.mobile}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
              {user?.role?.toUpperCase()}
            </Badge>
            <Badge className="bg-gray-800 text-gray-400 text-xs">
              Code: {user?.referralCode}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Referral Earnings Summary Card */}
      <Card className="bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-orange-500/15 border-purple-500/25">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Referral Earnings</h3>
              <p className="text-[11px] text-gray-500">Your earnings from referrals</p>
            </div>
          </div>

          {/* Earnings Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-purple-400">₹{(referralEarnings?.totalEarnings ?? 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Total Earned</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{referralEarnings?.completedReferrals ?? 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Completed</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-yellow-400">{referralEarnings?.pendingReferrals ?? 0}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Pending</p>
            </div>
          </div>

          {/* Referral Bonus Transactions */}
          {referralEarnings && referralEarnings.referralTransactions.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-2">Earnings History</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {referralEarnings.referralTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-300 truncate">{tx.adminNote || 'Referral bonus'}</p>
                        <p className="text-[9px] text-gray-600">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 shrink-0">+₹{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referred Users List */}
          {referralEarnings && referralEarnings.referredUsers.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-2">Referred Friends ({referralEarnings.referredUsersCount})</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {referralEarnings.referredUsers.map((ru) => (
                  <div key={ru.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-200 truncate">{ru.name}</p>
                        <p className="text-[9px] text-gray-600">Joined {formatDate(ru.createdAt)}</p>
                      </div>
                    </div>
                    <Badge className={`text-[9px] shrink-0 ${ru.referralBonusClaimed ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
                      {ru.referralBonusClaimed ? 'Earned' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {referralEarnings && referralEarnings.referredUsersCount === 0 && (
            <p className="text-[11px] text-gray-500 text-center py-2">
              No referrals yet. Share your code with friends to earn ${bonusPercentage}% of their 1st recharge (max ₹${bonusMaxAmount})!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Referral Program Card */}
      <Card className="bg-gray-900 border-gray-800/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Refer & Earn</h3>
              <p className="text-[11px] text-gray-500">{bonusEnabled ? `Earn ${bonusPercentage}% of friend's 1st recharge (max ₹${bonusMaxAmount})` : 'Referral bonus currently disabled'}</p>
            </div>
          </div>

          {/* Referral Code Display */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 px-3 py-2.5 rounded-lg bg-gray-800/80 border border-gray-700/50">
              <p className="text-[11px] text-gray-500">Your Referral Code</p>
              <p className="text-base font-bold text-emerald-400 tracking-wider font-mono">{user?.referralCode}</p>
            </div>
            <button
              onClick={handleCopyReferralLink}
              className="px-3 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>

          {/* Referral Link */}
          <div className="mb-3">
            <p className="text-[11px] text-gray-500 mb-1">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50 overflow-hidden">
                <p className="text-xs text-gray-300 truncate font-mono">{referralLink}</p>
              </div>
              <button
                onClick={handleCopyReferralLink}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-emerald-500/50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="space-y-2">
            {/* Share with Friends - Native Share / Copy Link */}
            <button
              onClick={handleShareReferral}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share with Friends
            </button>
            <button
              onClick={handleCopyReferralLink}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link Copied!' : 'Copy Referral Link'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {/* WhatsApp Share */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join MatkaKing and play to win big! 🎮\n\nUse my referral code: ${user?.referralCode}\n\nLink: ${referralLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all duration-200"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
              {/* Telegram Share */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`Join MatkaKing and play to win big! 🎮\n\nUse my referral code: ${user?.referralCode}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-all duration-200"
              >
                <Send className="w-4 h-4" />
                Telegram
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-emerald-400">₹{(user?.balance ?? 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Balance</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800/50">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-yellow-400">₹{(user?.winningAmount ?? 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Winnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Link */}
      <button
        onClick={() => navigate('support')}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-900 border border-gray-800/50 hover:border-emerald-500/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Help & Support</p>
            <p className="text-xs text-gray-500">View tickets or create new</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        onClick={logout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  );
}
