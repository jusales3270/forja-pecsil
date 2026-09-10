// ============================================================
// Forja - Página de Edição de Artigo (com 4 abas)
// Aba 1: Dados Básicos (implementada)
// Abas 2-4: placeholders (em construção)
// ============================================================

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { useAuth } from '../../lib/auth-store';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  useArtigoDetail,
  useAtivarArtigo,
  useArquivarArtigo,
  useDesarquivarArtigo,
  useVoltarRascunhoArtigo,
  useDeleteArtigo,
  type StatusArtigo,
} from '../../hooks/useArtigos';
import { DadosBasicosTab } from './tabs/DadosBasicosTab';
import { DesenhosTab } from './tabs/DesenhosTab';
import { OperacoesTab } from './tabs/OperacoesTab';
import { PlanoInspecaoTab } from './tabs/PlanoInspecaoTab';

type AbaAtiva = 'dados' | 'desenhos' | 'operacoes' | 'plano';

const ABAS: { id: AbaAtiva; label: string }[] = [
  { id: 'dados', label: 'Dados Básicos' },
  { id: 'desenhos', label: 'Desenhos' },
  { id: 'operacoes', label: 'Operações' },
  { id: 'plano', label: 'Plano de Inspeção' },
];

const STATUS_LABEL: Record<StatusArtigo, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  arquivado: 'Arquivado',
};

const STATUS_BADGE: Record<StatusArtigo, string> = {
  rascunho: 'badge-neutral',
  ativo: 'badge-forja',
  arquivado: 'badge-neutral opacity-60',
};

export function ArtigoEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pessoa = useAuth((s) => s.pessoa);
  const ehAdmin = pessoa?.papel === 'admin';

  const [aba, setAba] = useState<AbaAtiva>('dados');
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const { data: artigo, isLoading, isError } = useArtigoDetail(id ?? null);

  const ativarMut = useAtivarArtigo();
  const arquivarMut = useArquivarArtigo();
  const desarquivarMut = useDesarquivarArtigo();
  const voltarRascunhoMut = useVoltarRascunhoArtigo();
  const deleteMut = useDeleteArtigo();

  if (isLoading) {
    return (
      <AppLayout title="Carregando..." voltarPara="/artigos">
        <div className="card text-center text-neutral-400">Carregando...</div>
      </AppLayout>
    );
  }

  if (isError || !artigo) {
    return (
      <AppLayout title="Artigo não encontrado" voltarPara="/artigos">
        <div className="error-message">
          Artigo não encontrado ou erro ao carregar.
        </div>
        <button onClick={() => navigate('/artigos')} className="btn-ghost mt-4">
          ← Voltar para lista
        </button>
      </AppLayout>
    );
  }

  const handleTransition = async (
    mut:
      | typeof ativarMut
      | typeof arquivarMut
      | typeof desarquivarMut
      | typeof voltarRascunhoMut,
    confirmacao?: string
  ) => {
    setErroStatus(null);
    if (confirmacao && !window.confirm(confirmacao)) return;
    try {
      await mut.mutateAsync(artigo.id);
    } catch (err: any) {
      setErroStatus(
        err?.response?.data?.message ??
          err?.message ??
          'Erro ao alterar status'
      );
    }
  };

  const statusLoading =
    ativarMut.isPending ||
    arquivarMut.isPending ||
    desarquivarMut.isPending ||
    voltarRascunhoMut.isPending;

  return (
    <AppLayout title={`${artigo.codigo} — ${artigo.descricao}`} voltarPara="/artigos">
      <div className="space-y-6">
        {/* Header com voltar + status + ações */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate('/artigos')}
            className="btn-ghost text-sm"
          >
            ← Voltar para lista
          </button>

          <div className="flex items-center gap-3">
            <span className={STATUS_BADGE[artigo.status]}>
              {STATUS_LABEL[artigo.status]}
            </span>

            {/* Ações de status — botões dependem do status atual */}
            {artigo.status === 'rascunho' && (
              <button
                onClick={() => handleTransition(ativarMut)}
                disabled={statusLoading}
                className="btn-primary px-4 py-2 text-sm"
              >
                {statusLoading ? 'Processando...' : 'Ativar Artigo'}
              </button>
            )}

            {artigo.status === 'ativo' && (
              <>
                <button
                  onClick={() =>
                    handleTransition(
                      voltarRascunhoMut,
                      'Voltar o Artigo para rascunho? Ele não poderá ser usado em novas OS até ser ativado novamente.'
                    )
                  }
                  disabled={statusLoading}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  Voltar para Rascunho
                </button>
                <button
                  onClick={() =>
                    handleTransition(
                      arquivarMut,
                      'Arquivar este Artigo? Ele não aparecerá mais nas listas de seleção para nova OS.'
                    )
                  }
                  disabled={statusLoading}
                  className="btn px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  Arquivar
                </button>
              </>
            )}

            {artigo.status === 'arquivado' && (
              <button
                onClick={() => handleTransition(desarquivarMut)}
                disabled={statusLoading}
                className="btn-primary px-4 py-2 text-sm"
              >
                Desarquivar
              </button>
            )}

            {ehAdmin && (
              <button
                type="button"
                onClick={() => setConfirmandoExcluir(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition shadow-sm"
                title="Excluir Artigo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Excluir Artigo
              </button>
            )}
          </div>
        </div>

        {/* Erro de transição */}
        {erroStatus && <div className="error-message">{erroStatus}</div>}

        {/* Abas */}
        <div className="border-b border-neutral-800">
          <nav className="flex gap-1" aria-label="Abas">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={
                  aba === a.id
                    ? 'px-4 py-3 text-sm font-medium border-b-2 border-forja-500 text-forja-400'
                    : 'px-4 py-3 text-sm text-neutral-400 hover:text-neutral-200 border-b-2 border-transparent'
                }
              >
                {a.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Conteúdo da aba ativa */}
        <div>
          {aba === 'dados' && <DadosBasicosTab artigo={artigo} />}
          {aba === 'desenhos' && <DesenhosTab artigoId={artigo.id} artigo={artigo} />}
          {aba === 'operacoes' && <OperacoesTab artigoId={artigo.id} />}
          {aba === 'plano' && <PlanoInspecaoTab artigoId={artigo.id} />}
        </div>

        {/* Diálogo de confirmação de exclusão */}
        <ConfirmDialog
          open={confirmandoExcluir}
          title="Excluir Artigo"
          message={`Tem certeza que deseja excluir o artigo "${artigo.codigo}" (${artigo.descricao})? O item ficará inativo e oculto do sistema.`}
          confirmLabel="Sim, Excluir Artigo"
          loading={deleteMut.isPending}
          onConfirm={async () => {
            try {
              await deleteMut.mutateAsync(artigo.id);
              navigate('/artigos');
            } catch (err: any) {
              setErroStatus(err?.response?.data?.message || 'Erro ao excluir artigo');
              setConfirmandoExcluir(false);
            }
          }}
          onCancel={() => setConfirmandoExcluir(false)}
        />
      </div>
    </AppLayout>
  );
}

function PlaceholderAba({ nome }: { nome: string }) {
  return (
    <div className="card text-center text-neutral-400">
      <p className="text-lg font-medium text-neutral-300 mb-2">{nome}</p>
      <p className="text-sm">Em construção — próximos passos do Sprint 2a.</p>
    </div>
  );
}
