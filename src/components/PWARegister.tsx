'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function PWARegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] Service Worker registered', reg.scope);

        // Check for updates every 10 minutes
        const updateInterval = setInterval(() => {
          reg.update();
        }, 600000); // 10 minutes

        // When a new version is WAITING, show a banner instead of auto-reloading
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available (waiting for activation)');
              setUpdateAvailable(true);
              setShowBanner(true);
            }
          });
        });

        // Cleanup interval on unmount
        return () => clearInterval(updateInterval);
      } catch (err) {
        console.log('[PWA] Service Worker registration failed:', err);
      }
    };

    registerSW();
  }, []);

  // Handle update: user manually clicks to reload
  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    }
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <>
      {/* Update Available Banner — user must click to update */}
      {updateAvailable && showBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg" style={{ animation: 'slideDown 0.3s ease-out' }}>
          <style>{`
            @keyframes slideDown {
              from { transform: translateY(-100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium truncate">A new version is available</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUpdate}
              className="px-3 py-1 bg-white text-emerald-700 rounded-md text-xs font-bold hover:bg-gray-100 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="p-1 hover:bg-emerald-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
