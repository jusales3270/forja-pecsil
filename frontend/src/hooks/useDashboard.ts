// ============================================================
// Forja - Hook do Dashboard do Chefe (Sprint 6)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { PipelineEtapa } from './usePipelineEtapa';

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
  osId: string;
  externo: boolean;
  fornecedor: string | null;
  quantidade: number;
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
  operador: string | null;
  programador: string | null;
  maquina: string | null;
  /** Operação anterior do roteiro do lote (null = primeira). */
  veioDe: VizinhoRoteiro | null;
  /** Operação seguinte do roteiro do lote (null = última). */
  proxima: VizinhoRoteiro | null;
}

export interface VizinhoRoteiro {
  estacao: string;
  tipoServico: string;
}

export type EstadoPasso = 'concluido' | 'atual' | 'externo' | 'futuro';

export interface PassoRoteiro {
  opLoteId: string;
  codigoOp: string;
  tipoServico: string;
  estacao: string;
  etapaId: string;
  status: string;
  estado: EstadoPasso;
  concluidas: number;
  disponiveis: number;
}

export interface RoteiroOS {
  osId: string;
  codigoGrv: string;
  cliente: string;
  artigo: string;
  descricao: string;
  prioridade: string;
  prazoEntrega: string;
  diasAtePrazo: number;
  semaforo: 'verde' | 'amarelo' | 'vermelho';
  lotes: { loteId: string; numeroLote: number; quantidadePecas: number; passos: PassoRoteiro[] }[];
}

export interface KanbanEtapa {
  etapaId: string;
  nome: string;
  ordemPadrao: number;
  total: number;
  cards: KanbanCard[];
}

export interface OSResumo {
  id: string;
  codigoGrv: string;
  prazoEntrega: string;
  prioridade: string;
  status: string;
  quantidadeTotal: number;
  cliente: { id: string; nome: string };
  artigo: { codigo: string; descricao: string; tipoProduto: string };
}

export interface EnvioExternoResumo {
  opLoteId: string; osId: string; codigoGrv: string; codigoOp: string; tipoServico: string;
  numeroLote: number; cliente: string; artigo: string; descricao: string; tipoProduto: string;
  fornecedor: string | null; quantidade: number; enviadoEm: string; diasFora: number;
  prazoEntrega: string; diasAtePrazo: number;
}
export interface GrupoAtraso {
  id: string; nome: string; total: number; atrasadas: number; mediaDiasAtraso: number; osIds: string[];
}
export interface Gargalo {
  etapaId: string; nome: string; operacoes: number; pecas: number;
  horasPlanejadas: number; osAtrasadas: number; osIds: string[];
}
export interface Indicadores {
  carteira: { total: number; emDia: number; atrasadas: number; emDiaIds: string[]; atrasadasIds: string[] };
  historico: { dias: number; inicio: string; fim: string; total: number; emDia: number; atrasadas: number;
    pontualidade: number | null; semDataConclusao: number;
    porCliente: GrupoAtraso[]; porTipo: GrupoAtraso[];
    evolucao: { mes: string; emDia: number; atrasadas: number }[];
    os: { id: string; concluidaEm: string; diasAtraso: number }[];
  };
}
export interface DashboardFiltros { clienteId?: string; tipoProduto?: string; dias?: number }

export interface DashboardData {
  clientes: { id: string; nome: string }[];
  indicadores: Indicadores;
  gargalos: Gargalo[];
  enviosExternos: EnvioExternoResumo[];
  totalOSExternas: number;
  geradoEm: string;
  osPorStatus: Record<string, number>;
  osPorStatusLista: Record<string, OSResumo[]>;
  osAtrasadas: OSAtrasada[];
  kanban: KanbanEtapa[];
  /** Caminho de cada OS ativa, na ordem das operações do PCP. */
  roteiros: RoteiroOS[];
  /** Etapas com operações internas (hoje só a fundição), fase a fase. */
  pipelines: PipelineEtapa[];
  inspecao: Record<string, number>;
  paradas: {
    ativas: {
      id: string;
      motivo: string;
      planejado: boolean;
      maquina: string | null;
      codigoOp: string;
      etapa: string;
      codigoGrv: string;
      cliente: string;
      inicio: string;
      minutosParado: number;
    }[];
    porMotivoHoje: Record<string, { minutos: number; ocorrencias: number; planejado: boolean }>;
  };
  fantasmas: {
    opsParadas: { codigoOp: string; codigoGrv: string; etapa: string; horasParado: number }[];
    turnosNaoFechados: { operador: string }[];
  };
}

export function useDashboard(filtros: DashboardFiltros = {}) {
  return useQuery<{ data: DashboardData }>({
    queryKey: ['dashboard', filtros],
    queryFn: async () => {
      const res = await api.get('/dashboard', { params: filtros });
      return res.data;
    },
    refetchInterval: 30_000,
  });
}
