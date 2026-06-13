// ============================================================
// Forja - Hooks de API para Operações do Artigo
// Aninhados em Artigo: /api/artigos/:artigoId/operacoes
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OperacaoArtigo {
  id: string;
  artigoId: string;
  etapaId: string;
  tipoServicoId: string | null;
  codigoOp: string;
  ordem: number;
  tipoServico: string;
  tempoUnitMin: number;
  tempoSetupMin: number;
  exigeInspecao: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  etapa?: { id: string; nome: string };
  tipoServicoRel?: { id: string; nome: string } | null;
}

export interface CriarOperacaoInput {
  etapaId: string;
  tipoServicoId?: string;
  codigoOp: string;
  ordem: number;
  tipoServico: string;
  tempoUnitMin: number;
  tempoSetupMin?: number;
  exigeInspecao?: boolean;
  observacoes?: string | null;
}

export interface AtualizarOperacaoInput {
  etapaId?: string;
  tipoServicoId?: string;
  codigoOp?: string;
  ordem?: number;
  tipoServico?: string;
  tempoUnitMin?: number;
  tempoSetupMin?: number;
  exigeInspecao?: boolean;
  observacoes?: string | null;
}

export interface ReordenarItem {
  id: string;
  ordem: number;
}

const queryKey = (artigoId: string) => ['operacoes', artigoId] as const;

// ---------------- LISTA ----------------
export function useOperacoesArtigoList(artigoId: string | null) {
  return useQuery({
    queryKey: queryKey(artigoId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: OperacaoArtigo[] }>(
        `/artigos/${artigoId}/operacoes`
      );
      return data.data;
    },
    enabled: !!artigoId,
  });
}

// ---------------- CRIAR ----------------
export function useCreateOperacaoArtigo(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarOperacaoInput) => {
      const { data } = await api.post<{ data: OperacaoArtigo }>(
        `/artigos/${artigoId}/operacoes`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
      // Invalida detalhe do artigo (pode mudar status, contador, etc)
      qc.invalidateQueries({ queryKey: ['artigos', 'detail', artigoId] });
    },
  });
}

// ---------------- ATUALIZAR (PATCH) ----------------
export function useUpdateOperacaoArtigo(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarOperacaoInput;
    }) => {
      const { data } = await api.patch<{ data: OperacaoArtigo }>(
        `/artigos/${artigoId}/operacoes/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteOperacaoArtigo(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/artigos/${artigoId}/operacoes/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- REORDENAR (bulk) ----------------
export function useReordenarOperacoes(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordens: ReordenarItem[]) => {
      const { data } = await api.post<{ data: OperacaoArtigo[] }>(
        `/artigos/${artigoId}/operacoes/reordenar`,
        { ordens }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}
