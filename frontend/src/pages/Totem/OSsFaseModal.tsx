// ============================================================
// Forja - Modal de OSs da Fase (Pipeline)
// Popup que lista todas as OSs de uma fase do pipeline.
// Ao clicar em uma OS, abre o modal de Detalhes da OP.
// ============================================================

import { Modal } from '../../components/Modal';
import type { FasePipeline, CardPipeline } from '../../hooks/usePipelineEtapa';
import { tempoNaFase } from '../../hooks/usePipelineEtapa';

interface Props {
  fase: FasePipeline;
  onClose: () => void;
  onSelecionarOS: (card: CardPipeline) => void;
}

const STATUS_LABEL: Record<string, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
};

function corStatus(card: CardPipeline): string {
  if (card.paradaAtiva) return '#E24B4A';
  if (card.status === 'em_processo') return '#EF9F27';
  return '#6b7280';
}

function labelStatus(card: CardPipeline): string {
  if (card.paradaAtiva) return `Parado — ${card.paradaAtiva.motivo}`;
  return STATUS_LABEL[card.status] ?? card.status;
}

export function OSsFaseModal({ fase, onClose, onSelecionarOS }: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`${fase.nome} — ${fase.total} OS${fase.total !== 1 ? 's' : ''}`}
      size="md"
      forcarEscuro
    >
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {fase.cards.map((card) => (
          <button
            key={card.opLoteId}
            onClick={() => onSelecionarOS(card)}
            className="w-full text-left px-4 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-forja-500/50 transition-all group flex items-center gap-3"
          >
            {/* Indicador de status */}
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: corStatus(card) }}
            />

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-neutral-100">
                  {card.codigoGrv}
                </span>
                {card.prioridade === 'urgente' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-semibold">
                    URGENTE
                  </span>
                )}
                <span className="text-[11px] text-neutral-500">
                  Lote {card.numeroLote}
                </span>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 truncate">
                {card.cliente} · {card.artigo}
              </div>
            </div>

            {/* Status + tempo */}
            <div className="shrink-0 text-right">
              <div className="text-[11px] text-neutral-400">
                {labelStatus(card)}
              </div>
              {card.desdeQuando && (
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {tempoNaFase(card.desdeQuando)}
                </div>
              )}
            </div>

            {/* Seta */}
            <span className="text-neutral-600 group-hover:text-forja-400 transition-colors shrink-0">
              →
            </span>
          </button>
        ))}
      </div>

      {fase.cards.length === 0 && (
        <div className="text-center text-neutral-500 py-8">
          Nenhuma OS nesta fase
        </div>
      )}
    </Modal>
  );
}
