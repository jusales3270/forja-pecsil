import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';
import { PAPEL_LABEL } from '@forja/shared';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  /**
   * Se passado, mostra um botão "Voltar" à esquerda.
   * - string com rota (ex: '/os') → navega pra rota
   * - 'back' → usa navigate(-1) (volta na história do browser)
   */
  voltarPara?: string;
  /**
   * Trilha de navegação opcional. Se passada, substitui o `title` simples.
   * Ex: [{ label: 'Ordens de Serviço', to: '/os' }, { label: 'teste-001' }]
   */
  breadcrumb?: BreadcrumbItem[];
}

export function AppLayout({
  children,
  title,
  voltarPara,
  breadcrumb,
}: AppLayoutProps) {
  const { pessoa, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleVoltar = () => {
    if (!voltarPara) return;
    if (voltarPara === 'back') navigate(-1);
    else navigate(voltarPara);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Lado esquerdo: voltar + logo + title/breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {voltarPara && (
              <button
                onClick={handleVoltar}
                className="flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition-colors shrink-0 px-2 py-1 rounded border border-neutral-800 hover:border-neutral-700"
                title="Voltar"
              >
                <span className="text-base leading-none">←</span>
                <span>Voltar</span>
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="text-2xl font-extrabold text-forja-500 tracking-tight hover:text-forja-600 transition-colors shrink-0"
            >
              FORJA
            </button>
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="flex items-center gap-2 min-w-0 text-sm">
                {breadcrumb.map((item, idx) => {
                  const ultimo = idx === breadcrumb.length - 1;
                  return (
                    <span key={idx} className="flex items-center gap-2 min-w-0">
                      <span className="text-neutral-700 shrink-0">/</span>
                      {item.to && !ultimo ? (
                        <button
                          onClick={() => navigate(item.to!)}
                          className="text-neutral-400 hover:text-neutral-100 transition-colors truncate"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <span
                          className={`truncate ${
                            ultimo ? 'text-neutral-100 font-medium' : 'text-neutral-400'
                          }`}
                        >
                          {item.label}
                        </span>
                      )}
                    </span>
                  );
                })}
              </nav>
            ) : title ? (
              <>
                <span className="text-neutral-700 shrink-0">/</span>
                <h1 className="text-lg font-medium text-neutral-200 truncate">
                  {title}
                </h1>
              </>
            ) : null}
          </div>

          {/* Lado direito: usuário + sair */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-neutral-100">
                {pessoa?.nome}
              </p>
              <p className="text-xs text-neutral-500">
                {PAPEL_LABEL[pessoa?.papel ?? 'admin']}
              </p>
            </div>
            <button onClick={handleLogout} className="btn-ghost px-3 py-2 text-sm">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>

      {/* Footer simples */}
      <footer className="border-t border-neutral-900 py-4">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-neutral-600">
          Forja · Antigravity · Pecsil
        </div>
      </footer>
    </div>
  );
}
