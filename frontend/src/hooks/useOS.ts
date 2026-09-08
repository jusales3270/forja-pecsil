// ============================================================
// Forja - Hooks de OS (Ordens de Serviço)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Desenho } from './useDesenhos';

// ============================================================
// Tipos
// ============================================================

export const STATUS_OS = [
  'aberta',
  'em_producao',
  'finalizada',
  'atrasada',
  'cancelada',
] as const;
export type StatusOS = (typeof STATUS_OS)[number];

export const LABELS_STATUS_OS: Record<StatusOS, string> = {
  aberta: 'Aberta',
  em_producao: 'Em produção',
  finalizada: 'Finalizada',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

export type Prioridade = 'normal' | 'urgente';

export type StatusLote =
  | 'na_fila'
  | 'em_processo'
  | 'aguardando_qualidade'
  | 'bloqueado'
  | 'concluido';

export type StatusOPLote =
  | 'na_fila'
  | 'em_processo'
  | 'aguardando_qualidade'
  | 'concluida'
  | 'bloqueada';

export interface OPLote {
  id: string;
  loteId: string;
  operacaoArtigoId: string;
  etapaId: string;
  codigoGrvOp: string | null;
  ordem: number;
  status: StatusOPLote;
  quantidadeConcluida: number;
  tempoUnitPlanejado: number;
  tempoTotalPlanejado: number;
  codigoOp: string;
  tipoServico: string;
  exigeInspecao: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  etapa?: { id: string; nome: string };
}

export interface Lote {
  id: string;
  osId: string;
  numeroLote: number;
  quantidadePecas: number;
  status: StatusLote;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  opsLote?: OPLote[];
}

export interface OS {
  id: string;
  codigoGrv: string;
  clienteId: string;
  artigoId: string;
  quantidadeTotal: number;
  prazoEntrega: string;
  dataAbertura: string;
  prioridade: Prioridade;
  status: StatusOS;
  observacoes: string | null;
  // Financeiros
  precoUnitario: string | null; // Decimal vem como string da API
  valorTotal: string | null;
  numeroFiscal: string | null;
  poCliente: string | null;
  statusFiscal: string | null;
  valorRecebido: string | null;
  dataNf: string | null;
  dataPagamento: string | null;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
  cliente?: { id: string; nome: string };
  artigo?: {
    id: string;
    codigo: string;
    descricao: string;
    tipoProduto?: string;
    observacoes?: string | null;
    desenhos?: Desenho[];
  };
  criadoPor?: { id: string; nome: string };
  lotes?: Lote[];
  _count?: { lotes: number };
}

export interface EventoOS {
  id: string;
  osId: string;
  loteId: string | null;
  tipo: string;
  autorId: string | null;
  payload: any;
  visivelDashboard: boolean;
  timestamp: string;
  autor?: { id: string; nome: string };
  lote?: { id: string; numeroLote: number };
}

// ============================================================
// Filtros
// ============================================================

export interface ListaOSFiltros {
  clienteId?: string;
  artigoId?: string;
  status?: StatusOS;
  prioridade?: Prioridade;
  busca?: string;
}

// ============================================================
// Inputs
// ============================================================

export type DivisaoLotes =
  | { tipoDivisao: 'unico' }
  | { tipoDivisao: 'quantidade_lotes'; quantidadeLotes: number }
  | { tipoDivisao: 'tamanho_lote'; tamanhoLote: number };

export interface CreateOSInput {
  codigoGrv: string;
  clienteId: string;
  artigoId: string;
  quantidadeTotal: number;
  prazoEntrega: string; // ISO datetime
  prioridade?: Prioridade;
  observacoes?: string | null;
  precoUnitario?: number | null;
  valorTotal?: number | null;
  numeroFiscal?: string | null;
  poCliente?: string | null;
  statusFiscal?: string | null;
  valorRecebido?: number | null;
  dataNf?: string | null;
  dataPagamento?: string | null;
  divisao?: DivisaoLotes;
}

export interface UpdateOSInput {
  prazoEntrega?: string;
  prioridade?: Prioridade;
  observacoes?: string | null;
  precoUnitario?: number | null;
  valorTotal?: number | null;
  numeroFiscal?: string | null;
  poCliente?: string | null;
  statusFiscal?: string | null;
  valorRecebido?: number | null;
  dataNf?: string | null;
  dataPagamento?: string | null;
}

// ============================================================
// Queries
// ============================================================

export function useOSList(filtros?: ListaOSFiltros) {
  return useQuery<{ data: OS[] }>({
    queryKey: ['os-list', filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros?.clienteId) params.set('clienteId', filtros.clienteId);
      if (filtros?.artigoId) params.set('artigoId', filtros.artigoId);
      if (filtros?.status) params.set('status', filtros.status);
      if (filtros?.prioridade) params.set('prioridade', filtros.prioridade);
      if (filtros?.busca) params.set('busca', filtros.busca);
      const qs = params.toString();
      const res = await api.get(`/os${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useOSDetail(id: string | null) {
  return useQuery<{ data: OS }>({
    queryKey: ['os-detail', id],
    queryFn: async () => {
      const res = await api.get(`/os/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useOSTimeline(id: string | null) {
  return useQuery<{ data: EventoOS[] }>({
    queryKey: ['os-timeline', id],
    queryFn: async () => {
      const res = await api.get(`/os/${id}/timeline`);
      return res.data;
    },
    enabled: !!id,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useCreateOS() {
  const qc = useQueryClient();
  return useMutation<{ data: OS }, Error, CreateOSInput>({
    mutationFn: async (input) => {
      const res = await api.post('/os', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['os-list'] });
    },
  });
}

export function useUpdateOS(id: string) {
  const qc = useQueryClient();
  return useMutation<{ data: OS }, Error, UpdateOSInput>({
    mutationFn: async (input) => {
      const res = await api.patch(`/os/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['os-list'] });
      qc.invalidateQueries({ queryKey: ['os-detail', id] });
      qc.invalidateQueries({ queryKey: ['os-timeline', id] });
    },
  });
}

export function useCancelarOS() {
  const qc = useQueryClient();
  return useMutation<{ data: { id: string; cancelada: boolean } }, Error, string>({
    mutationFn: async (id) => {
      const res = await api.delete(`/os/${id}`);
      return res.data;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['os-list'] });
      qc.invalidateQueries({ queryKey: ['os-detail', id] });
      qc.invalidateQueries({ queryKey: ['os-timeline', id] });
    },
  });
}

// ============================================================
// Helpers UI
// ============================================================

export const CORES_STATUS_OS: Record<StatusOS, string> = {
  aberta: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  em_producao: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  finalizada: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  atrasada: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelada: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

export function formatarPrazo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

export function diasAtePrazo(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function corPrazo(iso: string, status: StatusOS): string {
  if (status === 'finalizada' || status === 'cancelada') return 'text-neutral-400';
  const dias = diasAtePrazo(iso);
  if (dias < 0) return 'text-red-400 font-semibold';
  if (dias < 3) return 'text-red-400';
  if (dias < 7) return 'text-amber-400';
  return 'text-neutral-200';
}
