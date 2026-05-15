'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register service worker and handle updates
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] Service Worker registered', reg.scope);

        // Check for updates every 60 seconds
        setInterval(() => {
          reg.update();
        }, 60000);

        // When a new version is available, activate it immediately
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[PWA] New version activated, refreshing...');
              // Clear any stale caches manually as well
              if ('caches' in window) {
                caches.keys().then((names) => {
                  names.forEach((name) => {
                    if (name !== 'matkaking-v4') {
                      caches.delete(name);
                    }
                  });
                });
              }
              window.location.reload();
            }
          });
        });
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

  return null;
}
