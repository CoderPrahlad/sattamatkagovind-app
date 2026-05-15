'use client';

import { useEffect } from 'react';
import { Crown, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Detect error types
  const msg = error?.message || '';
  const isJsonError = msg.includes('is not valid JSON') || 
                      msg.includes('Unexpected token') ||
                      msg.includes('DOCTYPE') ||
                      msg.includes('Server returned HTML');

  const isTransientError = 
    msg.includes('is not valid JSON') ||
    msg.includes('Unexpected token') ||
    msg.includes('DOCTYPE') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('Server error') ||
    msg.includes('Server returned HTML') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('timeout');

  useEffect(() => {
    // Log the error
    console.error('[MatkaKing] Page error:', error?.message || error);

    // Auto-recover from transient errors after a delay
    // These are typically caused by server restarts or brief connectivity issues
    if (isTransientError) {
      console.log('[MatkaKing] Auto-recovering from transient error...');
      const timer = setTimeout(() => {
        reset();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [error, reset, isTransientError]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/20">
          <Crown className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isTransientError ? 'Reconnecting...' : isJsonError ? 'Connection Error' : 'Something went wrong'}
          </h1>
          <p className="text-gray-400 text-sm mb-3">
            {isTransientError 
              ? 'Experiencing a brief connectivity issue. Auto-recovering...'
              : isJsonError 
              ? 'The server returned an unexpected response. This usually happens during server restarts or temporary connectivity issues.'
              : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-left max-w-full overflow-auto">
              <p className="text-xs text-red-400 font-mono break-all">{error?.message || 'Unknown error'}</p>
              {error?.digest && <p className="text-xs text-gray-600 mt-1">Digest: {error.digest}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              if (isJsonError && typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {isJsonError ? 'Reload Page' : 'Try Again'}
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
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
