// ============================================================
// Forja - Hooks de Apontamento Peca a Peca (Sprint 4 - Bloco A)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ApontamentoPeca {
  id: string;
  opLoteId: string;
  maquinaId: string;
  operadorId: string;
  numeroPeca: number;
  observacoes: string | null;
  criadoEm: string;
  maquina?: { id: string; nome: string };
  operador?: { id: string; nome: string };
}

export interface ContagemPorMaquina {
  maquinaId: string;
  _count: { _all: number };
}

export interface ApontamentoPecaResumo {
  total: number;
  pecas: ApontamentoPeca[];
  porMaquina: ContagemPorMaquina[];
}

export function useApontamentosPeca(opLoteId: string | null) {
  return useQuery<{ data: ApontamentoPecaResumo }>({
    queryKey: ['apontamento-peca', opLoteId],
    queryFn: async () => {
      const res = await api.get(`/apontamento-peca/${opLoteId}`);
      return res.data;
    },
    enabled: !!opLoteId,
  });
}

export function useRegistrarPeca() {
  const qc = useQueryClient();
  return useMutation<
    { data: ApontamentoPeca },
    Error,
    { opLoteId: string; maquinaId: string; observacoes?: string | null }
  >({
    mutationFn: async (input) => {
      const res = await api.post('/apontamento-peca', input);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['apontamento-peca', vars.opLoteId] });
    },
  });
}

export function useDesfazerPeca() {
  const qc = useQueryClient();
  return useMutation<
    { data: { desfeito: boolean; apontamentoId: string } },
    Error,
    { opLoteId: string; maquinaId: string }
  >({
    mutationFn: async (input) => {
      const res = await api.delete('/apontamento-peca/ultima', { data: input });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['apontamento-peca', vars.opLoteId] });
    },
  });
}
