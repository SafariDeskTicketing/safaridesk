import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-[var(--status-warning-text)] mb-3" />
          <p className="text-[length:var(--font-body)] font-medium text-[var(--text-primary)] mb-1">
            Something went wrong
          </p>
          <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mb-4">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-1.5 rounded-[var(--shell-radius)] bg-[var(--card-bg)] border border-[var(--border-color)] text-[length:var(--font-label)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
