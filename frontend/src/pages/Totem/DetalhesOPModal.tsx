// ============================================================
// Forja - Modal de Detalhes da OP
// Permite ao PCP e operadores visualizar todas as informações
// da OP, datas (criação e entrega), observações e esteira do lote
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import {
  type OPLotePendente,
  type OPLoteEmAndamento,
  LABELS_STATUS_OP,
  CORES_STATUS_OP,
  tempoDesde,
  corPrazoOS,
} from '../../hooks/useOPLote';
import { temCapacidade, type Papel } from '../../lib/permissions';
import { useAuth } from '../../lib/auth-store';
import type { Desenho } from '../../hooks/useDesenhos';

interface Props {
  op: OPLotePendente | OPLoteEmAndamento;
  onClose: () => void;
  onAbrirDesenhos?: (
    artigo: { id: string; codigo: string; descricao?: string },
    desenhos: Desenho[],
  ) => void;
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function diasAtePrazo(prazoIso: string): { texto: string; cor: string } {
  const diffMs = new Date(prazoIso).getTime() - Date.now();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (dias < 0) {
    return { texto: `Atrasada há ${Math.abs(dias)} dia(s)`, cor: 'text-red-400 bg-red-500/10 border-red-500/30' };
  }
  if (dias === 0) {
    return { texto: 'Vence hoje!', cor: 'text-red-400 bg-red-500/10 border-red-500/30' };
  }
  if (dias < 3) {
    return { texto: `Faltam ${dias} dia(s)`, cor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  }
  return { texto: `Prazo em ${dias} dia(s)`, cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
}

export function DetalhesOPModal({ op, onClose, onAbrirDesenhos }: Props) {
  const navigate = useNavigate();
  const pessoa = useAuth((s) => s.pessoa);
  const podeVerOSCompleta = temCapacidade(pessoa?.papel as Papel, 'os_listar');

  const os = op.lote.os;
  const artigo = os.artigo;
  const desenhos = artigo.desenhos ?? [];
  const statusPrazo = diasAtePrazo(os.prazoEntrega);
  const dataCriacao = op.criadoEm || os.criadoEm;
  const opsLote = op.lote.opsLote ?? [];

  const carimbos = 'carimbos' in op ? op.carimbos : [];
  const carimboAberto = carimbos.find((c) => !c.timestampSaida) ?? carimbos[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Detalhes da OP ${op.codigoOp} — ${os.codigoGrv}`}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {desenhos.length > 0 && onAbrirDesenhos && (
              <button
                type="button"
                onClick={() => onAbrirDesenhos(artigo, desenhos)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-sm font-medium rounded-lg border border-neutral-700 transition flex items-center gap-1.5"
              >
                <span>📐</span>
                <span>Ver Desenhos ({desenhos.length})</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {podeVerOSCompleta && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/os/${os.id}`);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-forja-400 hover:text-forja-300 text-sm font-medium rounded-lg border border-neutral-700 transition flex items-center gap-1.5"
                title="Visualizar a Ordem de Serviço completa"
              >
                <span>Abrir OS Completa</span>
                <span>↗</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-lg text-sm font-medium transition"
            >
              Fechar
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Painel de Datas & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
              Data de Criação
            </span>
            <div className="text-base font-semibold text-neutral-200">
              📅 {formatarDataHora(dataCriacao)}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
              Prazo de Entrega
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-base font-semibold ${corPrazoOS(os.prazoEntrega)}`}>
                🎯 {formatarData(os.prazoEntrega)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPrazo.cor}`}>
                {statusPrazo.texto}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
              Status da Operação
            </span>
            <div>
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded border ${CORES_STATUS_OP[op.status]}`}>
                {LABELS_STATUS_OP[op.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Informações Principais da OS e Artigo */}
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {os.prioridade === 'urgente' && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">
                    ! URGENTE
                  </span>
                )}
                <span className="font-mono text-xl font-bold text-forja-400">
                  {os.codigoGrv}
                </span>
                <span className="text-sm text-neutral-400">· {os.cliente?.nome}</span>
              </div>
              <div className="text-base font-medium text-neutral-100 flex items-center gap-2">
                <span>{artigo.codigo}</span>
              </div>
              <div className="text-sm text-neutral-400 mt-0.5">
                {artigo.descricao}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-neutral-500 block">Lote {op.lote.numeroLote}</span>
              <span className="text-lg font-bold text-neutral-100">
                {op.pecasDisponiveis} <span className="text-sm text-neutral-500">de {op.lote.quantidadePecas} pçs</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dados da Operação Atual */}
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Operação Atual: {op.codigoOp} — {op.tipoServico}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-neutral-500 block">Etapa</span>
              <span className="text-neutral-200 font-medium">{op.etapa.nome}</span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 block">Tempo Planejado</span>
              <span className="text-neutral-200 font-medium">
                {op.tempoTotalPlanejado ? `${op.tempoTotalPlanejado} min` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 block">Inspeção Requerida</span>
              <span className="text-neutral-200 font-medium">
                {op.exigeInspecao ? 'Sim (Qualidade)' : 'Não'}
              </span>
            </div>
            <div>
              <span className="text-xs text-neutral-500 block">Tipo</span>
              <span className="text-neutral-200 font-medium">
                {op.terceirizada ? '🚚 Externa' : op.esperaHoras ? `⏳ Espera (${op.esperaHoras}h)` : 'Interna'}
              </span>
            </div>
          </div>

          {carimboAberto && (
            <div className="mt-3 pt-3 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-neutral-300">
              <div>
                <span className="text-neutral-500">Máquina:</span> {carimboAberto.maquina?.nome ?? '—'}
              </div>
              <div>
                <span className="text-neutral-500">Operador:</span> {carimboAberto.operadorResponsavel?.nome ?? '—'}
              </div>
              <div>
                <span className="text-neutral-500">Iniciada há:</span> {tempoDesde(carimboAberto.timestampEntrada)}
              </div>
            </div>
          )}
        </div>

        {/* Roteiro / Esteira completa de operações do lote */}
        {opsLote.length > 0 && (
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Esteira de Produção do Lote ({opsLote.length} operações)
              </h3>
              <span className="text-xs text-neutral-500">
                {opsLote.filter((o) => o.status === 'concluida').length} de {opsLote.length} concluídas
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {opsLote.map((item, index) => {
                const isAtual = item.id === op.id;
                const isConcluida = item.status === 'concluida';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition border ${
                      isAtual
                        ? 'bg-forja-500/15 border-forja-500/50 text-neutral-100 font-medium'
                        : isConcluida
                          ? 'bg-neutral-900/40 border-neutral-800/60 text-neutral-400'
                          : 'bg-neutral-900/20 border-neutral-800/30 text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-right font-mono text-neutral-500 shrink-0">
                        {index + 1}.
                      </span>
                      <span className="font-mono text-neutral-400 shrink-0">
                        {item.codigoOp}
                      </span>
                      <span className="truncate">{item.tipoServico}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 shrink-0">
                        {item.etapa?.nome}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isAtual && (
                        <span className="text-[10px] uppercase font-bold text-forja-400 tracking-wider bg-forja-500/20 px-1.5 py-0.5 rounded">
                          ★ Atual
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded ${CORES_STATUS_OP[item.status]}`}>
                        {LABELS_STATUS_OP[item.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Observações Herdadas */}
        <div className="space-y-2">
          {os.observacoes && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs space-y-1">
              <span className="text-amber-400 font-semibold uppercase text-[10px]">
                ⚠ Observação da OS {os.criadoPor?.nome ? `(por ${os.criadoPor.nome})` : ''}
              </span>
              <p className="text-neutral-200">{os.observacoes}</p>
            </div>
          )}

          {artigo.observacoes && (
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs space-y-1">
              <span className="text-neutral-400 font-semibold uppercase text-[10px]">
                Observação do Artigo
              </span>
              <p className="text-neutral-300">{artigo.observacoes}</p>
            </div>
          )}

          {op.observacoes && (
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs space-y-1">
              <span className="text-neutral-400 font-semibold uppercase text-[10px]">
                Observação da Operação
              </span>
              <p className="text-neutral-300">{op.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
