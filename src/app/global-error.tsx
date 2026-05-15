'use client';

import { Crown } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 antialiased">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/20">
              <Crown className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-gray-400 text-sm">
                An unexpected error occurred. This is usually a temporary issue.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  try { localStorage.removeItem('mk_auth'); } catch {}
                  window.location.href = '/';
                }}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-medium rounded-lg transition-all"
              >
                Clear &amp; Reload
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
