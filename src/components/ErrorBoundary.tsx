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
    // In production, send this to an error monitoring service (e.g. Sentry)
    console.error('[ErrorBoundary] Uncaught component error:', error.message);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-3xl border border-[#F2896B]/30 bg-[#FFF5F5] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FFEBEE] text-[#C62828] flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-base font-bold text-[#2B2B2B] mb-2">Something went wrong</h3>
          <p className="text-xs text-[#6B6B6B] mb-4 max-w-sm leading-relaxed">
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
