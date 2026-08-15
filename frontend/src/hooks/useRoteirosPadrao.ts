// ============================================================
// Forja - Hooks de API para Roteiros Padrão
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OperacaoRoteiroPadrao {
  codigoOp: string;
  ordem: number;
  codigoTipoServico: number;
  tipoServico: string | null;
  etapa: string | null;
  observacoes: string;
  tempoUnitMin: number;
  tempoSetupMin: number;
  exigeInspecao: boolean;
  naoEncontrado: boolean;
}

export interface RoteiroPadrao {
  id: string;
  nome: string;
  descricao: string;
  origem: string;
  revisaoPendente: boolean;
  totalOperacoes: number;
  tempoTotalUnitMin: number;
  temPendencia: boolean;
  operacoes: OperacaoRoteiroPadrao[];
}

export interface AplicarRoteiroInput {
  roteiroId: string;
  substituir?: boolean;
}

const QUERY_KEY = ['roteiros-padrao'] as const;

export function useRoteirosPadrao() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: RoteiroPadrao[] }>('/roteiros-padrao');
      return data.data;
    },
  });
}

export function useAplicarRoteiro(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AplicarRoteiroInput) => {
      const { data } = await api.post(
        `/artigos/${artigoId}/operacoes/aplicar-roteiro`,
        input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operacoes', artigoId] });
      qc.invalidateQueries({ queryKey: ['artigos', 'detail', artigoId] });
    },
  });
}

/** 212 -> "3h32" / 45 -> "45min" */
export function formatarMinutos(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
