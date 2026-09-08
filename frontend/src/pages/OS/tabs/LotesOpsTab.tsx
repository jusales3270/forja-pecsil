// ============================================================
// Forja - Aba "Lotes e OPs" do detalhe da OS
// ============================================================

import { useState } from 'react';
import type { OS, Lote, OPLote, StatusLote, StatusOPLote } from '../../../hooks/useOS';
import type { OPLotePendente } from '../../../hooks/useOPLote';
import type { Desenho } from '../../../hooks/useDesenhos';
import { useTheme } from '../../../lib/theme-store';
import { DetalhesOPModal } from '../../Totem/DetalhesOPModal';
import { VisualizadorDesenhoModal } from '../../../components/VisualizadorDesenhoModal';

interface LotesOpsTabProps {
  os: OS;
}

const LABELS_STATUS_LOTE: Record<string, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguardando qualidade',
  bloqueado: 'Bloqueado',
  concluido: 'Concluído',
};

const CORES_STATUS_LOTE: Record<string, string> = {
  na_fila: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  em_processo: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  aguardando_qualidade: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  bloqueado: 'bg-red-500/15 text-red-400 border-red-500/30',
  concluido: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const LABELS_STATUS_OP: Record<string, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguardando inspeção',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

const CORES_STATUS_OP: Record<string, string> = {
  na_fila: 'bg-blue-500/15 text-blue-400',
  em_processo: 'bg-amber-500/15 text-amber-400',
  aguardando_qualidade: 'bg-purple-500/15 text-purple-400',
  concluida: 'bg-emerald-500/15 text-emerald-400',
  bloqueada: 'bg-red-500/15 text-red-400',
};

function formatarMinutos(min: number | null | undefined): string {
  const mTotal = Number(min) || 0;
  if (mTotal < 60) return `${mTotal} min`;
  const h = Math.floor(mTotal / 60);
  const m = mTotal % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function LotesOpsTab({ os }: LotesOpsTabProps) {
  const { claro } = useTheme();
  const lotes = os.lotes ?? [];

  const [opDetalhes, setOpDetalhes] = useState<OPLotePendente | null>(null);
  const [modalDesenhos, setModalDesenhos] = useState<{
    artigo: { id: string; codigo: string; descricao?: string };
    desenhos: Desenho[];
  } | null>(null);

  if (lotes.length === 0) {
    return (
      <div
        className={`${
          claro ? 'bg-white border-slate-200 text-slate-500' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
        } border rounded-xl p-12 text-center`}
      >
        Nenhum lote nessa OS.
      </div>
    );
  }

  function handleAbrirDetalhes(lote: Lote, op: OPLote) {
    const opConvertida: OPLotePendente = {
      id: op.id,
      loteId: lote.id,
      etapaId: op.etapaId,
      codigoOp: op.codigoOp,
      tipoServico: op.tipoServico,
      ordem: op.ordem,
      status: op.status as any,
      quantidadeConcluida: op.quantidadeConcluida,
      tempoUnitPlanejado: op.tempoUnitPlanejado,
      tempoTotalPlanejado: op.tempoTotalPlanejado,
      exigeInspecao: op.exigeInspecao,
      terceirizada: false,
      fornecedor: null,
      prazoPrevistoDias: null,
      esperaHoras: null,
      exigeLoteCompleto: false,
      pecasDisponiveis: op.quantidadeConcluida,
      liberadasPelaAnterior: lote.quantidadePecas,
      bloqueadoPor: null,
      observacoes: op.observacoes,
      criadoEm: op.criadoEm,
      etapa: op.etapa ?? { id: op.etapaId, nome: '—' },
      lote: {
        id: lote.id,
        numeroLote: lote.numeroLote,
        quantidadePecas: lote.quantidadePecas,
        status: lote.status,
        observacoes: null,
        opsLote: (lote.opsLote ?? []).map((o) => ({
          id: o.id,
          codigoOp: o.codigoOp,
          tipoServico: o.tipoServico,
          ordem: o.ordem,
          status: o.status as any,
          quantidadeConcluida: o.quantidadeConcluida,
          etapa: o.etapa ?? { nome: '—' },
        })),
        os: {
          id: os.id,
          codigoGrv: os.codigoGrv,
          prazoEntrega: os.prazoEntrega,
          criadoEm: os.criadoEm,
          prioridade: os.prioridade,
          status: os.status,
          observacoes: os.observacoes,
          cliente: os.cliente ?? { id: '', nome: '—' },
          criadoPor: os.criadoPor,
          artigo: {
            id: os.artigo?.id ?? '',
            codigo: os.artigo?.codigo ?? '—',
            descricao: os.artigo?.descricao ?? '—',
            observacoes: os.artigo?.observacoes,
            desenhos: (os.artigo?.desenhos as any) ?? [],
          },
        },
      },
    };
    setOpDetalhes(opConvertida);
  }

  return (
    <div className="space-y-4">
      {lotes.map((lote) => (
        <LoteCard
          key={lote.id}
          lote={lote}
          claro={claro}
          onAbrirDetalhes={(op) => handleAbrirDetalhes(lote, op)}
        />
      ))}

      {opDetalhes && (
        <DetalhesOPModal
          op={opDetalhes}
          onClose={() => setOpDetalhes(null)}
          onAbrirDesenhos={(artigo, desenhos) =>
            setModalDesenhos({ artigo, desenhos })
          }
        />
      )}

      {modalDesenhos && (
        <VisualizadorDesenhoModal
          open={true}
          artigo={modalDesenhos.artigo}
          desenhos={modalDesenhos.desenhos}
          onClose={() => setModalDesenhos(null)}
        />
      )}
    </div>
  );
}

// ============================================================

function LoteCard({
  lote,
  claro,
  onAbrirDetalhes,
}: {
  lote: Lote;
  claro: boolean;
  onAbrirDetalhes: (op: OPLote) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const ops = lote.opsLote ?? [];
  const concluidas = ops.filter((o) => o.status === 'concluida').length;
  const progresso = ops.length > 0 ? Math.round((concluidas / ops.length) * 100) : 0;
  const tempoTotalMin = ops.reduce((acc, o) => acc + (o.tempoTotalPlanejado || 0), 0);

  const statusCor = CORES_STATUS_LOTE[lote.status] ?? 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
  const statusLabel = LABELS_STATUS_LOTE[lote.status] ?? lote.status ?? '—';

  return (
    <section
      className={`${
        claro ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
      } border rounded-xl overflow-hidden`}
    >
      {/* Header do lote */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={`w-full p-4 flex items-center justify-between transition ${
          claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/30'
        }`}
      >
        <div className="flex items-center gap-4">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${aberto ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div className="text-left">
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>
                Lote {lote.numeroLote}
              </span>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${statusCor}`}>
                {statusLabel}
              </span>
            </div>
            <div className={`text-xs mt-1 ${claro ? 'text-slate-500' : 'text-neutral-500'}`}>
              {lote.quantidadePecas} peças · {ops.length} operações · Tempo planejado:{' '}
              {formatarMinutos(tempoTotalMin)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-xs ${claro ? 'text-slate-500' : 'text-neutral-500'}`}>Progresso</div>
            <div className={`text-sm font-mono ${claro ? 'text-slate-700' : 'text-neutral-300'}`}>
              {concluidas} / {ops.length}
            </div>
          </div>
          <div className={`w-24 h-2 rounded-full overflow-hidden ${claro ? 'bg-slate-200' : 'bg-neutral-800'}`}>
            <div
              className="h-full bg-forja-500 transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </button>

      {/* Lista de OPs */}
      {aberto && (
        <div className={`border-t overflow-x-auto ${claro ? 'border-slate-200' : 'border-neutral-800'}`}>
          <table className="w-full text-sm">
            <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-50 text-slate-600' : 'bg-neutral-950/50 text-neutral-400'}`}>
              <tr>
                <th className="px-4 py-2 text-left font-medium w-12">Nº</th>
                <th className="px-4 py-2 text-left font-medium">Operação</th>
                <th className="px-4 py-2 text-left font-medium">Etapa</th>
                <th className="px-4 py-2 text-center font-medium">Inspeção</th>
                <th className="px-4 py-2 text-right font-mono font-medium">Tempo</th>
                <th className="px-4 py-2 text-center font-medium">Progresso</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-center font-medium w-16">Ação</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${claro ? 'divide-slate-200' : 'divide-neutral-800'}`}>
              {ops.map((op) => (
                <OPLoteRow
                  key={op.id}
                  op={op}
                  claro={claro}
                  qtdLote={lote.quantidadePecas}
                  onAbrirDetalhes={() => onAbrirDetalhes(op)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OPLoteRow({
  op,
  qtdLote,
  claro,
  onAbrirDetalhes,
}: {
  op: OPLote;
  qtdLote: number;
  claro: boolean;
  onAbrirDetalhes: () => void;
}) {
  const statusCor = CORES_STATUS_OP[op.status] ?? 'bg-neutral-500/15 text-neutral-400';
  const statusLabel = LABELS_STATUS_OP[op.status] ?? op.status ?? '—';

  return (
    <tr
      onClick={onAbrirDetalhes}
      className={`transition cursor-pointer group ${
        claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/60'
      }`}
      title="Clique para ver os detalhes da OP"
    >
      <td className={`px-4 py-2 font-mono text-center ${claro ? 'text-slate-500' : 'text-neutral-400'}`}>
        {op.codigoOp}
      </td>
      <td className="px-4 py-2">
        <div className={`font-medium transition flex items-center gap-1.5 ${
          claro ? 'text-slate-800 group-hover:text-forja-600' : 'text-neutral-200 group-hover:text-forja-400'
        }`}>
          <span>{op.tipoServico}</span>
          <span className="text-xs text-neutral-500 opacity-0 group-hover:opacity-100 transition">↗</span>
        </div>
        {op.observacoes && (
          <div className={`text-xs mt-0.5 ${claro ? 'text-slate-500' : 'text-neutral-500'}`}>{op.observacoes}</div>
        )}
      </td>
      <td className={`px-4 py-2 ${claro ? 'text-slate-600' : 'text-neutral-400'}`}>
        {op.etapa?.nome ?? '—'}
      </td>
      <td className="px-4 py-2 text-center">
        {op.exigeInspecao ? (
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-purple-500/15 text-purple-400">
            sim
          </span>
        ) : (
          <span className={`text-xs ${claro ? 'text-slate-400' : 'text-neutral-600'}`}>—</span>
        )}
      </td>
      <td className={`px-4 py-2 text-right font-mono text-xs ${claro ? 'text-slate-600' : 'text-neutral-400'}`}>
        {formatarMinutos(op.tempoTotalPlanejado)}
      </td>
      <td className={`px-4 py-2 text-center font-mono text-xs ${claro ? 'text-slate-800 font-medium' : 'text-neutral-300'}`}>
        {op.quantidadeConcluida} / {qtdLote}
      </td>
      <td className="px-4 py-2">
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${statusCor}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-2 text-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAbrirDetalhes();
          }}
          className={`px-2 py-1 text-xs rounded border border-transparent transition ${
            claro
              ? 'text-slate-500 hover:text-forja-600 hover:bg-slate-100 hover:border-slate-300'
              : 'text-neutral-400 hover:text-forja-300 hover:bg-neutral-800 hover:border-neutral-700'
          }`}
          title="Ver detalhes da OP"
        >
          🔍
        </button>
      </td>
    </tr>
  );
}

