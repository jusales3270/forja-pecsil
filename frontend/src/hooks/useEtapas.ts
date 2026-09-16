// ============================================================
// Forja - Hooks de API para Etapas (estações)
// Dropdowns do backoffice + cadastro de estações (admin)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Etapa {
  id: string;
  nome: string;
  ordemPadrao: number;
  slaHoras: number;
  aplicaParaTipos: string[];
  exigeCheckpointQualidade: boolean;
  ativa: boolean;
}

export interface SalvarEtapaInput {
  nome?: string;
  ordemPadrao?: number;
  slaHoras?: number;
  exigeCheckpointQualidade?: boolean;
  ativa?: boolean;
}

const QUERY_KEY = ['etapas'] as const;

export function useEtapasList(opcoes?: { incluirInativas?: boolean }) {
  const incluirInativas = opcoes?.incluirInativas ?? false;
  return useQuery({
    queryKey: [...QUERY_KEY, { incluirInativas }],
    queryFn: async () => {
      const { data } = await api.get<{ data: Etapa[] }>('/etapas', {
        params: incluirInativas ? { incluirInativas: 'true' } : undefined,
      });
      return data.data;
    },
    // Etapas mudam raramente — cache mais agressivo
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useSalvarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SalvarEtapaInput }) => {
      const { data } = id
        ? await api.put<{ data: Etapa }>(`/etapas/${id}`, input)
        : await api.post<{ data: Etapa }>('/etapas', input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
