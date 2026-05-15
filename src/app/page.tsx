'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store';

// Dynamic imports with SSR disabled to minimize server memory usage
// Components load only on the client side, reducing initial render cost
const LoginPage = dynamic(() => import('@/components/auth/LoginPage'), { 
  ssr: false,
  loading: () => <LoadingScreen />,
});
const RegisterPage = dynamic(() => import('@/components/auth/RegisterPage'), { 
  ssr: false,
  loading: () => <LoadingScreen />,
});
const ForgotPasswordPage = dynamic(() => import('@/components/auth/ForgotPasswordPage'), { 
  ssr: false,
  loading: () => <LoadingScreen />,
});
const AppShell = dynamic(() => import('@/components/layout/AppShell'), { 
  ssr: false,
  loading: () => <LoadingScreen />,
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 mt-1">Loading MatkaKing...</p>
      </div>
    </div>
  );
}

export default function Page() {
  const { isAuthenticated, currentView, checkSession } = useGameStore();
  const initialized = useRef(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const initApp = useCallback(() => {
    checkSession().finally(() => {
      setTimeout(() => setShowOverlay(false), 200);
    });
    fetch('/api/init').catch(() => {});
  }, [checkSession]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initApp();
    }
  }, [initApp]);

  useEffect(() => {
    const timer = setTimeout(() => setShowOverlay(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const mainContent = !isAuthenticated
    ? (currentView === 'register' ? <RegisterPage /> : 
       currentView === 'forgot-password' ? <ForgotPasswordPage /> : 
       <LoginPage />)
    : <AppShell />;

  return (
    <>
      {mainContent}
      {showOverlay && <LoadingScreen />}
    </>
  );
}
