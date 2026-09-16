import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';
import { useTheme } from '../lib/theme-store';
import { PAPEL_LABEL } from '@forja/shared';
import { UserHeaderWidget } from './UserHeaderWidget';
import { PainelAvisos } from './PainelAvisos';

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
  const { claro, toggleTema } = useTheme();
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

  // Paleta por tema — mesmo padrão do DashboardPage
  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        headerBg: 'bg-slate-50/80',
        headerBorder: 'border-slate-200',
        logoTexto: 'text-forja-500 hover:text-forja-600',
        userTexto: 'text-slate-900',
        userSub: 'text-slate-500',
        breadcrumbSep: 'text-slate-300',
        breadcrumbLink: 'text-slate-500 hover:text-slate-900',
        breadcrumbAtivo: 'text-slate-900',
        voltarBtn: 'text-slate-500 hover:text-slate-900 border-slate-300 hover:border-slate-400',
        footerBorder: 'border-slate-200',
        footerTexto: 'text-slate-400',
        temaBtn: 'text-slate-500 hover:text-slate-900 border border-slate-300 hover:border-slate-400',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-500',
        headerBg: 'bg-neutral-950/80',
        headerBorder: 'border-neutral-800',
        logoTexto: 'text-forja-500 hover:text-forja-600',
        userTexto: 'text-neutral-100',
        userSub: 'text-neutral-500',
        breadcrumbSep: 'text-neutral-700',
        breadcrumbLink: 'text-neutral-400 hover:text-neutral-100',
        breadcrumbAtivo: 'text-neutral-100',
        voltarBtn: 'text-neutral-400 hover:text-neutral-100 border-neutral-800 hover:border-neutral-700',
        footerBorder: 'border-neutral-900',
        footerTexto: 'text-neutral-600',
        temaBtn: 'text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:border-neutral-700',
      };

  return (
    <div className={`min-h-screen ${T.bg} ${T.texto} flex flex-col ${claro ? 'theme-light' : ''}`}>
      {/* Header */}
      <header className={`border-b ${T.headerBorder} ${T.headerBg} backdrop-blur sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Lado esquerdo: voltar + logo + title/breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {voltarPara && (
              <button
                onClick={handleVoltar}
                className={`flex items-center gap-1 text-sm transition-colors shrink-0 px-2 py-1 rounded border ${T.voltarBtn}`}
                title="Voltar"
              >
                <span className="text-base leading-none">←</span>
                <span>Voltar</span>
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className={`text-2xl font-extrabold tracking-tight transition-colors shrink-0 ${T.logoTexto}`}
            >
              FORJA
            </button>
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="flex items-center gap-2 min-w-0 text-sm">
                {breadcrumb.map((item, idx) => {
                  const ultimo = idx === breadcrumb.length - 1;
                  return (
                    <span key={idx} className="flex items-center gap-2 min-w-0">
                      <span className={`${T.breadcrumbSep} shrink-0`}>/</span>
                      {item.to && !ultimo ? (
                        <button
                          onClick={() => navigate(item.to!)}
                          className={`${T.breadcrumbLink} transition-colors truncate`}
                        >
                          {item.label}
                        </button>
                      ) : (
                        <span
                          className={`truncate ${
                            ultimo ? `${T.breadcrumbAtivo} font-medium` : T.breadcrumbLink
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
                <span className={`${T.breadcrumbSep} shrink-0`}>/</span>
                <h1 className={`text-lg font-medium truncate ${claro ? 'text-slate-700' : 'text-neutral-200'}`}>
                  {title}
                </h1>
              </>
            ) : null}
          </div>

          {/* Lado direito: tema + usuário com engrenagem + sair */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={toggleTema}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${T.temaBtn}`}
              title="Alternar tema"
            >
              {claro ? '🌙 Escuro' : '☀️ Claro'}
            </button>
            <UserHeaderWidget subtitulo={PAPEL_LABEL[pessoa?.papel ?? 'admin']} />
            {/* Recados também no backoffice: o PCP recebe mensagens do chão de fábrica */}
            <PainelAvisos />
            <button onClick={handleLogout} className={`btn-ghost px-3 py-2 text-sm ${claro ? 'text-slate-600 hover:bg-slate-100' : ''}`}>
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
      <footer className={`border-t ${T.footerBorder} py-4`}>
        <div className={`max-w-7xl mx-auto px-6 text-center text-xs ${T.footerTexto}`}>
          Forja · SomaVerso AI Systems · Pecsil
        </div>
      </footer>
    </div>
  );
}
