// ============================================================
// Forja - Hooks de Inspecao Dimensional (Sprint 5)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Cota {
  id: string;
  codigoCota: string;
  valorNominal: number;
  toleranciaMais: number | null;
  toleranciaMenos: number | null;
  caracteristica: string;
  instrumento: string;
  ordem: number;
  observacoes: string | null;
}

export interface Medicao {
  id: string;
  cotaInspecaoId: string;
  numeroPecaInspecionada: number;
  valorMedido: number;
  dentroTolerancia: boolean;
  observacoes: string | null;
  timestamp: string;
  cotaInspecao?: { id: string; codigoCota: string };
}

export interface InspecaoDetalhe {
  id: string;
  opLoteId: string;
  tipo: string;
  resultado: string | null;
  observacoesGerais: string | null;
  timestampIniciada: string | null;
  timestampConcluida: string | null;
  inspetor?: { id: string; nome: string };
  medicoes: Medicao[];
  opLote: any;
}

export function useInspecao(id: string | null) {
  return useQuery<{ data: InspecaoDetalhe }>({
    queryKey: ['inspecao', id],
    queryFn: async () => {
      const res = await api.get(`/inspecoes/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useAbrirInspecao() {
  const qc = useQueryClient();
  return useMutation<
    { data: { id: string } },
    Error,
    { opLoteId: string; tipo: string }
  >({
    mutationFn: async (input) => {
      const res = await api.post('/inspecoes', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspecao'] });
    },
  });
}

export function useRegistrarMedicao(inspecaoId: string) {
  const qc = useQueryClient();
  return useMutation<
    { data: Medicao & { toleranciaOrigem: string } },
    Error,
    { cotaInspecaoId: string; numeroPecaInspecionada: number; valorMedido: number; observacoes?: string | null }
  >({
    mutationFn: async (input) => {
      const res = await api.post(`/inspecoes/${inspecaoId}/medicoes`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspecao', inspecaoId] });
    },
  });
}

export function useConcluirInspecao(inspecaoId: string) {
  const qc = useQueryClient();
  return useMutation<
    { data: InspecaoDetalhe },
    Error,
    { resultado: string; observacoesGerais?: string | null }
  >({
    mutationFn: async (input) => {
      const res = await api.patch(`/inspecoes/${inspecaoId}/concluir`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspecao', inspecaoId] });
    },
  });
}
