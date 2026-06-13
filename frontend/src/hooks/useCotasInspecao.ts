// ============================================================
// Forja - Hooks de API para Cotas de Inspeção
// Aninhados no Plano: /api/artigos/:artigoId/operacoes/:opId/plano/cotas
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Caracteristica = 'funcional' | 'critica' | 'processo';

export type Frequencia =
  | 'todas'
  | 'primeira'
  | 'um_em_3'
  | 'um_em_5'
  | 'um_em_10'
  | 'na_preparacao';

export type Instrumento =
  | 'paq_digital'
  | 'comparador'
  | 'altimetro'
  | 'micrometro'
  | 'renishaw'
  | 'visual'
  | 'metrologia'
  | 'outros';

// Labels amigáveis pra UI
export const LABELS_CARACTERISTICA: Record<Caracteristica, string> = {
  funcional: 'Funcional',
  critica: 'Crítica',
  processo: 'Processo',
};

export const LABELS_FREQUENCIA: Record<Frequencia, string> = {
  todas: 'Todas',
  primeira: '1ª peça',
  um_em_3: '1 em 3',
  um_em_5: '1 em 5',
  um_em_10: '1 em 10',
  na_preparacao: 'Na preparação',
};

export const LABELS_INSTRUMENTO: Record<Instrumento, string> = {
  paq_digital: 'Paquímetro digital',
  comparador: 'Comparador',
  altimetro: 'Altímetro',
  micrometro: 'Micrômetro',
  renishaw: 'Renishaw',
  visual: 'Visual',
  metrologia: 'Metrologia (sala)',
  outros: 'Outros',
};

export interface CotaInspecao {
  id: string;
  planoInspecaoId: string;
  codigoCota: string;
  valorNominal: number;
  toleranciaMais: number | null;
  toleranciaMenos: number | null;
  caracteristica: Caracteristica;
  frequenciaMonitorar: Frequencia;
  frequenciaRegistrar: Frequencia;
  instrumento: Instrumento;
  ordem: number;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarCotaInput {
  codigoCota: string;
  valorNominal: number;
  toleranciaMais?: number | null;
  toleranciaMenos?: number | null;
  caracteristica: Caracteristica;
  frequenciaMonitorar: Frequencia;
  frequenciaRegistrar: Frequencia;
  instrumento: Instrumento;
  ordem: number;
  observacoes?: string | null;
}

export interface AtualizarCotaInput {
  codigoCota?: string;
  valorNominal?: number;
  toleranciaMais?: number | null;
  toleranciaMenos?: number | null;
  caracteristica?: Caracteristica;
  frequenciaMonitorar?: Frequencia;
  frequenciaRegistrar?: Frequencia;
  instrumento?: Instrumento;
  ordem?: number;
  observacoes?: string | null;
}

export interface ReordenarCotaItem {
  id: string;
  ordem: number;
}

const queryKey = (artigoId: string, opId: string) =>
  ['cotas-inspecao', artigoId, opId] as const;
const planoQueryKey = (artigoId: string, opId: string) =>
  ['plano-inspecao', artigoId, opId] as const;

// ---------------- LISTA ----------------
export function useCotasInspecaoList(
  artigoId: string | null,
  opId: string | null
) {
  return useQuery({
    queryKey: queryKey(artigoId ?? '', opId ?? ''),
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: CotaInspecao[] }>(
          `/artigos/${artigoId}/operacoes/${opId}/plano/cotas`
        );
        return data.data;
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    enabled: !!artigoId && !!opId,
    retry: (failureCount, err: any) => {
      if (err?.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// ---------------- CRIAR ----------------
export function useCreateCotaInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarCotaInput) => {
      const { data } = await api.post<{ data: CotaInspecao }>(
        `/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
      qc.invalidateQueries({ queryKey: planoQueryKey(artigoId, opId) });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdateCotaInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarCotaInput;
    }) => {
      const { data } = await api.patch<{ data: CotaInspecao }>(
        `/artigos/${artigoId}/operacoes/${opId}/plano/cotas/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteCotaInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(
        `/artigos/${artigoId}/operacoes/${opId}/plano/cotas/${id}`
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
    },
  });
}

// ---------------- REORDENAR (bulk) ----------------
export function useReordenarCotas(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordens: ReordenarCotaItem[]) => {
      const { data } = await api.post<{ data: CotaInspecao[] }>(
        `/artigos/${artigoId}/operacoes/${opId}/plano/cotas/reordenar`,
        { ordens }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
    },
  });
}
