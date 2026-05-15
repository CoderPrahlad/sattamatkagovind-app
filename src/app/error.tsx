'use client';

import { useEffect } from 'react';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/20">
          <Crown className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-3">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-left max-w-full overflow-auto">
            <p className="text-xs text-red-400 font-mono break-all">{error?.message || 'Unknown error'}</p>
            {error?.digest && <p className="text-xs text-gray-600 mt-1">Digest: {error.digest}</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={reset}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg"
          >
            Try Again
          </Button>
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('mk_auth');
              }
              window.location.href = '/';
            }}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg"
          >
            Clear &amp; Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
