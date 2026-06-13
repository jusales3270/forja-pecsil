// ============================================================
// Forja - Aba 4: Plano de Inspeção
// Dropdown de operações com inspeção -> plano + cotas
// ============================================================

import { useState, useEffect } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ObservacaoBadge } from '../../../components/ObservacaoBadge';
import { useOperacoesArtigoList } from '../../../hooks/useOperacoesArtigo';
import {
  usePlanoInspecao,
  useCreatePlanoInspecao,
  useDeletePlanoInspecao,
} from '../../../hooks/usePlanoInspecao';
import {
  useCotasInspecaoList,
  useDeleteCotaInspecao,
  useReordenarCotas,
  LABELS_CARACTERISTICA,
  LABELS_FREQUENCIA,
  LABELS_INSTRUMENTO,
  type CotaInspecao,
} from '../../../hooks/useCotasInspecao';
import { CotaInspecaoModal } from './CotaInspecaoModal';

interface PlanoInspecaoTabProps {
  artigoId: string;
}

export function PlanoInspecaoTab({ artigoId }: PlanoInspecaoTabProps) {
  const { data: operacoes, isLoading: opsLoading } =
    useOperacoesArtigoList(artigoId);

  // Filtra só OPs que exigem inspeção
  const opsInspecao = operacoes?.filter((o) => o.exigeInspecao) ?? [];

  const [opId, setOpId] = useState<string>('');

  // Auto-seleciona primeira OP quando carrega
  useEffect(() => {
    if (!opId && opsInspecao.length > 0) {
      setOpId(opsInspecao[0].id);
    }
    // Se a OP selecionada some (foi removida ou perdeu o exigeInspecao), reseta
    if (opId && !opsInspecao.find((o) => o.id === opId)) {
      setOpId(opsInspecao[0]?.id ?? '');
    }
  }, [opsInspecao, opId]);

  if (opsLoading) {
    return (
      <div className="card text-center text-neutral-400">Carregando...</div>
    );
  }

  // Nenhuma OP exige inspeção — mostra mensagem orientadora
  if (opsInspecao.length === 0) {
    return (
      <div className="card text-center text-neutral-400">
        <p className="text-neutral-300 font-medium mb-2">
          Nenhuma operação exige inspeção dimensional.
        </p>
        <p className="text-sm">
          Para criar um Plano de Inspeção, vá em <strong>Operações</strong>,
          edite uma operação e marque o checkbox{' '}
          <em>"Exige inspeção dimensional após a execução"</em>.
        </p>
      </div>
    );
  }

  const opSelecionada = opsInspecao.find((o) => o.id === opId);

  return (
    <div className="space-y-4">
      {/* Seletor de operação */}
      <div className="card">
        <label className="label">Operação</label>
        <select
          value={opId}
          onChange={(e) => setOpId(e.target.value)}
          className="input max-w-2xl"
        >
          {opsInspecao.map((op) => (
            <option key={op.id} value={op.id}>
              OP {op.codigoOp} — {op.tipoServico}
              {op.etapa?.nome ? ` (${op.etapa.nome})` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-2">
          {opsInspecao.length} operação(ões) com inspeção. Selecione uma para
          gerenciar suas cotas.
        </p>
      </div>

      {/* Conteúdo do plano da OP selecionada */}
      {opSelecionada && (
        <PlanoDeOperacao
          artigoId={artigoId}
          opId={opSelecionada.id}
          opLabel={`OP ${opSelecionada.codigoOp}`}
        />
      )}
    </div>
  );
}

// ============================================================
// Plano de uma OP específica (cotas + ações)
// ============================================================

interface PlanoDeOperacaoProps {
  artigoId: string;
  opId: string;
  opLabel: string;
}

function PlanoDeOperacao({ artigoId, opId, opLabel }: PlanoDeOperacaoProps) {
  const { data: plano, isLoading: planoLoading } = usePlanoInspecao(
    artigoId,
    opId
  );
  const { data: cotas, isLoading: cotasLoading } = useCotasInspecaoList(
    artigoId,
    opId
  );
  const createPlanoMut = useCreatePlanoInspecao(artigoId, opId);
  const deletePlanoMut = useDeletePlanoInspecao(artigoId, opId);
  const reordenarMut = useReordenarCotas(artigoId, opId);
  const deleteCotaMut = useDeleteCotaInspecao(artigoId, opId);

  const [criandoCota, setCriandoCota] = useState(false);
  const [editandoCota, setEditandoCota] = useState<CotaInspecao | null>(null);
  const [deletandoCota, setDeletandoCota] = useState<CotaInspecao | null>(
    null
  );
  const [confirmandoDeletarPlano, setConfirmandoDeletarPlano] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (planoLoading) {
    return (
      <div className="card text-center text-neutral-400">
        Carregando plano...
      </div>
    );
  }

  // Plano ainda não existe — botão pra criar
  if (!plano) {
    return (
      <div className="card text-center space-y-3">
        <p className="text-neutral-300 font-medium">
          {opLabel} ainda não tem Plano de Inspeção.
        </p>
        <p className="text-sm text-neutral-400">
          Crie o plano para começar a cadastrar as cotas a serem medidas.
        </p>
        {erro && <div className="error-message">{erro}</div>}
        <button
          onClick={async () => {
            setErro(null);
            try {
              await createPlanoMut.mutateAsync({});
            } catch (err: any) {
              setErro(
                err?.response?.data?.message ?? 'Erro ao criar plano'
              );
            }
          }}
          disabled={createPlanoMut.isPending}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          {createPlanoMut.isPending ? 'Criando...' : 'Criar Plano de Inspeção'}
        </button>
      </div>
    );
  }

  const handleDeletarPlano = async () => {
    setErro(null);
    try {
      await deletePlanoMut.mutateAsync();
      setConfirmandoDeletarPlano(false);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao deletar plano');
    }
  };

  const handleDeletarCota = async () => {
    if (!deletandoCota) return;
    setErro(null);
    try {
      await deleteCotaMut.mutateAsync(deletandoCota.id);
      setDeletandoCota(null);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao deletar cota');
    }
  };

  const handleMover = async (
    cota: CotaInspecao,
    direcao: 'cima' | 'baixo'
  ) => {
    if (!cotas) return;
    const idx = cotas.findIndex((c) => c.id === cota.id);
    if (idx === -1) return;
    const novoIdx = direcao === 'cima' ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= cotas.length) return;

    const nova = [...cotas];
    [nova[idx], nova[novoIdx]] = [nova[novoIdx], nova[idx]];
    const ordens = nova.map((c, i) => ({ id: c.id, ordem: i }));

    try {
      await reordenarMut.mutateAsync(ordens);
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao reordenar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com ações do plano */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">
            Cotas do Plano — {opLabel}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {cotas && cotas.length > 0
              ? `${cotas.length} cota(s) cadastrada(s)`
              : 'Nenhuma cota cadastrada ainda'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmandoDeletarPlano(true)}
            className="btn-ghost px-3 py-2 text-xs"
          >
            Excluir Plano
          </button>
          <button
            onClick={() => setCriandoCota(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            + Nova Cota
          </button>
        </div>
      </div>

      {erro && <div className="error-message">{erro}</div>}

      {/* Tabela de cotas */}
      {cotasLoading && (
        <div className="card text-center text-neutral-400">
          Carregando cotas...
        </div>
      )}
      {!cotasLoading && cotas && cotas.length === 0 && (
        <div className="card text-center text-neutral-400 text-sm">
          Adicione a primeira cota a ser medida durante esta operação.
        </div>
      )}
      {cotas && cotas.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3 w-12">#</th>
                <th className="text-left px-3 py-3">Cota</th>
                <th className="text-right px-3 py-3">Nominal</th>
                <th className="text-right px-3 py-3">Tol +</th>
                <th className="text-right px-3 py-3">Tol −</th>
                <th className="text-left px-3 py-3">Caract.</th>
                <th className="text-left px-3 py-3">Monitorar</th>
                <th className="text-left px-3 py-3">Registrar</th>
                <th className="text-left px-3 py-3">Instrumento</th>
                <th className="text-center px-3 py-3 w-24">Reordenar</th>
                <th className="text-right px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {cotas.map((c, idx) => (
                <tr key={c.id} className="hover:bg-neutral-800/30">
                  <td className="px-3 py-3 text-neutral-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 font-mono text-neutral-100">
                    <span className="inline-flex items-center gap-1.5">{c.codigoCota}<ObservacaoBadge texto={c.observacoes} /></span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-200">
                    {c.valorNominal}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-300">
                    {c.toleranciaMais != null ? `+${c.toleranciaMais}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-neutral-300">
                    {c.toleranciaMenos != null ? `−${c.toleranciaMenos}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {LABELS_CARACTERISTICA[c.caracteristica]}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {LABELS_FREQUENCIA[c.frequenciaMonitorar]}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {LABELS_FREQUENCIA[c.frequenciaRegistrar]}
                  </td>
                  <td className="px-3 py-3 text-neutral-300 text-xs">
                    {LABELS_INSTRUMENTO[c.instrumento]}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleMover(c, 'cima')}
                      disabled={idx === 0 || reordenarMut.isPending}
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMover(c, 'baixo')}
                      disabled={
                        idx === cotas.length - 1 || reordenarMut.isPending
                      }
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      ▼
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setEditandoCota(c)}
                      className="btn-ghost px-3 py-1.5 text-xs mr-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletandoCota(c)}
                      className="btn px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200"
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de criar/editar cota */}
      <CotaInspecaoModal
        open={criandoCota || editandoCota !== null}
        artigoId={artigoId}
        opId={opId}
        cota={editandoCota}
        proximaOrdem={cotas?.length ?? 0}
        onClose={() => {
          setCriandoCota(false);
          setEditandoCota(null);
        }}
      />

      {/* Confirmação delete cota */}
      <ConfirmDialog
        open={deletandoCota !== null}
        title="Deletar Cota"
        message={
          deletandoCota
            ? `Tem certeza que deseja deletar a cota "${deletandoCota.codigoCota}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Deletar"
        loading={deleteCotaMut.isPending}
        onConfirm={handleDeletarCota}
        onCancel={() => setDeletandoCota(null)}
      />

      {/* Confirmação delete plano */}
      <ConfirmDialog
        open={confirmandoDeletarPlano}
        title="Excluir Plano de Inspeção"
        message="Tem certeza que deseja excluir o Plano de Inspeção desta operação? Todas as cotas cadastradas serão apagadas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir Plano"
        loading={deletePlanoMut.isPending}
        onConfirm={handleDeletarPlano}
        onCancel={() => setConfirmandoDeletarPlano(false)}
      />
    </div>
  );
}
