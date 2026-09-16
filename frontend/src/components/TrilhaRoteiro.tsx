// ============================================================
// Forja - Trilha do roteiro de um lote
// ============================================================
// ✓ Engenharia → ● SERRA 4/100 → ○ Torno → ○ Qualidade
// A ordem é a das operações que o PCP escolheu para a peça — não a ordem das
// estações. Um lote parcial pode ter mais de um ponto "agora".
// ============================================================

import type { PassoRoteiro } from '../hooks/useDashboard';

const MARCA: Record<PassoRoteiro['estado'], string> = {
  concluido: '✓',
  atual: '●',
  externo: '⇄',
  futuro: '○',
};

const COR: Record<PassoRoteiro['estado'], string> = {
  concluido: 'text-emerald-500',
  atual: 'text-amber-500 font-semibold',
  externo: 'text-sky-500 font-semibold',
  futuro: 'dash-muted',
};

const DESCRICAO: Record<PassoRoteiro['estado'], string> = {
  concluido: 'concluída',
  atual: 'em andamento agora',
  externo: 'em envio externo',
  futuro: 'ainda não chegou',
};

export function TrilhaRoteiro({ passos, quantidadePecas }: { passos: PassoRoteiro[]; quantidadePecas: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm" aria-label="Roteiro do lote">
      {passos.map((p, i) => (
        <li key={p.opLoteId} className="flex items-center gap-1">
          <span
            className={`inline-flex items-baseline gap-1 whitespace-nowrap ${COR[p.estado]}`}
            title={`OP ${p.codigoOp} · ${p.tipoServico} · ${p.estacao} — ${DESCRICAO[p.estado]}`}
          >
            <span aria-hidden="true">{MARCA[p.estado]}</span>
            <span>{p.estacao}</span>
            {p.tipoServico.toLocaleLowerCase() !== p.estacao.toLocaleLowerCase() && (
              <span className="text-xs opacity-75">({p.tipoServico})</span>
            )}
            {(p.estado === 'atual' || p.estado === 'externo') && (
              <span className="text-xs tabular-nums">
                {p.estado === 'externo' ? 'fora' : `${p.concluidas}/${p.concluidas + p.disponiveis || quantidadePecas}`}
              </span>
            )}
            <span className="sr-only">{DESCRICAO[p.estado]}</span>
          </span>
          {i < passos.length - 1 && <span className="dash-muted px-0.5" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}
