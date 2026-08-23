import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Music } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-mrj-600/20 text-mrj-500 flex items-center justify-center">
            <Music className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black">MRJ Music</h1>
          <p className="text-sm text-gray-400 max-w-sm">
            Something unexpected occurred. Tap below to reload the player.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-full bg-mrj-600 hover:bg-mrj-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload App</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
