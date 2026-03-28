import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Try to parse Firestore JSON error if it exists
    let detailedInfo = null;
    try {
      if (error.message.startsWith('{') && error.message.endsWith('}')) {
        detailedInfo = JSON.parse(error.message);
      }
    } catch (e) {
      // Not a JSON error
    }

    this.setState({
      error,
      errorInfo: detailedInfo ? JSON.stringify(detailedInfo, null, 2) : error.message
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full bg-[#111] border border-white/10 rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="text-red-500 w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Something went wrong</h1>
                <p className="text-white/60 text-sm">An unexpected error has occurred in the application.</p>
              </div>
            </div>

            <div className="bg-black/50 rounded-xl p-4 mb-8 overflow-auto max-h-[300px] border border-white/5">
              <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                {this.state.errorInfo || 'No detailed error information available.'}
              </pre>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-white/90 transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-colors border border-white/10"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </div>

            <p className="mt-8 text-xs text-white/40 italic">
              If this error persists, please contact support with the error details shown above.
            </p>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
