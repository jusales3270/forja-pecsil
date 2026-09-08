// ============================================================
// Forja - Error Boundary
// Previne que erros de renderização derrubem o aplicativo
// inteiro ou deixem a tela preta.
// ============================================================

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  voltarUrl?: string;
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
    console.error('[Forja ErrorBoundary caught an error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const voltarUrl = this.props.voltarUrl ?? '/os';
      const isLight = document.querySelector('.theme-light') !== null ||
        localStorage.getItem('forja-theme')?.includes('"claro":true');

      return (
        <div
          className={`min-h-screen flex items-center justify-center p-6 ${
            isLight ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-neutral-100'
          }`}
        >
          <div
            className={`max-w-lg w-full rounded-2xl p-6 sm:p-8 border shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 text-xl font-bold">
                !
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {this.props.fallbackTitle ?? 'Erro ao carregar os dados'}
                </h2>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  {this.props.fallbackMessage ??
                    'Ocorreu uma falha inesperada na interface ao processar esta página.'}
                </p>
              </div>
            </div>

            {this.state.error?.message && (
              <div
                className={`text-xs font-mono p-3 rounded-lg border mb-5 overflow-x-auto ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-red-700'
                    : 'bg-neutral-950 border-neutral-800 text-red-400'
                }`}
              >
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary px-4 py-2 text-sm"
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = voltarUrl;
                }}
                className={`px-4 py-2 text-sm rounded-lg border transition font-medium ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                }`}
              >
                Voltar à lista
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
