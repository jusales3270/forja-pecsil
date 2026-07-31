// ============================================================
// Forja - Hooks de API para Motivos de Parada
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface MotivoParada {
  id: string;
  codigo: number | null;
  nome: string;
  planejado: boolean;
  ativo: boolean;
  capturaAutomaticaIot: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarMotivoParadaInput {
  codigo?: number | null;
  nome: string;
  planejado?: boolean;
  capturaAutomaticaIot?: boolean;
}

export interface AtualizarMotivoParadaInput {
  codigo?: number | null;
  nome?: string;
  planejado?: boolean;
  ativo?: boolean;
  capturaAutomaticaIot?: boolean;
}

const QUERY_KEY = ['motivos-parada'] as const;

// ---------------- LISTA ----------------
export function useMotivosParadaList(params?: { ativo?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<{ data: MotivoParada[] }>('/motivos-parada', {
        params,
      });
      return data.data;
    },
  });
}

// ---------------- CRIAR ----------------
export function useCreateMotivoParada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarMotivoParadaInput) => {
      const { data } = await api.post<{ data: MotivoParada }>(
        '/motivos-parada',
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdateMotivoParada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarMotivoParadaInput;
    }) => {
      const { data } = await api.put<{ data: MotivoParada }>(
        `/motivos-parada/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteMotivoParada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/motivos-parada/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
