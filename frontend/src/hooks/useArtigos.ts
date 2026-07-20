// ============================================================
// Forja - Hooks de API para Artigos
// Artigo é a "peça reutilizável" central do sistema
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type TipoProduto =
  | 'forma'
  | 'bloco'
  | 'fundo_forma'
  | 'fundo_bloco'
  | 'molde'
  | 'arruela'
  | 'cabeca_sopro'
  | 'forminha'
  | 'puncao'
  | 'funil';

export type StatusArtigo = 'rascunho' | 'ativo' | 'arquivado';

export interface Artigo {
  id: string;
  codigo: string;
  descricao: string;
  tipoProduto: TipoProduto;
  clienteId: string;
  material: string | null;
  poPadrao: string | null;
  observacoes: string | null;
  status: StatusArtigo;
  ativo: boolean;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
  cliente?: { id: string; nome: string };
  criadoPor?: { id: string; nome: string };
  _count?: { desenhos: number; operacoes: number };
}

export interface CriarArtigoInput {
  codigo: string;
  descricao: string;
  tipoProduto: TipoProduto;
  clienteId?: string;
  clienteNome?: string;
  material?: string | null;
  poPadrao?: string | null;
  observacoes?: string | null;
}

export interface AtualizarArtigoInput {
  codigo?: string;
  descricao?: string;
  tipoProduto?: TipoProduto;
  clienteId?: string;
  material?: string | null;
  poPadrao?: string | null;
  observacoes?: string | null;
}

export interface ListaArtigosFiltros {
  clienteId?: string;
  tipoProduto?: TipoProduto;
  status?: StatusArtigo;
  ativo?: boolean;
  busca?: string;
}

const QUERY_KEY = ['artigos'] as const;

// ---------------- LISTA ----------------
export function useArtigosList(filtros?: ListaArtigosFiltros) {
  return useQuery({
    queryKey: [...QUERY_KEY, filtros ?? {}],
    queryFn: async () => {
      const { data } = await api.get<{ data: Artigo[] }>('/artigos', {
        params: filtros,
      });
      return data.data;
    },
  });
}

// ---------------- BUSCAR POR ID ----------------
export function useArtigoDetail(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Artigo }>(`/artigos/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---------------- CRIAR ----------------
export function useCreateArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarArtigoInput) => {
      const { data } = await api.post<{ data: Artigo }>('/artigos', input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ---------------- ATUALIZAR ----------------
export function useUpdateArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarArtigoInput;
    }) => {
      const { data } = await api.put<{ data: Artigo }>(
        `/artigos/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, 'detail', vars.id] });
    },
  });
}

// ---------------- DESATIVAR (soft delete) ----------------
export function useDeleteArtigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/artigos/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// ============================================================
// Transições de Status
// rascunho -> ativo (precisa ter ao menos 1 OP)
// ativo -> arquivado
// arquivado -> ativo (desarquivar)
// ativo -> rascunho (voltar pra rascunho)
// ============================================================

function useStatusTransition(action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ data: Artigo }>(
        `/artigos/${id}/${action}`
      );
      return data.data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, 'detail', id] });
    },
  });
}

export const useAtivarArtigo = () => useStatusTransition('ativar');
export const useArquivarArtigo = () => useStatusTransition('arquivar');
export const useDesarquivarArtigo = () => useStatusTransition('desarquivar');
export const useVoltarRascunhoArtigo = () =>
  useStatusTransition('voltar-rascunho');
