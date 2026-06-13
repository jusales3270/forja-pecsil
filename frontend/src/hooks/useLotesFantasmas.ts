// ============================================================
// Forja - Hook do Painel de Lotes Fantasmas (Sprint 4 - Bloco D)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface OpParada {
  carimboId: string;
  opLoteId: string;
  codigoOp: string;
  codigoGrv: string;
  cliente: string;
  etapa: string;
  maquina: string | null;
  programador: string | null;
  operador: string | null;
  desde: string;
  horasParado: number;
  quantidadeConcluida: number;
}

export interface MaquinaSemRegistro {
  processamentoId: string;
  opLoteId: string;
  codigoOp: string;
  maquina: string;
  operador: string;
  desde: string;
  horasRodando: number;
}

export interface TurnoNaoFechado {
  operadorId: string;
  operador: string;
  data: string;
}

export interface PainelFantasmas {
  parametros: { horas: number; referenciaTurno: string };
  resumo: {
    opsParadas: number;
    maquinasSemRegistro: number;
    turnosNaoFechados: number;
  };
  opsParadas: OpParada[];
  maquinasSemRegistro: MaquinaSemRegistro[];
  turnosNaoFechados: TurnoNaoFechado[];
}

export function useLotesFantasmas(horas = 4) {
  return useQuery<PainelFantasmas>({
    queryKey: ['lotes-fantasmas', horas],
    queryFn: async () => {
      const res = await api.get(`/lotes-fantasmas?horas=${horas}`);
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
