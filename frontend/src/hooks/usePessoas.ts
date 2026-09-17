// ============================================================
// Forja - Hooks de Pessoas e contas de estação
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModuloAcesso, Papel } from '@forja/shared';
import { api } from '../lib/api';

export interface Pessoa {
  id: string;
  nome: string;
  codigoPessoal: string;
  papel: Papel;
  ativo: boolean;
  /** Estação que a conta opera. Nulo = sem vínculo. */
  etapaId: string | null;
  etapa?: { id: string; nome: string } | null;
  /** Módulos liberados. Nulo = padrão do papel. */
  acessos: ModuloAcesso[] | null;
}

export interface CriarPessoaInput {
  nome: string;
  codigoPessoal: string;
  pin: string;
  papel: Papel;
  etapaId?: string | null;
  ativo?: boolean;
  /** Nulo = padrão do papel. Só o admin altera. */
  acessos?: ModuloAcesso[] | null;
}

export interface AtualizarPessoaInput {
  nome?: string;
  codigoPessoal?: string;
  /** Vazio ou ausente = mantém o PIN atual. */
  pin?: string | null;
  papel?: Papel;
  etapaId?: string | null;
  ativo?: boolean;
  /** Nulo = padrão do papel. Só o admin altera. */
  acessos?: ModuloAcesso[] | null;
}

export interface ListaPessoasFiltros {
  papel?: Papel;
  ativo?: boolean;
}

// Mantém o envelope { data } e a queryKey originais: o modal de iniciar OP já
// consome assim, e mudar isso aqui só criaria trabalho sem ganho.
const QUERY_KEY = ['pessoas-list'] as const;

export function usePessoasList(filtros?: ListaPessoasFiltros) {
  return useQuery<{ data: Pessoa[] }>({
    queryKey: [...QUERY_KEY, filtros],
    queryFn: async () => {
      const { data } = await api.get<{ data: Pessoa[] }>('/pessoas', {
        params: filtros,
      });
      return data;
    },
  });
}

export function useCriarPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarPessoaInput) => {
      const { data } = await api.post<{ data: Pessoa }>('/pessoas', input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AtualizarPessoaInput }) => {
      const { data } = await api.put<{ data: Pessoa }>(`/pessoas/${id}`, input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesativarPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pessoas/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hard = true }: { id: string; hard?: boolean }) => {
      const res = await api.delete<{ data: any; message?: string }>(`/pessoas/${id}`, {
        params: hard ? { hard: 'true' } : undefined,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
