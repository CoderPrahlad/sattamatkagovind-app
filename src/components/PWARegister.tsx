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

        // Check for updates every 5 minutes (not 60 seconds — reduces blank flashes)
        const updateInterval = setInterval(() => {
          reg.update();
        }, 300000); // 5 minutes

        // When a new version is WAITING, show a banner instead of auto-reloading
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version is installed and waiting — show update banner
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

    // Show install prompt
    let deferredPrompt: unknown = null;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;

      const hasSeenPrompt = localStorage.getItem('mk_pwa_prompt_dismissed');
      if (!hasSeenPrompt) {
        setTimeout(showInstallBanner, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    function showInstallBanner() {
      const existing = document.getElementById('pwa-install-banner');
      if (existing) return;

      const banner = document.createElement('div');
      banner.id = 'pwa-install-banner';
      banner.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 9999; background: #111827; border: 1px solid #059669;
        border-radius: 12px; padding: 16px 20px; display: flex; align-items: center;
        gap: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); max-width: 340px; width: calc(100% - 32px);
        animation: slideUp 0.3s ease-out;
      `;

      banner.innerHTML = `
        <style>
          @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        </style>
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        </div>
        <div style="flex:1;min-width:0;">
          <p style="margin:0;color:#f3f4f6;font-size:13px;font-weight:600;">Install MatkaKing</p>
          <p style="margin:2px 0 0;color:#9ca3af;font-size:11px;">Add to home screen for app experience</p>
        </div>
        <button id="pwa-install-btn" style="
          background:#059669;color:white;border:none;padding:8px 14px;
          border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
          flex-shrink:0;
        ">Install</button>
        <button id="pwa-dismiss-btn" style="
          background:transparent;border:none;color:#6b7280;cursor:pointer;
          padding:4px;flex-shrink:0;font-size:16px;line-height:1;
        ">✕</button>
      `;

      document.body.appendChild(banner);

      document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
        if (deferredPrompt) {
          (deferredPrompt as { prompt: () => Promise<void> }).prompt();
          const result = await (deferredPrompt as { userChoice: Promise<{ outcome: string }> }).userChoice;
          if (result.outcome === 'accepted') {
            console.log('[PWA] User accepted install');
          }
          deferredPrompt = null;
        }
        banner.remove();
      });

      document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
        localStorage.setItem('mk_pwa_prompt_dismissed', 'true');
        banner.remove();
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle update: user manually clicks to reload
  const handleUpdate = () => {
    // Tell the waiting service worker to skip waiting and activate
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload after a small delay to let the new SW take over
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <>
      {/* Update Available Banner — replaces auto-reload */}
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
