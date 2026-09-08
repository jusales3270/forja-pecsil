// ============================================================
// Forja - Detalhe da OS
// ============================================================

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useOSDetail,
  useCancelarOS,
  LABELS_STATUS_OS,
  CORES_STATUS_OS,
  formatarDataSegura,
} from '../../hooks/useOS';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useAuth } from '../../lib/auth-store';
import { useTheme } from '../../lib/theme-store';
import { DadosOSTab } from './tabs/DadosOSTab';
import { LotesOpsTab } from './tabs/LotesOpsTab';
import { TimelineTab } from './tabs/TimelineTab';

type Aba = 'dados' | 'lotes' | 'timeline';

export function OSDetailPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Erro ao carregar Ordem de Serviço"
      fallbackMessage="Ocorreu uma falha ao exibir os detalhes desta OS. Clique abaixo para voltar à lista."
      voltarUrl="/os"
    >
      <OSDetailContent />
    </ErrorBoundary>
  );
}

function OSDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { claro } = useTheme();
  const [aba, setAba] = useState<Aba>('dados');
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const { data, isLoading, isError, error } = useOSDetail(id ?? null);
  const cancelarOS = useCancelarOS();

  const os = data?.data;

  // Paleta de cores por tema
  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        voltarBtn: 'text-slate-600 hover:text-slate-900',
        titulo: 'text-slate-900',
        descricao: 'text-slate-800',
        subDescricao: 'text-slate-500',
        bordaTabs: 'border-slate-200',
        tabAtiva: 'text-forja-600 border-forja-600 font-semibold',
        tabInativa: 'text-slate-500 border-transparent hover:text-slate-800',
        badgeTab: 'text-slate-500 bg-slate-200',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-400',
        voltarBtn: 'text-neutral-400 hover:text-neutral-200',
        titulo: 'text-forja-50',
        descricao: 'text-neutral-200',
        subDescricao: 'text-neutral-500',
        bordaTabs: 'border-neutral-800',
        tabAtiva: 'text-forja-400 border-forja-500 font-semibold',
        tabInativa: 'text-neutral-400 border-transparent hover:text-neutral-200',
        badgeTab: 'text-neutral-500 bg-neutral-800',
      };

  async function handleCancelar() {
    if (!os) return;
    try {
      await cancelarOS.mutateAsync(os.id);
      setConfirmandoCancelar(false);
    } catch (err) {
      // Erro ja tratado pelo hook
    }
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen ${T.bg} ${T.texto} ${claro ? 'theme-light' : ''} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-forja-500 border-t-transparent rounded-full animate-spin" />
          <div className={T.sub}>Carregando OS...</div>
        </div>
      </div>
    );
  }

  if (isError || !os) {
    const errorMsg = (error as any)?.response?.data?.message ?? (error as any)?.message;
    return (
      <div className={`min-h-screen ${T.bg} ${T.texto} ${claro ? 'theme-light' : ''} flex items-center justify-center p-6`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 font-semibold text-lg mb-1">OS não encontrada</div>
          <p className={`text-sm mb-4 ${T.sub}`}>
            {errorMsg ?? 'A Ordem de Serviço solicitada não existe ou foi removida.'}
          </p>
          <button
            onClick={() => navigate('/os')}
            className="btn-primary px-4 py-2 text-sm"
          >
            ← Voltar para Ordens de Serviço
          </button>
        </div>
      </div>
    );
  }

  const podeEditar = os.status !== 'finalizada' && os.status !== 'cancelada';
  const pessoa = useAuth((s) => s.pessoa);
  const podeCancelar =
    pessoa?.papel === 'admin' &&
    os.status !== 'finalizada' &&
    os.status !== 'cancelada';

  const statusCor = CORES_STATUS_OS[os.status] ?? 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
  const statusLabel = (LABELS_STATUS_OS as Record<string, string>)[os.status] ?? os.status ?? '—';

  return (
    <div className={`min-h-screen ${T.bg} ${T.texto} ${claro ? 'theme-light' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/os')}
            className={`text-sm mb-3 flex items-center gap-1.5 transition font-medium ${T.voltarBtn}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar para Ordens de Serviço
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                {os.prioridade === 'urgente' && (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400 text-sm font-bold">
                    !
                  </span>
                )}
                <h1 className={`text-3xl font-bold font-mono tracking-tight ${T.titulo}`}>
                  {os.codigoGrv ?? '—'}
                </h1>
                <span className={`inline-block px-3 py-1 text-xs font-medium rounded border ${statusCor}`}>
                  {statusLabel}
                </span>
              </div>
              <p className={`text-lg ${T.descricao}`}>
                {os.artigo?.descricao ?? '—'}{' '}
                <span className={`font-mono text-sm ${T.subDescricao}`}>
                  ({os.artigo?.codigo ?? '—'})
                </span>
              </p>
              <p className={`text-sm mt-1 ${T.sub}`}>
                Cliente: <span className={T.descricao}>{os.cliente?.nome ?? '—'}</span> ·{' '}
                Quantidade: <span className="font-mono font-medium">{os.quantidadeTotal ?? 0}</span> peças ·{' '}
                Aberta em <span className={T.descricao}>{formatarDataSegura(os.dataAbertura)}</span>
              </p>
            </div>

            {podeCancelar && (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                className="self-start px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg transition font-medium"
              >
                Cancelar OS
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className={`border-b ${T.bordaTabs} mb-6`}>
          <nav className="flex gap-2">
            <TabButton
              ativo={aba === 'dados'}
              onClick={() => setAba('dados')}
              classeAtiva={T.tabAtiva}
              classeInativa={T.tabInativa}
            >
              Dados
            </TabButton>
            <TabButton
              ativo={aba === 'lotes'}
              onClick={() => setAba('lotes')}
              classeAtiva={T.tabAtiva}
              classeInativa={T.tabInativa}
            >
              Lotes e OPs
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded font-mono ${T.badgeTab}`}>
                {os.lotes?.length ?? 0}
              </span>
            </TabButton>
            <TabButton
              ativo={aba === 'timeline'}
              onClick={() => setAba('timeline')}
              classeAtiva={T.tabAtiva}
              classeInativa={T.tabInativa}
            >
              Timeline
            </TabButton>
          </nav>
        </div>

        {/* Conteúdo */}
        <div>
          {aba === 'dados' && <DadosOSTab os={os} podeEditar={podeEditar} />}
          {aba === 'lotes' && <LotesOpsTab os={os} />}
          {aba === 'timeline' && <TimelineTab osId={os.id} />}
        </div>
      </div>

      {/* Confirmação de cancelamento */}
      <ConfirmDialog
        open={confirmandoCancelar}
        title="Cancelar OS"
        message={`Tem certeza que deseja cancelar a OS ${os.codigoGrv ?? ''}? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, cancelar OS"
        cancelLabel="Voltar"
        variant="danger"
        onConfirm={handleCancelar}
        onCancel={() => setConfirmandoCancelar(false)}
      />
    </div>
  );
}

function TabButton({
  ativo,
  onClick,
  children,
  classeAtiva,
  classeInativa,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  classeAtiva: string;
  classeInativa: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px flex items-center ${
        ativo ? classeAtiva : classeInativa
      }`}
    >
      {children}
    </button>
  );
}

