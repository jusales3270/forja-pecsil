// ============================================================
// Forja - Avisos internos (canal dashboard)
// Alertas que ficam dentro da aplicação — não saem por WhatsApp.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AvisoOpLote {
  id: string;
  codigoOp: string;
  tipoServico: string;
  status: string;
  quantidadeConcluida: number;
  etapa: { id: string; nome: string };
  etapaAvisada: { id: string; nome: string } | null;
  lote: {
    numeroLote: number;
    quantidadePecas: number;
    os: {
      id: string;
      codigoGrv: string;
      artigo: { codigo: string; descricao: string };
    };
  };
}

export interface Aviso {
  id: string;
  tipo: string;
  severidade: 'info' | 'warning' | 'critico';
  mensagem: string;
  criadoEm: string;
  visualizadoEm: string | null;
  opLote: AvisoOpLote | null;
}

const QUERY_KEY = ['avisos'] as const;

/**
 * Avisos da estação aberta + os endereçados à pessoa logada.
 * O aviso do tratamento térmico é da ESTAÇÃO engenharia: quem abrir aquele
 * tótem vê, não importa quem está logado.
 */
export function useAvisos(etapaId?: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEY, etapaId ?? null],
    queryFn: async () => {
      const { data } = await api.get<{ data: Aviso[] }>('/avisos', {
        params: etapaId ? { etapaId } : undefined,
      });
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useMarcarAvisoLido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/avisos/${id}/lido`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useMarcarTodosLidos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapaId?: string | null) => {
      await api.post('/avisos/marcar-lidos', etapaId ? { etapaId } : {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** "há 5min" / "há 2h" */
export function tempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}
