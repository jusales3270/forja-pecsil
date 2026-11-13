// ============================================================
// Forja - Hooks de OPLote (Sprint 3 — tótem do programador)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Desenho } from './useDesenhos';

// ============================================================
// Tipos
// ============================================================

export type StatusOPLote =
  | 'na_fila'
  | 'em_processo'
  | 'aguardando_qualidade'
  | 'concluida'
  | 'bloqueada';

export const LABELS_STATUS_OP: Record<StatusOPLote, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguardando qualidade',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

export const CORES_STATUS_OP: Record<StatusOPLote, string> = {
  na_fila: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  em_processo: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  aguardando_qualidade: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  concluida: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  bloqueada: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export interface CarimboAnterior {
  id: string;
  timestampSaida: string;
  observacoes: string | null;
  etapa: { id: string; nome: string };
  programador: { id: string; nome: string } | null;
  operadorResponsavel: { id: string; nome: string } | null;
  maquina: { id: string; nome: string } | null;
  opLote: { id: string; codigoOp: string; tipoServico: string };
}

export interface OPLoteResumo {
  id: string;
  codigoOp: string;
  tipoServico: string;
  ordem: number;
  status: StatusOPLote;
  quantidadeConcluida: number;
  etapa: { id?: string; nome: string };
}

export interface OPLotePendente {
  envioExternoEm?: string | null;
  recebimentoExternoEm?: string | null;
  quantidadeEnvioExterno?: number | null;
  id: string;
  loteId: string;
  etapaId: string;
  codigoOp: string;
  tipoServico: string;
  ordem: number;
  status: StatusOPLote;
  quantidadeConcluida: number;
  tempoUnitPlanejado: number;
  tempoTotalPlanejado: number;
  exigeInspecao: boolean;
  /** Feita fora da fábrica: registra envio e retorno, não abre máquina. */
  terceirizada: boolean;
  fornecedor: string | null;
  prazoPrevistoDias: number | null;
  /** Só tempo (cura, resfriamento). Não ocupa máquina nem operador. */
  esperaHoras: number | null;
  /** A próxima OP do lote só começa com o lote inteiro fechado aqui. */
  exigeLoteCompleto: boolean;
  /** Peças esperando nesta operação agora. */
  pecasDisponiveis: number;
  /** Quanto a operação anterior liberou — o "de 12" do "3 de 12". */
  liberadasPelaAnterior: number;
  /** Preenchido quando uma operação anterior segura esta (tratamento térmico). */
  bloqueadoPor: { tipoServico: string; concluidas: number; total: number } | null;
  observacoes: string | null;
  criadoEm: string;
  carimboAnterior?: CarimboAnterior | null;
  /** Desbaste: a Metalização seguinte do lote, interna ou externa (nulo = ainda não escolhido). */
  metalizacaoDoLote?: {
    opLoteId: string;
    modo: 'interno' | 'externo' | null;
    podeAlterar: boolean;
    fornecedor: string | null;
  } | null;
  /** Metalização: escolha já feita no Desbaste. Nulo = lote antigo, escolhe aqui. */
  metalizacaoDefinida?: 'interno' | 'externo' | null;
  /** Lista de metalização externa: o lote já saiu para o fornecedor. */
  saiuParaExterno?: boolean;
  /** Lista de metalização externa: como está a operação de antes (o Desbaste). */
  operacaoAnterior?: { estacao: string; concluidas: number } | null;
  /** Desbaste: primeiro início do lote, conferir quantas peças chegaram. */
  conferenciaChegada?: { exigida: boolean; esperado: number } | null;
  /** Desbaste: peças que faltaram na chegada e ainda não apareceram. */
  faltaChegada?: { faltam: number; esperado: number; contado: number } | null;
  etapa: { id: string; nome: string };
  lote: {
    id: string;
    numeroLote: number;
    quantidadePecas: number;
    status: string;
    observacoes: string | null;
    opsLote?: OPLoteResumo[];
    os: {
      id: string;
      codigoGrv: string;
      prazoEntrega: string;
      criadoEm: string;
      prioridade: 'normal' | 'urgente';
      status: string;
      observacoes: string | null;
      cliente: { id: string; nome: string };
      criadoPor?: { id: string; nome: string };
      artigo: {
        id: string;
        codigo: string;
        descricao: string;
        observacoes?: string | null;
        desenhos?: Desenho[];
      };
    };
  };
}


export interface ParadaMaquina {
  id: string;
  inicio: string;
  fim: string | null;
  observacoes: string | null;
  motivoParada: { id: string; nome: string; planejado: boolean };
}

export interface CarimboAberto {
  id: string;
  timestampEntrada: string;
  timestampSaida: string | null;
  quantidadeConcluida: number;
  observacoes: string | null;
  /** Nulos em OP terceirizada ou de espera: não há máquina nem operador. */
  maquina: { id: string; nome: string; codigoInterno?: string } | null;
  programador: { id: string; nome: string } | null;
  operadorResponsavel: { id: string; nome: string } | null;
  paradas?: ParadaMaquina[];
}

export interface OPLoteEmAndamento extends OPLotePendente {
  carimbos: CarimboAberto[];
}

// ============================================================
// Filtros / Inputs
// ============================================================

export interface FiltroPendentes {
  etapaId: string;
  busca?: string;
}

export interface FiltroEmAndamento {
  etapaId: string;
}

export interface IniciarOPInput {
  modoMetalizacao?: 'interno';
  /** Escolha feita no Desbaste para a Metalização seguinte do lote. */
  metalizacao?: { modo: 'interno' | 'externo'; fornecedor?: string };
  /** Desbaste: quantas peças chegaram de fato. */
  conferenciaChegada?: { quantidade: number };
  /** Opcional: operação terceirizada ou de espera não ocupa máquina. */
  maquinaId?: string;
  operadorId?: string;
  observacoes?: string | null;
}

export interface EncerrarOPInput {
  quantidadeConcluida: number;
  observacoes?: string | null;
}

export interface EncerrarOPMeta {
  completou: boolean;
  novoStatus: StatusOPLote;
  proximaOpId: string | null;
  loteConcluido: boolean;
}

export interface PausarOPInput {
  motivoParadaId: string;
  observacoes?: string | null;
}

// ============================================================
// Queries
// ============================================================

export function useOPsPendentes(filtros: FiltroPendentes | null) {
  return useQuery<{ data: OPLotePendente[] }>({
    queryKey: ['op-lote-pendentes', filtros?.etapaId, filtros?.busca],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('etapaId', filtros!.etapaId);
      if (filtros?.busca) params.set('busca', filtros.busca);
      const res = await api.get(`/op-lote/pendentes?${params.toString()}`);
      return res.data;
    },
    enabled: !!filtros?.etapaId,
    refetchInterval: 30_000,
  });
}

export function useOPsEmAndamento(filtros: FiltroEmAndamento | null) {
  return useQuery<{ data: OPLoteEmAndamento[] }>({
    queryKey: ['op-lote-em-andamento', filtros?.etapaId],
    queryFn: async () => {
      const res = await api.get(
        `/op-lote/em-andamento?etapaId=${filtros!.etapaId}`,
      );
      return res.data;
    },
    enabled: !!filtros?.etapaId,
    refetchInterval: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useIniciarOP() {
  const qc = useQueryClient();
  return useMutation<
    { data: OPLoteEmAndamento },
    Error,
    { opLoteId: string; input: IniciarOPInput }
  >({
    mutationFn: async ({ opLoteId, input }) => {
      const res = await api.post(`/op-lote/${opLoteId}/iniciar`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['op-lote-pendentes'] });
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
      qc.invalidateQueries({ queryKey: ['op-lote-envios-externos'] });
      qc.invalidateQueries({ queryKey: ['faltas-chegada'] });
      qc.invalidateQueries({ queryKey: ['os-list'] });
      qc.invalidateQueries({ queryKey: ['os-detail'] });
    },
  });
}

export function useEncerrarOP() {
  const qc = useQueryClient();
  return useMutation<
    { data: OPLoteEmAndamento; meta: EncerrarOPMeta },
    Error,
    { opLoteId: string; input: EncerrarOPInput }
  >({
    mutationFn: async ({ opLoteId, input }) => {
      const res = await api.post(`/op-lote/${opLoteId}/encerrar`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['op-lote-pendentes'] });
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
      qc.invalidateQueries({ queryKey: ['op-lote-envios-externos'] });
      qc.invalidateQueries({ queryKey: ['faltas-chegada'] });
      qc.invalidateQueries({ queryKey: ['os-list'] });
      qc.invalidateQueries({ queryKey: ['os-detail'] });
      qc.invalidateQueries({ queryKey: ['os-timeline'] });
    },
  });
}

export function usePausarOP() {
  const qc = useQueryClient();
  return useMutation<
    { data: ParadaMaquina },
    Error,
    { opLoteId: string; input: PausarOPInput }
  >({
    mutationFn: async ({ opLoteId, input }) => {
      const res = await api.post(`/op-lote/${opLoteId}/pausar`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
    },
  });
}

export function useRetomarOP() {
  const qc = useQueryClient();
  return useMutation<{ data: ParadaMaquina }, Error, { opLoteId: string }>({
    mutationFn: async ({ opLoteId }) => {
      const res = await api.post(`/op-lote/${opLoteId}/retomar`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['op-lote-em-andamento'] });
    },
  });
}

export function useOPLoteDetail(id: string | null) {
  return useQuery({
    queryKey: ['op-lote-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get<{ data: OPLoteEmAndamento }>(`/op-lote/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

// ============================================================
// Helpers UI
// ============================================================

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${m}min`;
  const dias = Math.floor(h / 24);
  return `${dias}d`;
}

export function corPrazoOS(prazoIso: string): string {
  const dias = Math.ceil(
    (new Date(prazoIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (dias < 0) return 'text-red-400 font-semibold';
  if (dias < 3) return 'text-red-400';
  if (dias < 7) return 'text-amber-400';
  return 'text-neutral-200';
}

export function useEnviosExternos(etapaId?: string) {
  return useQuery<{ data: OPLotePendente[] }>({
    queryKey: ['op-lote-envios-externos', etapaId],
    queryFn: async () => (await api.get(`/op-lote/envios-externos?etapaId=${etapaId}`)).data,
    enabled: !!etapaId,
    refetchInterval: 30_000,
  });
}

export function useMetalizacaoExterna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, acao, fornecedor, observacoes }: {
      id: string; acao: 'enviar-externo' | 'receber-externo'; fornecedor?: string; observacoes?: string;
    }) => (await api.post(`/op-lote/${id}/${acao}`, acao === 'enviar-externo'
      ? { fornecedor, observacoes } : { confirmarRecebimento: true })).data,
    onSuccess: () => {
      for (const key of ['op-lote-envios-externos', 'op-lote-pendentes', 'op-lote-em-andamento', 'op-lote-detail', 'pipeline-etapa', 'os-list', 'os-detail', 'os-timeline']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

const CHAVES_CONFERENCIA = ['faltas-chegada', 'op-lote-pendentes', 'op-lote-em-andamento', 'op-lote-envios-externos', 'op-lote-detail', 'pipeline-etapa', 'dashboard', 'avisos', 'os-list', 'os-detail', 'os-timeline'];

/** Desbaste: chegaram peças que faltavam na conferência. */
export function useComplementoChegada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) =>
      (await api.post<{ data: { faltam: number } }>(`/op-lote/${id}/conferencia/complemento`, { quantidade })).data,
    onSuccess: () => { for (const key of CHAVES_CONFERENCIA) qc.invalidateQueries({ queryKey: [key] }); },
  });
}

/** PCP: aceita a falta; o lote passa a valer o que chegou. */
export function useAceitarFalta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      (await api.post<{ data: { quantidadeAntes: number; quantidadeDepois: number } }>(`/op-lote/${id}/conferencia/aceitar-falta`, { confirmar: true })).data,
    onSuccess: () => { for (const key of CHAVES_CONFERENCIA) qc.invalidateQueries({ queryKey: [key] }); },
  });
}

export interface FaltaChegadaAberta {
  opLoteId: string; osId: string; codigoGrv: string; artigo: string; numeroLote: number;
  esperado: number; contado: number; faltam: number;
  conferidoPor: string | null; conferidoEm: string;
  etapaOrigemId: string | null; estacaoOrigem: string | null;
}

/** Faltas de chegada abertas de peças que saíram desta estação (Fundição). */
export function useFaltasChegada(etapaId?: string) {
  return useQuery<{ data: FaltaChegadaAberta[] }>({
    queryKey: ['faltas-chegada', etapaId],
    queryFn: async () => (await api.get(`/op-lote/faltas-chegada?etapaId=${etapaId}`)).data,
    enabled: !!etapaId,
    refetchInterval: 30_000,
  });
}
