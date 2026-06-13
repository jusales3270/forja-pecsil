// ============================================================
// Forja - Hooks de API para Tipos de Serviço
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface TipoServico {
  id: string;
  nome: string;
  etapaId: string;
  exigeInspecao: boolean;
  ativo: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  etapa?: { id: string; nome: string };
}

export interface CriarTipoServicoInput {
  nome: string;
  etapaId: string;
  exigeInspecao?: boolean;
  observacoes?: string;
}

export interface AtualizarTipoServicoInput {
  nome?: string;
  etapaId?: string;
  exigeInspecao?: boolean;
  ativo?: boolean;
  observacoes?: string | null;
}

const QUERY_KEY = ['tipos-servico'] as const;

// ---------------- LISTA ----------------
export function useTiposServicoList(params?: { ativo?: boolean; q?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<{ data: TipoServico[] }>('/tipos-servico', {
        params,
      });
      return data.data;
    },
  });
}

// ---------------- CRIAR ----------------
export function useCreateTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarTipoServicoInput) => {
      const { data } = await api.post<{ data: TipoServico }>(
        '/tipos-servico',
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
export function useUpdateTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarTipoServicoInput;
    }) => {
      const { data } = await api.put<{ data: TipoServico }>(
        `/tipos-servico/${id}`,
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
export function useDeleteTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tipos-servico/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
