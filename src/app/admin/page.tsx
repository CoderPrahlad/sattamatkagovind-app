'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { useGameStore } from '@/store';
import AdminLoginPage from '@/components/auth/AdminLoginPage';
import AdminShell from '@/components/layout/AdminShell';

export default function AdminPage() {
  // ✅ Alag alag subscribe — re-render hoga jab bhi change ho
  const user = useGameStore(s => s.user);
  const isAuthenticated = useGameStore(s => s.isAuthenticated);
  const adminMode = useGameStore(s => s.adminMode);

  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      // Load persisted auth if any
      const store = useGameStore.getState();
      if (!store.authToken) {
        try {
          const saved = localStorage.getItem('mk_auth');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.authToken && parsed.user) {
              useGameStore.setState({
                authToken: parsed.authToken,
                user: parsed.user,
                isAuthenticated: true,
                adminMode: parsed.user?.role === 'admin',
              });
            }
          }
        } catch {}
      }

      // Verify token with server
      const token = useGameStore.getState().authToken;
      if (token) {
        try {
          const res = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data.role === 'admin') {
              useGameStore.setState({
                user: json.data,
                authToken: json.data.token || token,
                isAuthenticated: true,
                adminMode: true,
              });
            } else {
              useGameStore.setState({
                user: null,
                authToken: null,
                isAuthenticated: false,
                adminMode: false,
              });
              localStorage.removeItem('mk_auth');
            }
          } else {
            useGameStore.setState({
              user: null,
              authToken: null,
              isAuthenticated: false,
              adminMode: false,
            });
            localStorage.removeItem('mk_auth');
          }
        } catch {
          // Network error - trust cached data
          const cached = useGameStore.getState();
          if (cached.user?.role === 'admin') {
            useGameStore.setState({ adminMode: true });
          }
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          <p className="text-xs text-gray-500 mt-1">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  // ✅ ready state hata di — seedha store se check
  if (isAuthenticated && user?.role === 'admin' && adminMode) {
    return <AdminShell />;
  }

  return <AdminLoginPage />;
}