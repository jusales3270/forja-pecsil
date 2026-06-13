// ============================================================
// Forja - Hooks de API para Plano de Inspeção
// Aninhado em Operação: /api/artigos/:artigoId/operacoes/:opId/plano
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CotaInspecao } from './useCotasInspecao';

export interface PlanoInspecao {
  id: string;
  operacaoArtigoId: string;
  observacoesGerais: string | null;
  criadoEm: string;
  atualizadoEm: string;
  cotas?: CotaInspecao[];
}

export interface CriarPlanoInput {
  observacoesGerais?: string | null;
}

export interface AtualizarPlanoInput {
  observacoesGerais?: string | null;
}

const queryKey = (artigoId: string, opId: string) =>
  ['plano-inspecao', artigoId, opId] as const;

// ---------------- GET ----------------
// Retorna 404 se ainda não existe — convertemos pra null
export function usePlanoInspecao(
  artigoId: string | null,
  opId: string | null
) {
  return useQuery({
    queryKey: queryKey(artigoId ?? '', opId ?? ''),
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: PlanoInspecao }>(
          `/artigos/${artigoId}/operacoes/${opId}/plano`
        );
        return data.data;
      } catch (err: any) {
        // 404 = plano ainda não criado, é um estado válido
        if (err?.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!artigoId && !!opId,
    // 404 não é erro retryável
    retry: (failureCount, err: any) => {
      if (err?.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// ---------------- CRIAR (idempotente) ----------------
export function useCreatePlanoInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarPlanoInput) => {
      const { data } = await api.post<{ data: PlanoInspecao }>(
        `/artigos/${artigoId}/operacoes/${opId}/plano`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdatePlanoInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AtualizarPlanoInput) => {
      const { data } = await api.patch<{ data: PlanoInspecao }>(
        `/artigos/${artigoId}/operacoes/${opId}/plano`,
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
export function useDeletePlanoInspecao(artigoId: string, opId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/artigos/${artigoId}/operacoes/${opId}/plano`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId, opId) });
    },
  });
}
