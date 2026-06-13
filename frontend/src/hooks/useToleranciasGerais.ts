// ============================================================
// Forja - Hooks de API para Tolerâncias Gerais por Cliente
// Aninhados em Cliente: /api/clientes/:clienteId/tolerancias-gerais
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ToleranciaGeral {
  id: string;
  clienteId: string;
  faixaMin: number;
  faixaMax: number;
  toleranciaMais: number;
  toleranciaMenos: number;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarToleranciaInput {
  faixaMin: number;
  faixaMax: number;
  toleranciaMais: number;
  toleranciaMenos: number;
  observacoes?: string | null;
}

export interface AtualizarToleranciaInput {
  faixaMin?: number;
  faixaMax?: number;
  toleranciaMais?: number;
  toleranciaMenos?: number;
  observacoes?: string | null;
}

const queryKey = (clienteId: string) =>
  ['tolerancias-gerais', clienteId] as const;

// ---------------- LISTA ----------------
export function useToleranciasGeraisList(clienteId: string | null) {
  return useQuery({
    queryKey: queryKey(clienteId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: ToleranciaGeral[] }>(
        `/clientes/${clienteId}/tolerancias-gerais`
      );
      return data.data;
    },
    enabled: !!clienteId, // só dispara se tem cliente selecionado
  });
}

// ---------------- CRIAR ----------------
export function useCreateToleranciaGeral(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarToleranciaInput) => {
      const { data } = await api.post<{ data: ToleranciaGeral }>(
        `/clientes/${clienteId}/tolerancias-gerais`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(clienteId) });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdateToleranciaGeral(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarToleranciaInput;
    }) => {
      const { data } = await api.put<{ data: ToleranciaGeral }>(
        `/tolerancias-gerais/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(clienteId) });
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteToleranciaGeral(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tolerancias-gerais/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(clienteId) });
    },
  });
}
