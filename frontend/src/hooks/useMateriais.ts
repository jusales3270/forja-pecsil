// ============================================================
// Forja - Hooks da lista de materiais do Artigo (Sprint 6c, Bloco A)
// O catálogo vem do Almoxarifado do Business OS (código do GRV).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface MaterialCatalogo {
  codigo: string;
  descricao: string;
  unidade: string;
  familia: string | null;
  grupo: string | null;
}

export interface MaterialArtigo {
  id: string;
  artigoId: string;
  materialCodigo: string | null;
  descricao: string;
  /** Por peça (Decimal vem como string da API). */
  quantidade: string;
  unidade: string;
  observacoes: string | null;
  ordem: number;
}

export interface MaterialArtigoInput {
  materialCodigo?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  observacoes?: string | null;
}

export function useBuscaCatalogo(busca: string) {
  const termo = busca.trim();
  return useQuery<MaterialCatalogo[]>({
    queryKey: ['materiais-catalogo', termo],
    queryFn: async () => (await api.get(`/materiais-catalogo?busca=${encodeURIComponent(termo)}`)).data.data,
    enabled: termo.length >= 2,
    staleTime: 60_000,
  });
}

export function useMateriaisArtigo(artigoId: string) {
  return useQuery<MaterialArtigo[]>({
    queryKey: ['materiais-artigo', artigoId],
    queryFn: async () => (await api.get(`/artigos/${artigoId}/materiais`)).data.data,
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>, artigoId: string) {
  qc.invalidateQueries({ queryKey: ['materiais-artigo', artigoId] });
  qc.invalidateQueries({ queryKey: ['artigos'] });
  qc.invalidateQueries({ queryKey: ['os-detail'] });
}

export function useIncluirMaterial(artigoId: string) {
  const qc = useQueryClient();
  return useMutation<MaterialArtigo, any, MaterialArtigoInput>({
    mutationFn: async (input) => (await api.post(`/artigos/${artigoId}/materiais`, input)).data.data,
    onSuccess: () => invalidar(qc, artigoId),
  });
}

export function useAlterarMaterial(artigoId: string) {
  const qc = useQueryClient();
  return useMutation<MaterialArtigo, any, { id: string } & Partial<MaterialArtigoInput>>({
    mutationFn: async ({ id, ...input }) => (await api.put(`/artigos/${artigoId}/materiais/${id}`, input)).data.data,
    onSuccess: () => invalidar(qc, artigoId),
  });
}

export function useRetirarMaterial(artigoId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, any, string>({
    mutationFn: async (id) => (await api.delete(`/artigos/${artigoId}/materiais/${id}`)).data,
    onSuccess: () => invalidar(qc, artigoId),
  });
}

/** "4" · "0,25" · "1.234,5" → número (aceita vírgula). */
export function lerQuantidade(texto: string): number {
  const t = texto.trim();
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
}

export const formatarQuantidade = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
