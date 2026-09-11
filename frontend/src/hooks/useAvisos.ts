// ============================================================
// Forja - Avisos internos (canal dashboard)
// Alertas que ficam dentro da aplicação — não saem por WhatsApp.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-store';

import type { Desenho } from './useDesenhos';

export interface ProximaOperacao {
  id: string;
  codigoOp: string;
  tipoServico: string;
  status: string;
  terceirizada: boolean;
  esperaHoras: number | null;
  observacoes: string | null;
  etapa: { id: string; nome: string };
}

export interface AvisoOpLote {
  id: string;
  codigoOp: string;
  ordem: number;
  tipoServico: string;
  status: string;
  quantidadeConcluida: number;
  observacoes: string | null;
  esperaHoras: number | null;
  terceirizada: boolean;
  /** Quando a operação começou — o relógio do ciclo do forno. */
  iniciadaEm: string | null;
  /** Peças que chegaram nesta operação (não o lote inteiro). */
  pecasNaOperacao: number;
  /** O que vem depois: é o programa que a engenharia precisa montar. */
  proximasOperacoes: ProximaOperacao[];
  etapa: { id: string; nome: string };
  etapaAvisada: { id: string; nome: string } | null;
  lote: {
    id: string;
    numeroLote: number;
    quantidadePecas: number;
    observacoes: string | null;
    os: {
      id: string;
      codigoGrv: string;
      prazoEntrega: string;
      prioridade: 'normal' | 'urgente';
      quantidadeTotal: number;
      observacoes: string | null;
      cliente: { id: string; nome: string };
      artigo: {
        id: string;
        codigo: string;
        descricao: string;
        tipoProduto: string;
        material: string | null;
        observacoes: string | null;
        desenhos: Desenho[];
      };
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
 * Avisos da estação da conta + os endereçados à pessoa logada.
 * O cache é separado por conta, vínculo e sessão para não reaproveitar avisos
 * privados ao trocar de credencial no mesmo navegador.
 */
export function useAvisos(etapaId?: string | null) {
  const { pessoa, token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, pessoa?.id, pessoa?.etapaId ?? null, token, etapaId ?? null],
    enabled: isAuthenticated && !!pessoa && (!etapaId || etapaId === pessoa.etapaId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: Aviso[] }>('/avisos', {
        signal,
        headers: { Authorization: `Bearer ${token}` },
        params: etapaId ? { etapaId } : undefined,
      });
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useMarcarAvisoLido() {
  const { pessoa, token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/avisos/${id}/lido`, {}, { headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, pessoa?.id, pessoa?.etapaId ?? null, token] }),
  });
}

export function useMarcarTodosLidos() {
  const { pessoa, token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapaId?: string | null) => {
      await api.post('/avisos/marcar-lidos', etapaId ? { etapaId } : {}, { headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, pessoa?.id, pessoa?.etapaId ?? null, token] }),
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
