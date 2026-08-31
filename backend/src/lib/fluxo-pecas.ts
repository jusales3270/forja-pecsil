// ============================================================
// Forja - Fluxo de peças entre as operações de um lote
// ============================================================
// Um lote não anda inteiro de uma vez. A modelação fecha 3 de 12, essas 3
// seguem pra moldagem e as outras 9 continuam na modelação — o lote está em
// dois lugares ao mesmo tempo, e é assim mesmo no chão de fábrica.
//
// A conta é sempre a mesma: o que uma operação tem disponível é o que a
// anterior liberou, menos o que ela própria já processou. Na primeira
// operação, o que "a anterior liberou" é o tamanho do lote.
//
//   lote de 12    modelação 3/12    moldagem 0/12
//   → modelação tem 12 - 3 = 9 esperando
//   → moldagem  tem  3 - 0 = 3 esperando
//
// Isso responde de uma vez a duas perguntas que a interface precisa fazer:
// onde o lote está agora, e quantas peças estão em cada ponto.
// ============================================================

import { prisma } from '../db/prisma.js';

export interface PecasNaOperacao {
  /** Peças esperando nesta operação: a anterior liberou e esta ainda não fez. */
  disponiveis: number;
  /** Quanto a operação anterior já liberou (o tamanho do lote, na primeira). */
  liberadasPelaAnterior: number;
  /** Tamanho do lote, pra montar "3 de 12". */
  totalDoLote: number;
}

/**
 * Calcula, pra cada OPLote dos lotes informados, quantas peças estão
 * esperando nela agora.
 */
export async function calcularFluxoDePecas(
  loteIds: string[],
): Promise<Map<string, PecasNaOperacao>> {
  const mapa = new Map<string, PecasNaOperacao>();
  if (loteIds.length === 0) return mapa;

  const lotes = await prisma.lote.findMany({
    where: { id: { in: loteIds } },
    select: {
      id: true,
      quantidadePecas: true,
      opsLote: {
        orderBy: { ordem: 'asc' },
        select: { id: true, ordem: true, quantidadeConcluida: true },
      },
    },
  });

  for (const lote of lotes) {
    let liberadas = lote.quantidadePecas;
    for (const op of lote.opsLote) {
      mapa.set(op.id, {
        disponiveis: Math.max(0, liberadas - op.quantidadeConcluida),
        liberadasPelaAnterior: liberadas,
        totalDoLote: lote.quantidadePecas,
      });
      liberadas = op.quantidadeConcluida;
    }
  }

  return mapa;
}
