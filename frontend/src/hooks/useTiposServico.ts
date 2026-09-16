// ============================================================
// Forja - Hooks de API para Tipos de Serviço
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface TipoServico {
  id: string;
  codigo: number | null;
  nome: string;
  etapaId: string;
  /** Posição dentro da etapa. Nulo = etapa de processo único. */
  ordemNaEtapa: number | null;
  exigeInspecao: boolean;
  ativo: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  etapa?: { id: string; nome: string };
}

export interface CriarTipoServicoInput {
  codigo?: number | null;
  nome: string;
  etapaId: string;
  ordemNaEtapa?: number | null;
  exigeInspecao?: boolean;
  observacoes?: string;
}

export interface AtualizarTipoServicoInput {
  codigo?: number | null;
  nome?: string;
  etapaId?: string;
  ordemNaEtapa?: number | null;
  exigeInspecao?: boolean;
  ativo?: boolean;
  observacoes?: string | null;
  /** Ao trocar a estação: leva junto operações dos artigos e OPs não iniciadas. */
  propagarEtapa?: boolean;
}

export interface ResultadoAtualizacaoTipo {
  data: TipoServico;
  meta: { operacoesArtigoMovidas: number; opsLoteMovidas: number };
}

const QUERY_KEY = ['tipos-servico'] as const;

// ---------------- LISTA ----------------
export function useTiposServicoList(params?: { ativo?: boolean; q?: string }) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get<{ data: TipoServico[] }>('/tipos-servico', {
        params,
      });
      return data.data;
    },
  });
}

// ---------------- CRIAR ----------------
export function useCreateTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarTipoServicoInput) => {
      const { data } = await api.post<{ data: TipoServico }>(
        '/tipos-servico',
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdateTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarTipoServicoInput;
    }) => {
      const { data } = await api.put<ResultadoAtualizacaoTipo>(
        `/tipos-servico/${id}`,
        input
      );
      return data;
    },
    onSuccess: (resultado) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      if (resultado.meta?.opsLoteMovidas || resultado.meta?.operacoesArtigoMovidas) {
        qc.invalidateQueries({ queryKey: ['artigos'] });
        qc.invalidateQueries({ queryKey: ['operacoes'] });
      }
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteTipoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tipos-servico/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
