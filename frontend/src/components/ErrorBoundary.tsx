import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full bg-[#20212A] border border-red-500/30 rounded-2xl p-5 shadow-2xl text-center space-y-3">
          <div className="text-2xl">⚠️</div>
          <h4 className="text-sm font-bold text-[#F3F4F6] uppercase tracking-wider">
            {this.props.fallbackTitle || 'Section Display Notice'}
          </h4>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {this.state.error?.message || 'A temporary visual render issue occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-[#B8F34A] hover:bg-[#a6e038] text-[#101116] rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Retry View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
