// ============================================================
// Forja - Aba "Lotes e OPs" do detalhe da OS
// ============================================================

import { useState } from 'react';
import type { OS, Lote, OPLote, StatusLote, StatusOPLote } from '../../../hooks/useOS';

interface LotesOpsTabProps {
  os: OS;
}

const LABELS_STATUS_LOTE: Record<StatusLote, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguardando qualidade',
  bloqueado: 'Bloqueado',
  concluido: 'Concluído',
};

const CORES_STATUS_LOTE: Record<StatusLote, string> = {
  na_fila: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  em_processo: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  aguardando_qualidade: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  bloqueado: 'bg-red-500/15 text-red-400 border-red-500/30',
  concluido: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const LABELS_STATUS_OP: Record<StatusOPLote, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguardando inspeção',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

const CORES_STATUS_OP: Record<StatusOPLote, string> = {
  na_fila: 'bg-blue-500/15 text-blue-400',
  em_processo: 'bg-amber-500/15 text-amber-400',
  aguardando_qualidade: 'bg-purple-500/15 text-purple-400',
  concluida: 'bg-emerald-500/15 text-emerald-400',
  bloqueada: 'bg-red-500/15 text-red-400',
};

function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function LotesOpsTab({ os }: LotesOpsTabProps) {
  const lotes = os.lotes ?? [];

  if (lotes.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center text-neutral-400">
        Nenhum lote nessa OS.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lotes.map((lote) => (
        <LoteCard key={lote.id} lote={lote} />
      ))}
    </div>
  );
}

// ============================================================

function LoteCard({ lote }: { lote: Lote }) {
  const [aberto, setAberto] = useState(true);
  const ops = lote.opsLote ?? [];
  const concluidas = ops.filter((o) => o.status === 'concluida').length;
  const progresso = ops.length > 0 ? Math.round((concluidas / ops.length) * 100) : 0;
  const tempoTotalMin = ops.reduce((acc, o) => acc + (o.tempoTotalPlanejado || 0), 0);

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header do lote */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full p-4 flex items-center justify-between hover:bg-neutral-800/30 transition"
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
              <span className="font-semibold text-neutral-100">
                Lote {lote.numeroLote}
              </span>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${CORES_STATUS_LOTE[lote.status]}`}
              >
                {LABELS_STATUS_LOTE[lote.status]}
              </span>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {lote.quantidadePecas} peças · {ops.length} operações · Tempo planejado:{' '}
              {formatarMinutos(tempoTotalMin)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-neutral-500">Progresso</div>
            <div className="text-sm font-mono text-neutral-300">
              {concluidas} / {ops.length}
            </div>
          </div>
          <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-forja-500 transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </button>

      {/* Lista de OPs */}
      {aberto && (
        <div className="border-t border-neutral-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-950/50 text-neutral-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left font-medium w-12">Nº</th>
                <th className="px-4 py-2 text-left font-medium">Operação</th>
                <th className="px-4 py-2 text-left font-medium">Etapa</th>
                <th className="px-4 py-2 text-center font-medium">Inspeção</th>
                <th className="px-4 py-2 text-right font-medium">Tempo</th>
                <th className="px-4 py-2 text-center font-medium">Progresso</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {ops.map((op) => (
                <OPLoteRow key={op.id} op={op} qtdLote={lote.quantidadePecas} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OPLoteRow({ op, qtdLote }: { op: OPLote; qtdLote: number }) {
  return (
    <tr className="hover:bg-neutral-800/30 transition">
      <td className="px-4 py-2 font-mono text-neutral-400 text-center">
        {op.codigoOp}
      </td>
      <td className="px-4 py-2">
        <div className="text-neutral-200">{op.tipoServico}</div>
        {op.observacoes && (
          <div className="text-xs text-neutral-500 mt-0.5">{op.observacoes}</div>
        )}
      </td>
      <td className="px-4 py-2 text-neutral-400">{op.etapa?.nome ?? '—'}</td>
      <td className="px-4 py-2 text-center">
        {op.exigeInspecao ? (
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-purple-500/15 text-purple-400">
            sim
          </span>
        ) : (
          <span className="text-neutral-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right font-mono text-neutral-400 text-xs">
        {formatarMinutos(op.tempoTotalPlanejado)}
      </td>
      <td className="px-4 py-2 text-center font-mono text-neutral-300 text-xs">
        {op.quantidadeConcluida} / {qtdLote}
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${CORES_STATUS_OP[op.status]}`}
        >
          {LABELS_STATUS_OP[op.status]}
        </span>
      </td>
    </tr>
  );
}
