import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';
import { AppLayout } from '../components/AppLayout';
import { PAPEL_LABEL } from '@forja/shared';
import { temCapacidade, type Papel } from '../lib/permissions';

export function HomePage() {
  const { pessoa } = useAuth();
  const navigate = useNavigate();
  const papel = pessoa?.papel as Papel | undefined;
  const pode = (cap: Parameters<typeof temCapacidade>[1]) => temCapacidade(papel, cap);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Card de boas-vindas */}
        <div className="card">
          <p className="text-neutral-400 text-sm mb-1">Bem-vindo,</p>
          <h2 className="text-3xl font-bold mb-1">{pessoa?.nome}</h2>
          <p className="text-forja-500 font-semibold">
            {PAPEL_LABEL[pessoa?.papel ?? 'admin']}
          </p>
        </div>

        {/* Backoffice — cadastros */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Backoffice</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {pode('cadastros_tipos_servico') && (
            <button
              onClick={() => navigate('/tipos-servico')}
              className="text-left p-4 rounded-lg border border-neutral-800 hover:border-forja-500/50 hover:bg-neutral-800/30 transition-colors"
            >
              <p className="font-medium text-neutral-100">Tipos de Serviço</p>
              <p className="text-xs text-neutral-500 mt-1">
                Catálogo de operações reutilizáveis (torneamento, desbaste,
                vertiflow...)
              </p>
            </button>
            )}

            {/* Espaços reservados pras próximas telas */}
            {pode('cadastros_tolerancias') && (
            <button
              onClick={() => navigate('/tolerancias')}
              className="text-left p-4 rounded-lg border border-neutral-800 hover:border-forja-500/50 hover:bg-neutral-800/30 transition-colors"
            >
              <p className="font-medium text-neutral-100">Tolerâncias por Cliente</p>
              <p className="text-xs text-neutral-500 mt-1">
                Faixas de tolerância padrão por cliente (fallback das cotas)
              </p>
            </button>
            )}
            {pode('cadastros_artigos') && (
            <button
              onClick={() => navigate('/artigos')}
              className="text-left p-4 rounded-lg border border-neutral-800 hover:border-forja-500/50 hover:bg-neutral-800/30 transition-colors"
            >
              <p className="font-medium text-neutral-100">Artigos</p>
              <p className="text-xs text-neutral-500 mt-1">
                Biblioteca de peças com desenhos, OPs e plano de inspeção
              </p>
            </button>
            )}
            {pode('totem_acessar') && (
            <button
              onClick={() => navigate('/totem')}
              className="text-left p-4 rounded-lg border border-forja-500/30 hover:border-forja-500 bg-forja-500/5 hover:bg-forja-500/10 transition-colors"
            >
              <p className="font-medium text-forja-50">Tótem (Sprint 3)</p>
              <p className="text-xs text-neutral-400 mt-1">Programador inicia e encerra OPs no chão de fábrica</p>
            </button>
            )}
            {pode('os_listar') && (
            <button
              onClick={() => navigate('/os')}
              className="text-left p-4 rounded-lg border border-neutral-800 hover:border-forja-500/50 hover:bg-neutral-800/30 transition-colors"
            >
              <p className="font-medium text-neutral-100">Ordens de Serviço</p>
              <p className="text-xs text-neutral-500 mt-1">
                Abertura e acompanhamento de OS de produção
              </p>
            </button>
            )}
          </div>
        </div>

        {/* Status do sistema */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="badge-forja">Sprint 2a</span>
              <h3 className="text-lg font-semibold">Backoffice de Artigos</h3>
            </div>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Backend completo: 8 entidades, 42 testes verdes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Upload de desenhos para MinIO</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>Tela de Tipos de Serviço (frontend)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neutral-600 mt-0.5">○</span>
                <span className="text-neutral-500">
                  Tela de Tolerâncias por Cliente
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neutral-600 mt-0.5">○</span>
                <span className="text-neutral-500">Tela de Artigos (4 abas)</span>
              </li>
            </ul>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="badge-neutral">Próximo</span>
              <h3 className="text-lg font-semibold">Sprint 2b</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-3">
              Abertura de Ordens de Serviço, com geração automática de lotes e
              operações herdadas do Artigo cadastrado.
            </p>
            <p className="text-xs text-neutral-500">
              Esse é o módulo que conecta o cadastro de Artigos ao fluxo
              produtivo real.
            </p>
          </div>
        </div>

        {/* Info adicional pro admin */}
        {pessoa?.papel === 'admin' && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Atalhos do Sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <a
                href="http://localhost:3001/health"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <p className="font-medium text-neutral-200">Backend Health</p>
                <p className="text-xs text-neutral-500 mt-1">
                  localhost:3001/health
                </p>
              </a>
              <a
                href="http://localhost:9101"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <p className="font-medium text-neutral-200">MinIO Console</p>
                <p className="text-xs text-neutral-500 mt-1">localhost:9101</p>
              </a>
              <div className="block p-3 rounded-lg border border-neutral-800">
                <p className="font-medium text-neutral-200">Prisma Studio</p>
                <p className="text-xs text-neutral-500 mt-1">
                  pnpm db:studio
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
