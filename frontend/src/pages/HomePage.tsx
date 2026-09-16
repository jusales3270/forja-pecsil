import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-store';
import { useTheme } from '../lib/theme-store';
import { AppLayout } from '../components/AppLayout';
import { PAPEL_LABEL } from '@forja/shared';
import { temCapacidade, type Papel } from '../lib/permissions';

export function HomePage() {
  const { pessoa } = useAuth();
  const { claro } = useTheme();
  const navigate = useNavigate();
  const papel = pessoa?.papel as Papel | undefined;
  const pode = (cap: Parameters<typeof temCapacidade>[1]) => temCapacidade(papel, cap);

  // Classes por tema
  const T = claro
    ? {
        cardTexto: 'text-slate-900',
        cardSub: 'text-slate-500',
        titulo: 'text-forja-600',
        itemBorder: 'border-slate-200 hover:border-forja-500/50 hover:bg-slate-50',
        itemTexto: 'text-slate-900',
        itemSub: 'text-slate-500',
        totemBorder: 'border-forja-500/30 hover:border-forja-500 bg-forja-50 hover:bg-forja-100/50',
        totemTexto: 'text-forja-700',
        totemSub: 'text-slate-500',
        dashBorder: 'border-forja-500/30 hover:border-forja-500 bg-forja-50 hover:bg-forja-100/50',
        dashTexto: 'text-forja-700',
        dashSub: 'text-slate-500',
        fantasmaBorder: 'border-red-400/30 hover:border-red-400 bg-red-50 hover:bg-red-100/50',
        fantasmaTexto: 'text-red-700',
        fantasmaSub: 'text-slate-500',
        checkOk: 'text-emerald-600',
        checkPending: 'text-slate-300',
        checkLabel: 'text-slate-700',
        checkPendingLabel: 'text-slate-400',
        atalhosBorder: 'border-slate-200 hover:border-slate-300',
        atalhosTexto: 'text-slate-700',
        atalhosSub: 'text-slate-400',
      }
    : {
        cardTexto: 'text-neutral-100',
        cardSub: 'text-neutral-400',
        titulo: 'text-forja-500',
        itemBorder: 'border-neutral-800 hover:border-forja-500/50 hover:bg-neutral-800/30',
        itemTexto: 'text-neutral-100',
        itemSub: 'text-neutral-500',
        totemBorder: 'border-forja-500/30 hover:border-forja-500 bg-forja-500/5 hover:bg-forja-500/10',
        totemTexto: 'text-forja-50',
        totemSub: 'text-neutral-400',
        dashBorder: 'border-forja-500/30 hover:border-forja-500 bg-forja-500/5 hover:bg-forja-500/10',
        dashTexto: 'text-forja-50',
        dashSub: 'text-neutral-400',
        fantasmaBorder: 'border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10',
        fantasmaTexto: 'text-red-100',
        fantasmaSub: 'text-neutral-400',
        checkOk: 'text-emerald-400',
        checkPending: 'text-neutral-600',
        checkLabel: 'text-neutral-300',
        checkPendingLabel: 'text-neutral-500',
        atalhosBorder: 'border-neutral-800 hover:border-neutral-700',
        atalhosTexto: 'text-neutral-200',
        atalhosSub: 'text-neutral-500',
      };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Card de boas-vindas */}
        <div className="card">
          <p className={`text-sm mb-1 ${T.cardSub}`}>Bem-vindo,</p>
          <h2 className={`text-3xl font-bold mb-1 ${T.cardTexto}`}>{pessoa?.nome}</h2>
          <p className={`font-semibold ${T.titulo}`}>
            {PAPEL_LABEL[pessoa?.papel ?? 'admin']}
          </p>
        </div>

        {/* Cadastros — base do roteiro de produção (1. o que existe antes de qualquer OS) */}
        {(pode('cadastros_tipos_servico') || pode('cadastros_motivos_parada') || pode('cadastros_artigos') || pode('cadastros_pessoas')) && (
        <div className="card">
          <h3 className={`text-lg font-semibold mb-1 ${T.cardTexto}`}>Cadastros</h3>
          <p className={`text-xs mb-4 ${T.cardSub}`}>Base do roteiro de produção — mantida à parte, não é uma etapa do fluxo</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {pode('cadastros_tipos_servico') && (
            <button
              onClick={() => navigate('/tipos-servico')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>Tipos de Serviço</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Catálogo de operações reutilizáveis (torneamento, desbaste,
                vertiflow...)
              </p>
            </button>
            )}
            {pode('cadastros_motivos_parada') && (
            <button
              onClick={() => navigate('/motivos-parada')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>Motivos de Parada</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Catálogo de paradas de máquina (quebra, setup, falta de
                material...) usado no Tótem e no Painel
              </p>
            </button>
            )}
            {pode('cadastros_artigos') && (
            <button
              onClick={() => navigate('/artigos')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>Artigos</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Biblioteca de peças com desenhos, OPs e plano de inspeção
              </p>
            </button>
            )}
            {pode('admin_configurar_sistema') && (
            <button
              onClick={() => navigate('/estacoes')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>Estações e Máquinas</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Onde cada operação do roteiro é feita, e as máquinas de cada estação
              </p>
            </button>
            )}
            {pode('cadastros_pessoas') && (
            <button
              onClick={() => navigate('/pessoas')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>Usuários e Estações</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Login de cada processo e das pessoas. Cada estação opera a sua e
                acompanha as demais
              </p>
            </button>
            )}
          </div>
        </div>
        )}

        {/* Produção — sequência real do PCP: abrir OS -> executar no tótem -> acompanhar -> tratar exceções */}
        {(pode('os_listar') || pode('totem_acessar') || pode('dashboard_chefe') || pode('fantasmas_ver')) && (
        <div className="card">
          <h3 className={`text-lg font-semibold mb-1 ${T.cardTexto}`}>Fluxo de PCP</h3>
          <p className={`text-xs mb-4 ${T.cardSub}`}>Sequência real do processo, do pedido até a entrega</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {pode('os_listar') && (
            <button
              onClick={() => navigate('/os')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.itemBorder}`}
            >
              <p className={`font-medium ${T.itemTexto}`}>1. Ordens de Serviço</p>
              <p className={`text-xs mt-1 ${T.itemSub}`}>
                Abertura da OS: gera os lotes e as OPs de produção
              </p>
            </button>
            )}
            {pode('totem_acessar') && (
            <button
              onClick={() => navigate('/totem')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.totemBorder}`}
            >
              <p className={`font-medium ${T.totemTexto}`}>2. Tótem</p>
              <p className={`text-xs mt-1 ${T.totemSub}`}>Programador inicia e encerra OPs no chão de fábrica</p>
            </button>
            )}
            {pode('dashboard_chefe') && (
            <button
              onClick={() => navigate('/dashboard')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.dashBorder}`}
            >
              <p className={`font-medium ${T.dashTexto}`}>3. Painel de Produção</p>
              <p className={`text-xs mt-1 ${T.dashSub}`}>
                Visão macro: OS por status, atrasadas, produção por etapa, inspeção
              </p>
            </button>
            )}
            {pode('fantasmas_ver') && (
            <button
              onClick={() => navigate('/lotes-fantasmas')}
              className={`text-left p-4 rounded-lg border transition-colors ${T.fantasmaBorder}`}
            >
              <p className={`font-medium ${T.fantasmaTexto}`}>👻 4. Lotes Fantasmas</p>
              <p className={`text-xs mt-1 ${T.fantasmaSub}`}>
                OPs sem movimentação, máquinas sem registro e turnos não fechados
              </p>
            </button>
            )}
          </div>
        </div>
        )}

      </div>
    </AppLayout>
  );
}
