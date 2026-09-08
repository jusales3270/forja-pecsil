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
} from '../../hooks/useOS';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../../lib/auth-store';
import { DadosOSTab } from './tabs/DadosOSTab';
import { LotesOpsTab } from './tabs/LotesOpsTab';
import { TimelineTab } from './tabs/TimelineTab';

type Aba = 'dados' | 'lotes' | 'timeline';

export function OSDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('dados');
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const { data, isLoading, isError } = useOSDetail(id ?? null);
  const cancelarOS = useCancelarOS();

  const os = data?.data;

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
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-neutral-400">Carregando OS...</div>
      </div>
    );
  }

  if (isError || !os) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-2">OS não encontrada.</div>
          <button
            onClick={() => navigate('/os')}
            className="text-forja-400 hover:underline text-sm"
          >
            Voltar à lista
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/os')}
            className="text-sm text-neutral-400 hover:text-neutral-200 mb-3 flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar para Ordens de Serviço
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {os.prioridade === 'urgente' && (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-500/20 text-red-400 text-sm font-bold">
                    !
                  </span>
                )}
                <h1 className="text-3xl font-bold text-forja-50 font-mono">
                  {os.codigoGrv}
                </h1>
                <span
                  className={`inline-block px-3 py-1 text-xs font-medium rounded border ${CORES_STATUS_OS[os.status]}`}
                >
                  {LABELS_STATUS_OS[os.status]}
                </span>
              </div>
              <p className="text-neutral-200 text-lg">
                {os.artigo?.descricao}{' '}
                <span className="text-neutral-500 font-mono text-sm">
                  ({os.artigo?.codigo})
                </span>
              </p>
              <p className="text-neutral-400 text-sm mt-1">
                Cliente: <span className="text-neutral-200">{os.cliente?.nome}</span> ·{' '}
                Quantidade: <span className="font-mono">{os.quantidadeTotal}</span> peças ·{' '}
                Aberta em <span className="text-neutral-200">{new Date(os.dataAbertura).toLocaleDateString('pt-BR')}</span>
              </p>
            </div>

            {podeCancelar && (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                className="px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition"
              >
                Cancelar OS
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-800 mb-6">
          <nav className="flex gap-1">
            <TabButton ativo={aba === 'dados'} onClick={() => setAba('dados')}>
              Dados
            </TabButton>
            <TabButton ativo={aba === 'lotes'} onClick={() => setAba('lotes')}>
              Lotes e OPs
              <span className="ml-2 text-xs text-neutral-500 font-mono">
                {os.lotes?.length ?? 0}
              </span>
            </TabButton>
            <TabButton ativo={aba === 'timeline'} onClick={() => setAba('timeline')}>
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
        message={`Tem certeza que deseja cancelar a OS ${os.codigoGrv}? Esta ação não pode ser desfeita.`}
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
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
        ativo
          ? 'text-forja-400 border-forja-500'
          : 'text-neutral-400 border-transparent hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}
