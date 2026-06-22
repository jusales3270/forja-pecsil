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

export interface KanbanCard {
  opLoteId: string;
  codigoOp: string;
  codigoGrv: string;
  numeroLote: number;
  cliente: string;
  artigo: string;
  status: string;
  prioridade: string;
  diasAtePrazo: number;
  semaforo: 'verde' | 'amarelo' | 'vermelho';
}

export interface KanbanEtapa {
  etapaId: string;
  nome: string;
  ordemPadrao: number;
  total: number;
  cards: KanbanCard[];
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
