// ============================================================
// Forja - Hooks de API para Desenhos
// Aninhados em Artigo: /api/artigos/:artigoId/desenhos
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type TipoDesenho = 'cliente' | 'forma' | 'acompanhamento_dim';

export const LABELS_TIPO_DESENHO: Record<TipoDesenho, string> = {
  cliente: 'Desenho do Cliente',
  forma: 'Desenho da Forma',
  acompanhamento_dim: 'Acompanhamento Dimensional',
};

export interface Desenho {
  id: string;
  artigoId: string;
  tipo: TipoDesenho;
  codigoDesenho: string;
  revisao: string;
  dataRevisao: string | null;
  arquivoKey: string | null;
  arquivoTipo: string | null;
  arquivoTamanho: number | null;
  arquivoNomeOriginal: string | null;

  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarDesenhoInput {
  tipo: TipoDesenho;
  codigoDesenho: string;
  revisao: string;
  dataRevisao?: string;
  observacoes?: string | null;
}

export interface AtualizarDesenhoInput {
  tipo?: TipoDesenho;
  codigoDesenho?: string;
  revisao?: string;
  dataRevisao?: string;
  observacoes?: string | null;
}

const queryKey = (artigoId: string) => ['desenhos', artigoId] as const;

// ---------------- LISTA ----------------
export function useDesenhosList(artigoId: string | null) {
  return useQuery({
    queryKey: queryKey(artigoId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: Desenho[] }>(
        `/artigos/${artigoId}/desenhos`
      );
      return data.data;
    },
    enabled: !!artigoId,
  });
}

// ---------------- CRIAR ----------------
export function useCreateDesenho(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarDesenhoInput) => {
      const { data } = await api.post<{ data: Desenho }>(
        `/artigos/${artigoId}/desenhos`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- ATUALIZAR (PATCH) ----------------
export function useUpdateDesenho(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: AtualizarDesenhoInput;
    }) => {
      const { data } = await api.patch<{ data: Desenho }>(
        `/artigos/${artigoId}/desenhos/${id}`,
        input
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- DELETAR ----------------
export function useDeleteDesenho(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/artigos/${artigoId}/desenhos/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- UPLOAD DE ARQUIVO (multipart) ----------------
export function useUploadDesenhoArquivo(artigoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, arquivo }: { id: string; arquivo: File }) => {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const { data } = await api.post<{ data: Desenho }>(
        `/artigos/${artigoId}/desenhos/${id}/arquivo`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // 1 minuto pra upload
        }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(artigoId) });
    },
  });
}

// ---------------- URL ASSINADA PRA DOWNLOAD/VISUALIZAÇÃO ----------------
// Não usa useQuery porque é "on-demand" — só pega quando o usuário pede
export async function obterUrlDesenho(
  artigoId: string,
  id: string
): Promise<string> {
  const { data } = await api.get<{ data: { url: string } }>(
    `/artigos/${artigoId}/desenhos/${id}/url`
  );
  return data.data.url;
}
