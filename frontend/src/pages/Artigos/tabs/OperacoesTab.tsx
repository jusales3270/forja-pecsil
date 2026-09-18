// ============================================================
// Forja - Aba 3: Operações do Artigo
// Lista de OPs em ordem de execução, com modal de edição
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../../../components/Modal';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ObservacaoBadge } from '../../../components/ObservacaoBadge';
import { useEtapasList } from '../../../hooks/useEtapas';
import { useTiposServicoList } from '../../../hooks/useTiposServico';
import {
  useOperacoesArtigoList,
  useCreateOperacaoArtigo,
  useUpdateOperacaoArtigo,
  useDeleteOperacaoArtigo,
  useReordenarOperacoes,
  type OperacaoArtigo,
} from '../../../hooks/useOperacoesArtigo';
import { AplicarRoteiroModal } from './AplicarRoteiroModal';
import { useTheme } from '../../../lib/theme-store';
import { useAuth } from '../../../lib/auth-store';
import { temCapacidade } from '../../../lib/permissions';

interface OperacoesTabProps {
  artigoId: string;
}

export function OperacoesTab({ artigoId }: OperacoesTabProps) {
  const { claro } = useTheme();
  const pessoa = useAuth((s) => s.pessoa);
  const ehAdmin = temCapacidade(pessoa, 'excluir_dados');

  const { data: operacoes, isLoading, isError } =
    useOperacoesArtigoList(artigoId);
  const reordenarMut = useReordenarOperacoes(artigoId);
  const deleteMut = useDeleteOperacaoArtigo(artigoId);

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<OperacaoArtigo | null>(null);
  const [deletando, setDeletando] = useState<OperacaoArtigo | null>(null);
  const [aplicandoRoteiro, setAplicandoRoteiro] = useState(false);

  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    try {
      await deleteMut.mutateAsync(deletando.id);
      setDeletando(null);
    } catch (err) {
      // erro fica em deleteMut.isError
    }
  };

  const handleMover = async (op: OperacaoArtigo, direcao: 'cima' | 'baixo') => {
    if (!operacoes) return;
    const idx = operacoes.findIndex((o) => o.id === op.id);
    if (idx === -1) return;
    const novoIdx = direcao === 'cima' ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= operacoes.length) return;

    // Reconstrói a lista com a operação trocada
    const novaLista = [...operacoes];
    [novaLista[idx], novaLista[novoIdx]] = [novaLista[novoIdx], novaLista[idx]];

    // Reatribui ordens
    const ordens = novaLista.map((o, i) => ({ id: o.id, ordem: i }));

    try {
      await reordenarMut.mutateAsync(ordens);
    } catch (err) {
      // erro fica em reordenarMut.isError
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com botão criar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-400">
          {operacoes && operacoes.length > 0
            ? `${operacoes.length} operação(ões) cadastrada(s)`
            : 'Nenhuma operação cadastrada ainda'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAplicandoRoteiro(true)}
            className="btn-ghost px-4 py-2 text-sm border border-neutral-700 hover:border-forja-500/50"
          >
            📋 Usar roteiro padrão
          </button>
          <button
            onClick={() => setCriando(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            + Nova Operação
          </button>
        </div>
      </div>

      {/* Erros */}
      {deleteMut.isError && (
        <div className="error-message">
          Erro ao deletar:{' '}
          {(deleteMut.error as any)?.response?.data?.message ??
            'Tente novamente.'}
        </div>
      )}
      {reordenarMut.isError && (
        <div className="error-message">
          Erro ao reordenar:{' '}
          {(reordenarMut.error as any)?.response?.data?.message ??
            'Tente novamente.'}
        </div>
      )}

      {/* Estados */}
      {isLoading && (
        <div className="card text-center text-neutral-400">Carregando...</div>
      )}
      {isError && (
        <div className="error-message">
          Não foi possível carregar as operações.
        </div>
      )}
      {!isLoading && !isError && operacoes && operacoes.length === 0 && (
        <div className="card text-center py-8">
          <p className={`font-medium ${claro ? 'text-slate-900' : 'text-neutral-300'}`}>
            Este artigo ainda não tem processo produtivo.
          </p>
          <p className={`text-sm mt-1 mb-5 ${claro ? 'text-slate-600' : 'text-neutral-500'}`}>
            Comece por um roteiro padrão — ele já traz a sequência completa, com
            tempos e instruções. Depois é só ajustar o que for diferente.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setAplicandoRoteiro(true)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              📋 Escolher roteiro padrão
            </button>
            <button
              onClick={() => setCriando(true)}
              className={`btn-ghost px-5 py-2.5 text-sm border ${claro ? 'border-slate-300' : 'border-neutral-700'}`}
            >
              Montar do zero
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {operacoes && operacoes.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3 w-12">#</th>
                <th className="text-left px-3 py-3">OP</th>
                <th className="text-left px-3 py-3">Etapa</th>
                <th className="text-left px-3 py-3">Tipo de Serviço</th>
                <th className="text-right px-3 py-3">Tempo Unit (min)</th>
                <th className="text-center px-3 py-3">Inspeção</th>
                <th className="text-center px-3 py-3 w-24">Reordenar</th>
                <th className="text-right px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {operacoes.map((op, idx) => (
                <tr key={op.id} className="hover:bg-neutral-800/30">
                  <td className="px-3 py-3 text-neutral-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 font-mono text-neutral-100">
                    <span className="inline-flex items-center gap-1.5">{op.codigoOp}<ObservacaoBadge texto={op.observacoes} /></span>
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {op.etapa?.nome ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {op.tipoServico}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-300 font-mono">
                    {op.tempoUnitMin}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {op.exigeInspecao ? (
                      <span className="badge-forja">Sim</span>
                    ) : (
                      <span className="badge-neutral">Não</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleMover(op, 'cima')}
                      disabled={idx === 0 || reordenarMut.isPending}
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMover(op, 'baixo')}
                      disabled={
                        idx === operacoes.length - 1 || reordenarMut.isPending
                      }
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      ▼
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setEditando(op)}
                      className="btn-ghost px-3 py-1.5 text-xs mr-1"
                    >
                      Editar
                    </button>
                    {ehAdmin && (
                      <button
                        onClick={() => setDeletando(op)}
                        className="btn px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200"
                      >
                        Deletar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de roteiro padrão */}
      {aplicandoRoteiro && (
        <AplicarRoteiroModal
          artigoId={artigoId}
          totalOperacoesExistentes={operacoes?.length ?? 0}
          onClose={() => setAplicandoRoteiro(false)}
        />
      )}

      {/* Modal criar/editar */}
      <OperacaoModal
        open={criando || editando !== null}
        artigoId={artigoId}
        operacao={editando}
        proximaOrdem={operacoes?.length ?? 0}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      {/* Confirmação de delete */}
      <ConfirmDialog
        open={deletando !== null}
        title="Deletar Operação"
        message={
          deletando
            ? `Tem certeza que deseja deletar a operação ${deletando.codigoOp} (${deletando.tipoServico})? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Deletar"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmarDelete}
        onCancel={() => setDeletando(null)}
      />
    </div>
  );
}

// ============================================================
// Modal de criar/editar operação
// ============================================================

interface OperacaoModalProps {
  open: boolean;
  artigoId: string;
  operacao: OperacaoArtigo | null;
  proximaOrdem: number;
  onClose: () => void;
}

function OperacaoModal({
  open,
  artigoId,
  operacao,
  proximaOrdem,
  onClose,
}: OperacaoModalProps) {
  const ehEdicao = operacao !== null;

  const [codigoOp, setCodigoOp] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [tipoServicoId, setTipoServicoId] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [tempoUnitMin, setTempoUnitMin] = useState('');
  const [tempoSetupMin, setTempoSetupMin] = useState('0');
  const [exigeInspecao, setExigeInspecao] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: etapas } = useEtapasList();
  const { data: tiposServico } = useTiposServicoList({ ativo: true });
  const createMut = useCreateOperacaoArtigo(artigoId);
  const updateMut = useUpdateOperacaoArtigo(artigoId);

  useEffect(() => {
    if (open) {
      setCodigoOp(operacao?.codigoOp ?? '');
      setEtapaId(operacao?.etapaId ?? '');
      setTipoServicoId(operacao?.tipoServicoId ?? '');
      setTipoServico(operacao?.tipoServico ?? '');
      setTempoUnitMin(operacao?.tempoUnitMin?.toString() ?? '');
      setTempoSetupMin(operacao?.tempoSetupMin?.toString() ?? '0');
      setExigeInspecao(operacao?.exigeInspecao ?? false);
      setObservacoes(operacao?.observacoes ?? '');
      setErro(null);
    }
  }, [open, operacao]);

  // Quando o tipo de serviço da lista é escolhido, preenche o nome e a inspeção automaticamente
  const handleTipoServicoChange = (id: string) => {
    setTipoServicoId(id);
    if (id) {
      const ts = tiposServico?.find((t) => t.id === id);
      if (ts) {
        setTipoServico(ts.nome);
        setEtapaId(ts.etapaId);
        setExigeInspecao(ts.exigeInspecao);
      }
    }
  };

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!codigoOp.trim()) {
      setErro('Código da operação é obrigatório');
      return;
    }
    if (!etapaId) {
      setErro('Selecione uma etapa');
      return;
    }
    if (!tipoServico.trim()) {
      setErro('Tipo de serviço é obrigatório');
      return;
    }
    const tempo = Number(tempoUnitMin);
    if (!tempoUnitMin.trim() || !Number.isFinite(tempo) || tempo < 0) {
      setErro('Tempo unitário deve ser um número >= 0');
      return;
    }
    const setup = parseInt(tempoSetupMin, 10);
    if (isNaN(setup) || setup < 0) {
      setErro('Tempo de setup deve ser um número >= 0');
      return;
    }

    try {
      const payload = {
        codigoOp: codigoOp.trim(),
        etapaId,
        tipoServicoId: tipoServicoId || undefined,
        tipoServico: tipoServico.trim(),
        tempoUnitMin: tempo,
        tempoSetupMin: setup,
        exigeInspecao,
        observacoes: observacoes.trim() || null,
      };

      if (ehEdicao && operacao) {
        await updateMut.mutateAsync({ id: operacao.id, input: payload });
      } else {
        await createMut.mutateAsync({
          ...payload,
          ordem: proximaOrdem,
        });
      }
      onClose();
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ??
          err?.message ??
          'Erro ao salvar. Tente novamente.'
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar Operação' : 'Nova Operação'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="operacao-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="operacao-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        {/* Linha 1: Código OP + Tipo Serviço (catálogo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Código OP *</label>
            <input
              type="text"
              value={codigoOp}
              onChange={(e) => setCodigoOp(e.target.value)}
              className="input"
              placeholder="Ex: 10, 20, 40"
              autoFocus
            />
            <p className="text-xs text-neutral-500 mt-1">
              Identificador da operação (GRV)
            </p>
          </div>
          <div>
            <label className="label">Tipo de Serviço (do catálogo)</label>
            <select
              value={tipoServicoId}
              onChange={(e) => handleTipoServicoChange(e.target.value)}
              className="input"
            >
              <option value="">— Personalizado —</option>
              {tiposServico?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Preenche etapa e nome automaticamente
            </p>
          </div>
        </div>

        {/* Etapa + Nome do tipo de serviço */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Etapa *</label>
            <select
              value={etapaId}
              onChange={(e) => setEtapaId(e.target.value)}
              className="input"
            >
              <option value="">Selecione...</option>
              {etapas?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Descrição do Serviço *</label>
            <input
              type="text"
              value={tipoServico}
              onChange={(e) => setTipoServico(e.target.value)}
              className="input"
              placeholder="Ex: ENG. PROG. CENTRO"
            />
          </div>
        </div>

        {/* Tempos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Tempo Unitário (min) *</label>
            <input
              type="number"
              min="0"
              step="any"
              value={tempoUnitMin}
              onChange={(e) => setTempoUnitMin(e.target.value)}
              className="input"
              placeholder="Ex: 45"
            />
          </div>
          <div>
            <label className="label">Tempo de Setup (min)</label>
            <input
              type="number"
              min="0"
              value={tempoSetupMin}
              onChange={(e) => setTempoSetupMin(e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>

        {/* Exige inspeção */}
        <label className="flex items-center gap-2 text-sm text-neutral-200 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={exigeInspecao}
            onChange={(e) => setExigeInspecao(e.target.checked)}
            className="w-4 h-4 accent-forja-500"
          />
          Exige inspeção dimensional após a execução
        </label>

        {/* Observações */}
        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input"
            rows={2}
            placeholder="Opcional — instruções específicas, particularidades, dicas"
          />
        </div>
      </form>
    </Modal>
  );
}
