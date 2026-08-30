// ============================================================
// Forja - Pipeline de fases de uma etapa
// ============================================================
// Só a fundição tem fases hoje. Etapa de processo único devolve
// temFases: false e a tela mantém o comportamento de sempre.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CardPipeline {
  opLoteId: string;
  codigoOp: string;
  codigoGrv: string;
  osId: string;
  numeroLote: number;
  cliente: string;
  artigo: string;
  artigoDescricao: string;
  tipoServico: string;
  status: string;
  prioridade: string;
  quantidadeConcluida: number;
  quantidadePecas: number;
  diasAtePrazo: number;
  semaforo: 'verde' | 'amarelo' | 'vermelho';
  desdeQuando: string | null;
  operador: string | null;
  maquina: string | null;
  paradaAtiva: { motivo: string; planejado: boolean; inicio: string } | null;
  alertaInicioEm: string | null;
  etapaAvisada: string | null;
  terceirizada: boolean;
  fornecedor: string | null;
  prazoPrevistoDias: number | null;
  esperaHoras: number | null;
  /** Quando a espera vence. Null se não é espera ou ainda não começou. */
  liberaEm: string | null;
  exigeLoteCompleto: boolean;
}

export interface FasePipeline {
  tipoServicoId: string;
  nome: string;
  ordem: number;
  codigo: number | null;
  naFila: number;
  emProcesso: number;
  parado: number;
  total: number;
  cards: CardPipeline[];
}

export interface PipelineEtapa {
  etapaId: string;
  etapaNome: string;
  temFases: boolean;
  fases: FasePipeline[];
  semFase: CardPipeline[];
}

export function usePipelineEtapa(etapaId: string | null | undefined) {
  return useQuery({
    queryKey: ['pipeline-etapa', etapaId],
    enabled: Boolean(etapaId),
    queryFn: async () => {
      const { data } = await api.get<{ data: PipelineEtapa }>(
        `/etapas/${etapaId}/pipeline`,
      );
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

/** "em 4h" / "em 30min" / "vencida" — quanto falta pra espera liberar. */
export function faltaPara(iso: string): string {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (min <= 0) return 'liberada';
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h`;
  return `em ${Math.floor(h / 24)}d`;
}

/** "3d 4h" / "5h" / "12min" — tempo que a OS está na fase. */
export function tempoNaFase(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const resto = h % 24;
  return resto > 0 ? `${d}d ${resto}h` : `${d}d`;
}
