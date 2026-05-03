'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children:  ReactNode;
  /** Optional custom fallback. Receives reset() to retry. */
  fallback?: (reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  isNetwork: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isNetwork: false };

  static getDerivedStateFromError(error: Error): State {
    const isNetwork =
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to') ||
      error.name === 'ApiError';
    return { hasError: true, isNetwork };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, isNetwork: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback(this.reset);

    return <DefaultFallback isNetwork={this.state.isNetwork} onRetry={this.reset} />;
  }
}

/* ── Default fallback UI ──────────────────────────────────── */
function DefaultFallback({ isNetwork, onRetry }: { isNetwork: boolean; onRetry: () => void }) {
  return (
    <div className="error-boundary-wrap" role="alert">
      <div className="error-boundary-icon" aria-hidden="true">
        {isNetwork ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 6s4-4 11-4 11 4 11 4"/>
            <path d="M5 10s2.5-2.5 7-2.5 7 2.5 7 2.5"/>
            <path d="M9 14s1.5-1.5 3-1.5 3 1.5 3 1.5"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>
      <h2 className="error-boundary-title">
        {isNetwork ? 'Connection Issue' : 'Something went wrong'}
      </h2>
      <p className="error-boundary-msg">
        {isNetwork
          ? 'Unable to reach the TUKLAS server. Check your connection and try again.'
          : 'An unexpected error occurred. Please try again.'}
      </p>
      <button className="error-boundary-retry" onClick={onRetry}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" aria-hidden="true">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
        </svg>
        Try Again
      </button>
    </div>
  );
}
