import { create } from 'zustand';
import { toast } from '@/hooks/use-toast';
import { robustFetch, safeJsonParse, getFetchErrorMessage } from '@/lib/fetch';

// Helper: persist auth to localStorage
function loadPersistedAuth(): { user: User | null; authToken: string | null; adminMode: boolean } {
  if (typeof window === 'undefined') return { user: null, authToken: null, adminMode: false };
  try {
    const saved = localStorage.getItem('mk_auth');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        user: parsed.user || null,
        authToken: parsed.authToken || parsed.token || null,
        adminMode: parsed.adminMode || false,
      };
    }
  } catch {}
  return { user: null, authToken: null, adminMode: false };
}

function persistAuth(user: User | null, authToken: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user && authToken) {
      const adminMode = useGameStore.getState().adminMode;
      localStorage.setItem('mk_auth', JSON.stringify({ user, authToken, adminMode }));
    } else {
      localStorage.removeItem('mk_auth');
    }
  } catch {}
}

// Helper: fetch with auth token + retry + timeout for resilience
// Automatically handles 401 (session expired) with toast notification and logout
let sessionExpiredNotified = false;
function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useGameStore.getState().authToken;
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  // IMPORTANT: Do NOT include 401/403/404 in noRetryStatuses here.
  // robustFetch throws for those statuses, preventing us from handling them in .then()
  // Instead, let the response pass through so we can check res.status in callers.
  return robustFetch(url, { ...options, headers, timeout: 12000, retries: 1, noRetryStatuses: [422, 502, 503] }).then(async (res) => {
    // Handle session expiry (2 hours) — show toast and logout
    // Skip for session check endpoint (handled by checkSession itself)
    if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/session')) {
      if (!sessionExpiredNotified) {
        sessionExpiredNotified = true;
        toast({
          title: 'Session Expired',
          description: 'Your 2-hour session has expired. Please log in again.',
          variant: 'destructive',
        });
        setTimeout(() => {
          useGameStore.getState().logout();
          sessionExpiredNotified = false;
        }, 1500);
      }
    }
    // Handle rate limiting (429)
    if (res.status === 429) {
      try {
        const json = await safeJsonParse<{ success: boolean; error?: string; retryAfter?: number }>(res);
        toast({
          title: 'Too Many Requests',
          description: json.error || 'Please wait a moment and try again.',
          variant: 'destructive',
        });
      } catch {
        toast({ title: 'Rate Limited', description: 'Please wait and try again.', variant: 'destructive' });
      }
    }
    return res;
  });
}

export interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  balance: number;
  winningAmount: number;
  referralCode: string;
  referredBy?: string;
  isActive: boolean;
}

type CurrentView =
  | 'auth'
  | 'register'
  | 'forgot-password'
  | 'home'
  | 'game-play'
  | 'my-bids'
  | 'wallet'
  | 'notifications'
  | 'profile'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-wallet'
  | 'admin-games'
  | 'admin-results'
  | 'admin-banners'
  | 'admin-notifications'
  | 'admin-config'
  | 'admin-bids'
  | 'admin-referrals'
  | 'support'
  | 'admin-tickets';

export interface BankDetailItem {
  id: string;
  userId: string;
  accountHolder: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  upiId: string | null;
}

interface SiteConfig {
  whatsappNumber: string;
  telegramLink: string;
  telegramEnabled: boolean;
  upiId: string;
  qrCodeUrl: string;
  minDepositAmount: number;
  siteName: string;
  referralBonusEnabled: boolean;
  referralBonusPercentage: number;
  referralBonusMaxAmount: number;
}

interface GameState {
  // Auth
  user: User | null;
  authToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  adminMode: boolean;

  // Site config (public)
  siteConfig: SiteConfig;

  // Navigation
  currentView: CurrentView;
  selectedGame: GameItem | null;

  // Data
  games: GameItem[];
  bids: BidItem[];
  banners: BannerItem[];
  notifications: NotificationItem[];
  walletTransactions: WalletTransactionItem[];

  // Game play state
  selectedBidType: 'single' | 'jodi';
  selectedNumbers: string[];
  bidAmount: number;
  bidTargetDate: string; // 'today' or 'tomorrow'

  // Bank detail
  bankDetail: BankDetailItem | null;

  // Admin data
  adminUsers: AdminUserItem[];
  adminWalletRequests: AdminWalletRequest[];
  adminStats: AdminStats | null;
  adminConfigs: AdminConfigItem[];
  adminBids: AdminBidItem[];
  adminBidsSummary: AdminBidsSummary | null;
  bidFilterGameId: string | null;
  supportTickets: SupportTicketItem[];
  adminTickets: SupportTicketItem[];
  adminReferrals: AdminReferralItem[];
  adminReferralStats: AdminReferralStats | null;

  // Auth actions
  login: (mobile: string, password: string) => Promise<void>;
  register: (name: string, mobile: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;

  // Navigation
  navigate: (view: CurrentView) => void;
  setAdminMode: (mode: boolean) => void;

  // Data fetchers
  fetchGames: () => Promise<void>;
  fetchBids: (filters?: { status?: string; gameId?: string }) => Promise<void>;
  fetchBanners: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchWallet: () => Promise<void>;

  // User actions
  placeBid: (gameId: string, bidType: string, number: string, amount: number, targetDate?: string) => Promise<void>;
  requestRecharge: (amount: number, upiNumber: string, utrNumber?: string, screenshotUrl?: string) => Promise<void>;
  requestWithdrawal: (data: { amount: number; paymentMethod: string; accountHolder?: string; accountNumber?: string; ifscCode?: string; bankName?: string; upiId?: string }) => Promise<void>;

  // Site config actions
  fetchSiteConfig: () => Promise<void>;

  // Admin actions
  fetchAdminDashboard: () => Promise<void>;
  fetchAdminUsers: (page?: number, search?: string) => Promise<void>;
  fetchAdminWalletRequests: (filters?: { status?: string; dateFrom?: string; dateTo?: string; type?: string }) => Promise<void>;
  approveRejectWallet: (id: string, status: string, adminNote?: string) => Promise<void>;
  declareResult: (gameId: string, result: string, date: string) => Promise<void>;
  updateGame: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  fetchAdminGames: () => Promise<void>;
  toggleUser: (id: string, isActive: boolean) => Promise<void>;
  fetchAdminConfigs: () => Promise<void>;
  updateAdminConfigs: (configs: { key: string; value: string }[]) => Promise<void>;
  createBanner: (data: { title: string; subtitle?: string; ctaText?: string; ctaLink?: string; imageUrl?: string }) => Promise<void>;
  updateBanner: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  createNotification: (data: { title: string; message: string; type?: string; userId?: string }) => Promise<void>;

  // Admin bid management
  fetchAdminBids: (filters?: { status?: string; gameId?: string; dateFrom?: string; dateTo?: string; targetDate?: string }) => Promise<void>;

  // Bank detail
  fetchBankDetail: () => Promise<void>;
  saveBankDetail: (data: { accountHolder?: string; accountNumber?: string; ifscCode?: string; bankName?: string; upiId?: string; paymentMethod?: string }) => Promise<void>;

  // Notifications
  markNotificationsRead: (ids: string[]) => Promise<void>;

  // Support tickets
  createTicket: (data: { subject: string; message: string; type?: string }) => Promise<void>;
  fetchTickets: () => Promise<void>;
  fetchAdminTickets: (status?: string) => Promise<void>;
  updateTicket: (id: string, data: { status?: string; adminReply?: string }) => Promise<void>;

  // Referral
  referralEarnings: ReferralEarning | null;
  fetchReferralEarnings: () => Promise<void>;
  fetchAdminReferrals: (search?: string) => Promise<void>;

  // Game management
  createGame: (data: { name: string; openTime: string; closeTime: string; sortOrder?: number }) => Promise<boolean>;
  deleteGame: (id: string) => Promise<boolean>;

  // Game play actions
  selectGame: (game: GameItem | null) => void;
  setBidType: (type: 'single' | 'jodi') => void;
  toggleNumber: (num: string) => void;
  setBidAmount: (amount: number) => void;
  clearBidSelection: () => void;
}

// -- Types for API responses --
export interface GameItem {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  sortOrder: number;
  isAcceptingBids: boolean;
  todayResult: { id: string; result: string; date: string; declaredAt: string } | null;
  todayResultDeclared: boolean;
  nextDayBiddingAvailable: boolean;
  nextDayDate: string;
  _count?: { bids: number; results: number };
}

export interface BidItem {
  id: string;
  userId: string;
  gameId: string;
  bidType: string;
  number: string;
  amount: number;
  status: string;
  winAmount: number | null;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
  game: { id: string; name: string };
}

export interface BannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface WalletTransactionItem {
  id: string;
  userId: string;
  type: string;
  amount: number;
  status: string;
  upiNumber: string | null;
  bankAccount: string | null;
  utrNumber: string | null;
  screenshotUrl: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  mobile: string;
  role: string;
  balance: number;
  winningAmount: number;
  referralCode: string;
  isActive: boolean;
  createdAt: string;
  _count: { bids: number; transactions: number };
}

export interface AdminWalletRequest {
  id: string;
  userId: string;
  type: string;
  amount: number;
  status: string;
  upiNumber: string | null;
  bankAccount: string | null;
  utrNumber: string | null;
  screenshotUrl: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; mobile: string };
}

export interface AdminStats {
  users: { total: number; active: number };
  bids: { today: number; pending: number };
  revenue: number;
  payouts: number;
  profit: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  recentActivity: {
    id: string;
    amount: number;
    status: string;
    bidType: string;
    number: string;
    createdAt: string;
    user: { id: string; name: string };
    game: { id: string; name: string };
  }[];
}

export interface AdminConfigItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface AdminBidItem {
  id: string;
  userId: string;
  gameId: string;
  bidType: string;
  number: string;
  amount: number;
  status: string;
  winAmount: number | null;
  targetDate: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; mobile: string };
  game: { id: string; name: string };
}

export interface SupportTicketItem {
  id: string;
  userId: string;
  subject: string;
  message: string;
  type: string;
  status: string;
  priority: string;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; mobile: string };
}

export interface ReferralEarning {
  totalEarnings: number;
  referredUsersCount: number;
  pendingReferrals: number;
  completedReferrals: number;
  referralCode: string;
  referralTransactions: {
    id: string;
    amount: number;
    adminNote: string | null;
    createdAt: string;
  }[];
  referredUsers: {
    id: string;
    name: string;
    mobile: string;
    referralBonusClaimed: boolean;
    createdAt: string;
  }[];
}

export interface AdminBidsSummary {
  totalBids: number;
  totalAmount: number;
  pendingBids: number;
  wonBids: number;
  lostBids: number;
  totalPayout: number;
}

export interface AdminReferralItem {
  id: string;
  name: string;
  mobile: string;
  referralCode: string;
  isActive: boolean;
  balance: number;
  createdAt: string;
  totalReferred: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalBonusEarned: number;
  bonusTransactions: {
    id: string;
    userId: string;
    amount: number;
    adminNote: string | null;
    createdAt: string;
  }[];
  referredUsers: {
    id: string;
    name: string;
    mobile: string;
    referralBonusClaimed: boolean;
    balance: number;
    createdAt: string;
  }[];
}

export interface AdminReferralStats {
  totalReferrers: number;
  totalReferredUsers: number;
  totalBonusClaimed: number;
  totalBonusPending: number;
  totalBonusPaid: number;
}

export const useGameStore = create<GameState>((set, get) => ({
  // -- Initial state (load once from localStorage) --
  ...(() => {
    const cached = loadPersistedAuth();
    return {
      user: cached.user,
      authToken: cached.authToken,
      isAuthenticated: !!cached.authToken,
      isLoading: false,
      adminMode: cached.adminMode,
      currentView: cached.adminMode ? 'admin-dashboard' : (cached.authToken ? 'home' : 'auth'),
    };
  })(),
  selectedGame: null,
  games: [],
  bids: [],
  banners: [],
  notifications: [],
  walletTransactions: [],
  selectedBidType: 'single',
  selectedNumbers: [],
  bidAmount: 10,
  bidTargetDate: 'today',
  adminUsers: [],
  adminWalletRequests: [],
  adminStats: null,
  adminConfigs: [],
  adminBids: [],
  adminBidsSummary: null,
  bidFilterGameId: null,
  supportTickets: [],
  adminTickets: [],
  adminReferrals: [],
  adminReferralStats: null,
  bankDetail: null,
  referralEarnings: null,
  siteConfig: {
    whatsappNumber: '919999999999',
    telegramLink: '',
    telegramEnabled: false,
    upiId: '',
    qrCodeUrl: '',
    minDepositAmount: 200,
    siteName: 'MatkaKing',
    referralBonusEnabled: true,
    referralBonusPercentage: 10,
    referralBonusMaxAmount: 50,
  },

  // -- Auth actions --
  login: async (mobile: string, password: string) => {
    try {
      const res = await robustFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password }),
        timeout: 10000,
        retries: 1,
        retryDelay: 500,
        noRetryStatuses: [],
      });
      const json = await safeJsonParse<{ success: boolean; data: { token: string } & Record<string, unknown>; error?: string }>(res);
      if (!json.success) {
        toast({ title: 'Login Failed', description: json.error || 'Invalid credentials', variant: 'destructive' });
        return;
      }
      const { token, ...user } = json.data;
      set({
        user,
        authToken: token,
        isAuthenticated: true,
        isLoading: false,
        adminMode: false,
        currentView: 'home',
      });
      persistAuth(user, token);
      toast({ title: 'Welcome back!', description: `Logged in as ${user.name}` });
      get().fetchGames();
      get().fetchBanners();
      get().fetchNotifications();
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    }
  },

  register: async (name: string, mobile: string, password: string, referralCode?: string) => {
    try {
      const res = await robustFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, password, referralCode }),
        timeout: 15000,
        retries: 2,
        retryDelay: 800,
        noRetryStatuses: [],
      });
      const json = await safeJsonParse<{ success: boolean; data: { token: string } & Record<string, unknown>; error?: string }>(res);
      if (!json.success) {
        toast({ title: 'Registration Failed', description: json.error || 'Registration failed', variant: 'destructive' });
        return;
      }
      const { token, ...user } = json.data;
      set({ user, authToken: token, isAuthenticated: true, isLoading: false, currentView: 'home' });
      persistAuth(user, token);
      toast({ title: 'Welcome!', description: 'Account created successfully' });
      get().fetchGames();
      get().fetchBanners();
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    }
  },

  logout: async () => {
    persistAuth(null, null);
    set({
      user: null,
      authToken: null,
      isAuthenticated: false,
      isLoading: false,
      adminMode: false,
      currentView: 'auth',
      selectedGame: null,
      games: [],
      bids: [],
      banners: [],
      notifications: [],
      walletTransactions: [],
      adminUsers: [],
      adminWalletRequests: [],
      adminStats: null,
      adminConfigs: [],
      adminBids: [],
      adminBidsSummary: null,
      bidFilterGameId: null,
      supportTickets: [],
      adminTickets: [],
      adminReferrals: [],
      adminReferralStats: null,
      bankDetail: null,
      referralEarnings: null,
      selectedBidType: 'single',
      selectedNumbers: [],
      bidAmount: 10,
      bidTargetDate: 'today',
    });
    toast({ title: 'Logged out', description: 'See you soon!' });
  },

  checkSession: async () => {
    try {
      let token = get().authToken;
      if (!token) {
        const persisted = loadPersistedAuth();
        if (persisted.authToken && persisted.user) {
          token = persisted.authToken;
          set({ authToken: token, user: persisted.user, isAuthenticated: true });
        }
      }
      if (!token) {
        set({ user: null, authToken: null, isAuthenticated: false, currentView: 'auth' });
        return;
      }
      const res = await authFetch('/api/auth/session', {
        timeout: 6000,
        retries: 0,
      });
      const json = await res.json();
      if (json.success) {
        const { token: newToken, ...user } = json.data;
        set({
          user,
          authToken: newToken || token,
          isAuthenticated: true,
          adminMode: false,
          currentView: 'home',
        });
        persistAuth(user, newToken || token);
        get().fetchGames();
        get().fetchBanners();
        get().fetchNotifications();
      } else {
        // Server explicitly rejected the token (401/403/404 - expired/invalid) - clear auth
        set({ user: null, authToken: null, isAuthenticated: false, currentView: 'auth' });
        persistAuth(null, null);
      }
    } catch {
      // Network error, timeout, or robustFetch threw for 401/403/404
      const cached = loadPersistedAuth();
      if (cached.user && cached.authToken) {
        set({ isAuthenticated: true });
      } else {
        set({ user: null, authToken: null, isAuthenticated: false, currentView: 'auth' });
      }
    }
  },

  // -- Navigation --
  navigate: (view) => {
    const prev = get().currentView;
    if (prev === view) return; // no-op if same view
    set({ currentView: view });
    // Push browser history so mobile back button works within the app
    if (typeof window !== 'undefined') {
      window.history.pushState({ mkView: view }, '', window.location.pathname + window.location.hash);
    }
  },

  setAdminMode: (mode) => {
    const isAdmin = get().user?.role === 'admin';
    if (mode && isAdmin) {
      set({ adminMode: true, currentView: get().currentView.startsWith('admin-') ? get().currentView : 'admin-dashboard' });
      // Set hash to #admin for direct URL access
      if (typeof window !== 'undefined' && window.location.hash !== '#admin') {
        window.history.replaceState(null, '', '#admin');
      }
    } else {
      set({ adminMode: false, currentView: 'home' });
      // Clear hash when switching back to user mode
      if (typeof window !== 'undefined' && window.location.hash === '#admin') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    // Persist adminMode
    const state = get();
    persistAuth(state.user, state.authToken);
  },

  // -- Data fetchers --
  fetchGames: async () => {
    try {
      const res = await authFetch('/api/games');
      const json = await res.json();
      if (json.success) {
        // Also refresh selectedGame so it never goes stale
        const currentSelected = get().selectedGame;
        let updatedSelected = currentSelected;
        if (currentSelected) {
          const fresh = json.data.find((g: GameItem) => g.id === currentSelected.id);
          if (fresh) updatedSelected = fresh;
        }
        set({ games: json.data, selectedGame: updatedSelected });
      }
    } catch {
      // Silently fail
    }
  },

  fetchAdminGames: async () => {
    try {
      const res = await authFetch('/api/admin/games');
      const json = await res.json();
      if (json.success) {
        const currentSelected = get().selectedGame;
        let updatedSelected = currentSelected;
        if (currentSelected) {
          const fresh = json.data.find((g: GameItem) => g.id === currentSelected.id);
          if (fresh) updatedSelected = fresh;
        }
        set({ games: json.data, selectedGame: updatedSelected });
      }
    } catch {
      // Silently fail
    }
  },

  fetchBids: async (filters?: { status?: string; gameId?: string }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.gameId) params.set('gameId', filters.gameId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`/api/bids${query}`);
      const json = await res.json();
      if (json.success) {
        set({ bids: json.data });
      }
    } catch {
      // Silently fail
    }
  },

  fetchBanners: async () => {
    try {
      const res = await authFetch('/api/banners');
      const json = await res.json();
      if (json.success) {
        set({ banners: Array.isArray(json.data) ? json.data : [] });
      }
    } catch {
      // Silently fail
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await authFetch('/api/notifications');
      const json = await res.json();
      if (json.success) {
        set({ notifications: json.data });
      }
    } catch {
      // Silently fail
    }
  },

  fetchWallet: async () => {
    try {
      const res = await authFetch('/api/wallet');
      const json = await res.json();
      if (json.success) {
        set({
          user: get().user ? { ...get().user!, balance: json.data.balance, winningAmount: json.data.winningAmount } : null,
          walletTransactions: json.data.transactions,
        });
      }
    } catch {
      // Silently fail
    }
  },

  // -- User actions --
  placeBid: async (gameId, bidType, number, amount, targetDate?) => {
    // Server decides the target date (today vs tomorrow) based on IST time and game state
    // We do NOT send targetDate from the client — eliminates all timezone mismatch issues
    let res: Response;
    try {
      res = await authFetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, bidType, number, amount }),
      });
    } catch {
      throw new Error('Server is not reachable. Please refresh the page and try again.');
    }
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new Error('Server error. Please try again in a moment.');
    }
    if (!json.success) {
      throw new Error(json.error || 'Failed to place bid');
    }
    const desc = json.message || `₹${amount} on ${number}`;
    toast({ title: 'Bid Placed!', description: desc });
    get().fetchWallet();
    get().fetchBids();
  },

  requestRecharge: async (amount, upiNumber, utrNumber, screenshotUrl) => {
    try {
      const res = await authFetch('/api/wallet/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, upiNumber, utrNumber, screenshotUrl }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Recharge Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Recharge Requested', description: json.message || 'Awaiting admin approval' });
      get().fetchWallet();
    } catch {
      toast({ title: 'Error', description: 'Failed to request recharge', variant: 'destructive' });
    }
  },

  requestWithdrawal: async (data) => {
    try {
      const res = await authFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Withdrawal Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Withdrawal Requested', description: 'Awaiting admin approval' });
      get().fetchWallet();
    } catch {
      toast({ title: 'Error', description: 'Failed to request withdrawal', variant: 'destructive' });
    }
  },

  // -- Bank detail actions --
  fetchBankDetail: async () => {
    try {
      const res = await authFetch('/api/bank-detail');
      const json = await res.json();
      if (json.success) {
        set({ bankDetail: json.data || null });
      }
    } catch {
      // Silently fail
    }
  },

  saveBankDetail: async (data) => {
    try {
      const res = await authFetch('/api/bank-detail', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Save Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Details Saved', description: 'Payment details updated' });
      get().fetchBankDetail();
    } catch {
      toast({ title: 'Error', description: 'Failed to save bank details', variant: 'destructive' });
    }
  },

  // -- Mark notifications read --
  markNotificationsRead: async (ids) => {
    try {
      await authFetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      });
      get().fetchNotifications();
    } catch {
      // Silently fail
    }
  },

  // -- Site config actions --
  fetchSiteConfig: async () => {
    try {
      const res = await fetch('/api/config');
      const json = await res.json();
      if (json.success) {
        set({ siteConfig: json.data });
      }
    } catch {
      // Silently fail - use defaults
    }
  },

  // -- Admin actions --
  fetchAdminDashboard: async () => {
    try {
      const res = await authFetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        const data = json.data;
        // Ensure all expected fields exist with safe defaults
        set({
          adminStats: {
            ...data,
            recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
            users: data.users || { total: 0, active: 0 },
            bids: data.bids || { today: 0, pending: 0 },
          }
        });
      }
    } catch {
      // Silently fail
    }
  },

  fetchAdminUsers: async (page = 1, search = '') => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await authFetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const users = Array.isArray(json.data) ? json.data : (json.data?.users || []);
        set({ adminUsers: users });
      }
    } catch {
      // Silently fail
    }
  },

  fetchAdminWalletRequests: async (filters?: { status?: string; dateFrom?: string; dateTo?: string; type?: string }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.type) params.set('type', filters.type);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`/api/admin/wallet${query}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data;
        // API may return {transactions: [...], pagination: {...}} or [...]
        const list = Array.isArray(data) ? data : (data.transactions || []);
        set({ adminWalletRequests: list });
      }
    } catch {
      // Silently fail
    }
  },

  approveRejectWallet: async (id, status, adminNote?) => {
    try {
      const res = await authFetch(`/api/admin/wallet/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: adminNote || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Action Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Updated', description: `Transaction ${status}` });
      get().fetchAdminWalletRequests();
    } catch {
      toast({ title: 'Error', description: 'Failed to update transaction', variant: 'destructive' });
    }
  },

  declareResult: async (gameId, result, date) => {
    let res: Response;
    try {
      res = await authFetch('/api/admin/results', {
        method: 'POST',
        body: JSON.stringify({ gameId, result, date }),
      });
    } catch {
      throw new Error('Server is not reachable. Please refresh and try again.');
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to declare result');
    }
    toast({ title: 'Result Declared', description: json.message });
    get().fetchAdminDashboard();
    // Refresh games so todayResultDeclared/nextDayBiddingAvailable updates immediately
    get().fetchGames();
  },

  updateGame: async (id, data) => {
    try {
      const res = await authFetch(`/api/admin/games/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Update Failed', description: json.error, variant: 'destructive' });
        return false;
      }
      toast({ title: 'Game Updated', description: json.message });
      get().fetchGames();
      return true;
    } catch {
      toast({ title: 'Error', description: 'Failed to update game', variant: 'destructive' });
      return false;
    }
  },

  toggleUser: async (id, isActive) => {
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Update Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'User Updated', description: `User ${isActive ? 'activated' : 'deactivated'}` });
      get().fetchAdminUsers();
    } catch {
      toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' });
    }
  },

  fetchAdminConfigs: async () => {
    try {
      const res = await authFetch('/api/admin/config');
      const json = await res.json();
      if (json.success) {
        set({ adminConfigs: Array.isArray(json.data) ? json.data : [] });
      }
    } catch {
      // Silently fail
    }
  },

  updateAdminConfigs: async (configs) => {
    try {
      const res = await authFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ configs }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Config Update Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Configs Updated', description: json.message });
      get().fetchAdminConfigs();
    } catch {
      toast({ title: 'Error', description: 'Failed to update configs', variant: 'destructive' });
    }
  },

  createBanner: async (data) => {
    try {
      const res = await authFetch('/api/admin/banners', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Banner Creation Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Banner Created', description: json.message });
      get().fetchBanners();
    } catch {
      toast({ title: 'Error', description: 'Failed to create banner', variant: 'destructive' });
    }
  },

  updateBanner: async (id, data) => {
    try {
      const res = await authFetch(`/api/admin/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Banner Update Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Banner Updated', description: json.message });
      get().fetchBanners();
    } catch {
      toast({ title: 'Error', description: 'Failed to update banner', variant: 'destructive' });
    }
  },

  deleteBanner: async (id) => {
    try {
      const res = await authFetch(`/api/admin/banners/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Delete Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Banner Deleted', description: json.message });
      get().fetchBanners();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete banner', variant: 'destructive' });
    }
  },

  fetchAdminBids: async (filters) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.gameId) params.set('gameId', filters.gameId);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.targetDate) params.set('targetDate', filters.targetDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`/api/admin/bids${query}`);
      const json = await res.json();
      if (json.success) {
        const bids = Array.isArray(json.data) ? json.data : (json.data?.bids || []);
        const summary = json.summary || json.data?.summary || null;
        set({ adminBids: bids, adminBidsSummary: summary, bidFilterGameId: filters?.gameId || null });
      }
    } catch {
      // Ensure adminBids is always an array even on error
      set({ adminBids: [], adminBidsSummary: null });
    }
  },

  createTicket: async (data) => {
    try {
      const res = await authFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Ticket Created', description: 'We will respond soon' });
      get().fetchTickets();
    } catch {
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    }
  },

  fetchTickets: async () => {
    try {
      const res = await authFetch('/api/tickets');
      const json = await res.json();
      if (json.success) set({ supportTickets: json.data });
    } catch {}
  },

  fetchAdminTickets: async (status) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`/api/admin/tickets${query}`);
      const json = await res.json();
      if (json.success) set({ adminTickets: Array.isArray(json.data) ? json.data : [] });
    } catch {}
  },

  updateTicket: async (id, data) => {
    try {
      const res = await authFetch(`/api/admin/tickets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Updated', description: 'Ticket updated' });
      get().fetchAdminTickets();
    } catch {
      toast({ title: 'Error', description: 'Failed to update ticket', variant: 'destructive' });
    }
  },

  createGame: async (data) => {
    try {
      const res = await authFetch('/api/admin/games', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Failed', description: json.error, variant: 'destructive' });
        return false;
      }
      toast({ title: 'Game Created', description: json.message });
      get().fetchGames();
      return true;
    } catch {
      toast({ title: 'Error', description: 'Failed to create game', variant: 'destructive' });
      return false;
    }
  },

  deleteGame: async (id) => {
    try {
      const res = await authFetch(`/api/admin/games/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Failed', description: json.error, variant: 'destructive' });
        return false;
      }
      toast({ title: 'Deleted', description: json.message });
      get().fetchGames();
      return true;
    } catch {
      toast({ title: 'Error', description: 'Failed to delete game', variant: 'destructive' });
      return false;
    }
  },

  createNotification: async (data) => {
    try {
      const res = await authFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: 'Notification Failed', description: json.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Notification Created', description: json.message });
    } catch {
      toast({ title: 'Error', description: 'Failed to create notification', variant: 'destructive' });
    }
  },

  // -- Referral actions --
  fetchReferralEarnings: async () => {
    try {
      const res = await authFetch('/api/referral/earnings');
      const json = await res.json();
      if (json.success) {
        set({ referralEarnings: json.data });
      }
    } catch {
      // Silently fail
    }
  },

  fetchAdminReferrals: async (search = '') => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`/api/admin/referrals${query}`);
      const json = await res.json();
      if (json.success) {
        set({
          adminReferrals: Array.isArray(json.data) ? json.data : [],
          adminReferralStats: json.stats || null,
        });
      }
    } catch {
      set({ adminReferrals: [], adminReferralStats: null });
    }
  },

  // -- Game play actions --
  selectGame: (game) => {
    const prev = get().currentView;
    set({ selectedGame: game, currentView: 'game-play' });
    // Push browser history so back button returns to previous view
    if (typeof window !== 'undefined' && prev !== 'game-play') {
      window.history.pushState({ mkView: 'game-play' }, '', window.location.pathname + window.location.hash);
    }
  },

  setBidType: (type) => {
    set({ selectedBidType: type, selectedNumbers: [] });
  },

  toggleNumber: (num) => {
    const current = get().selectedNumbers;
    if (current.includes(num)) {
      set({ selectedNumbers: current.filter((n) => n !== num) });
    } else {
      set({ selectedNumbers: [...current, num] });
    }
  },

  setBidAmount: (amount) => {
    set({ bidAmount: amount });
  },

  clearBidSelection: () => {
    set({ selectedNumbers: [], bidAmount: 10, selectedBidType: 'single', bidTargetDate: 'today' });
  },
}));
