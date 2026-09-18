// ============================================================
// Forja - Hooks de API para Clientes
// Usado pra preencher seletores de cliente no backoffice
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Cliente {
  id: string;
  nome: string;
  observacoes: string | null;
}

const QUERY_KEY = ['clientes'] as const;

export function useClientesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Cliente[] }>('/clientes');
      return data.data;
    },
    // Clientes mudam raramente
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------- CADASTRAR (ou reativar) ----------------
export function useCriarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; observacoes?: string | null }) => {
      const { data } = await api.post<{ data: Cliente; meta: { reativado: boolean } }>('/clientes', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ---------------- EXCLUIR (com histórico, só desativa) ----------------
export function useExcluirCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<{ data: { excluido: boolean; desativado: boolean }; message: string }>(`/clientes/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
