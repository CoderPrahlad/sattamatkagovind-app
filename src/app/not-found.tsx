'use client';

import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/20">
          <Crown className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Page Not Found</h2>
          <p className="text-gray-400 text-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Button
          onClick={() => (window.location.href = '/')}
          className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg"
        >
          Back to MatkaKing
        </Button>
      </div>
    </div>
  );
}
