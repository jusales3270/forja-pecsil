// ============================================================
// Forja - Hooks de Conferencia de Turno (Sprint 4 - Bloco B)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface LinhaTurno {
  maquinaId: string;
  maquinaNome: string;
  contadoSistema: number;
  ajustado: number;
  justificativa?: string | null;
}

export interface PreviaTurno {
  referencia: string;
  jaFechado: boolean;
  linhas: { maquinaId: string; maquinaNome: string; contadoSistema: number }[];
  totalSistema: number;
}

export function usePreviaTurno() {
  return useQuery<{ data: PreviaTurno }>({
    queryKey: ['conferencia-turno-previa'],
    queryFn: async () => {
      const res = await api.get('/conferencia-turno/previa');
      return res.data;
    },
  });
}

export function useFecharTurno() {
  const qc = useQueryClient();
  return useMutation<
    { data: unknown },
    Error,
    { linhas: LinhaTurno[]; observacoes?: string | null }
  >({
    mutationFn: async (input) => {
      const res = await api.post('/conferencia-turno/fechar', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conferencia-turno-previa'] });
      qc.invalidateQueries({ queryKey: ['lotes-fantasmas'] });
    },
  });
}
