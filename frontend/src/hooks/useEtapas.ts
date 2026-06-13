// ============================================================
// Forja - Hook de API para Etapas (read-only)
// Usado pra preencher dropdowns no backoffice
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Etapa {
  id: string;
  nome: string;
  ordemPadrao: number;
  slaHoras: number;
  aplicaParaTipos: string[];
  exigeCheckpointQualidade: boolean;
}

const QUERY_KEY = ['etapas'] as const;

export function useEtapasList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Etapa[] }>('/etapas');
      return data.data;
    },
    // Etapas mudam raramente — cache mais agressivo
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
