// ============================================================
// Forja - Hooks de Máquinas
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Maquina {
  id: string;
  nome: string;
  codigoInterno: string;
  tipo: string;
  etapaId: string;
  ativa: boolean;
  etapa?: { id: string; nome: string };
}

export interface ListaMaquinasFiltros {
  etapaId?: string;
  ativa?: boolean;
}

export const TIPOS_MAQUINA: Record<string, string> = {
  torno: 'Torno',
  vertiflow: 'Vertiflow',
  tres_eixos: '3 eixos',
  quinto_eixo: '5º eixo',
  fundicao: 'Fundição',
  metalizacao: 'Metalização',
  solda: 'Solda',
  qualidade: 'Qualidade',
  embalagem: 'Embalagem',
  outros: 'Outros',
};

export interface SalvarMaquinaInput {
  nome?: string;
  codigoInterno?: string;
  tipo?: string;
  etapaId?: string;
  ativa?: boolean;
}

export function useMaquinasList(filtros?: ListaMaquinasFiltros) {
  return useQuery<{ data: Maquina[] }>({
    queryKey: ['maquinas-list', filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros?.etapaId) params.set('etapaId', filtros.etapaId);
      if (filtros?.ativa !== undefined) params.set('ativa', String(filtros.ativa));
      const qs = params.toString();
      const res = await api.get(`/maquinas${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useSalvarMaquina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SalvarMaquinaInput }) => {
      const { data } = id
        ? await api.put<{ data: Maquina }>(`/maquinas/${id}`, input)
        : await api.post<{ data: Maquina }>('/maquinas', input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maquinas-list'] }),
  });
}
