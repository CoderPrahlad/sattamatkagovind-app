'use client';

import React, { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ============ View Error Boundary ============

interface ViewBoundaryState { hasError: boolean; error: Error | null }
export class ViewBoundary extends Component<{ children: React.ReactNode }, ViewBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('[ViewBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white mb-1">Something went wrong</p>
            <p className="text-xs text-red-400 font-mono max-w-md break-all">{this.state.error?.message || 'Unknown error'}</p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ Helper Components ============

export function InputField({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-400 mb-1 block">{label}{required && '*'}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500/50" />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    won: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    lost: 'bg-red-500/20 text-red-400 border-red-500/30',
    open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    closed: 'bg-gray-700 text-gray-400 border-gray-600',
  };
  const labels: Record<string, string> = { in_progress: 'In Progress' };
  return <Badge className={`text-[10px] ${colors[status] || 'bg-gray-800 text-gray-400'}`}>{labels[status] || status}</Badge>;
}
