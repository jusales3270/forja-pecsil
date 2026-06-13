// ============================================================
// Forja - Hook de Máquinas (read-only)
// ============================================================

import { useQuery } from '@tanstack/react-query';
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
