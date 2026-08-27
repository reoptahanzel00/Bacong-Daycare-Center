'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary — catches runtime errors in any child component subtree.
 * Prevents the entire app from white-screening when one section crashes.
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <SomeView />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error.message);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Report to the server so the crash reaches Vercel's runtime logs. A
    // browser console nobody is watching is not error monitoring. Sends the
    // message and stack only -- never any record on screen at the time.
    // Fire-and-forget: a failed report must not replace the error UI below.
    try {
      void fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error.message,
          componentStack: errorInfo.componentStack ?? undefined,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Reporting is best effort.
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-3xl border border-accent-coral/30 bg-[#FFF5F5] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-danger-light text-danger flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-base font-bold text-ink mb-2">Something went wrong</h3>
          <p className="text-xs text-ink-muted mb-4 max-w-sm leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="btn btn-primary btn-sm"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
