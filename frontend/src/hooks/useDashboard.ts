// ============================================================
// Forja - Hook do Dashboard do Chefe (Sprint 6)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OSAtrasada {
  id: string;
  codigoGrv: string;
  prazoEntrega: string;
  prioridade: string;
  status: string;
  cliente: { nome: string };
  artigo: { codigo: string; descricao: string };
}

export interface KanbanEtapa {
  etapaId: string;
  nome: string;
  ordemPadrao: number;
  total: number;
  porStatus: Record<string, number>;
}

export interface DashboardData {
  geradoEm: string;
  osPorStatus: Record<string, number>;
  osAtrasadas: OSAtrasada[];
  kanban: KanbanEtapa[];
  inspecao: Record<string, number>;
  fantasmas: {
    opsParadas: { codigoOp: string; codigoGrv: string; etapa: string; horasParado: number }[];
    turnosNaoFechados: { operador: string }[];
  };
}

export function useDashboard() {
  return useQuery<{ data: DashboardData }>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}
