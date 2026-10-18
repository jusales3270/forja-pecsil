// ============================================================
// Forja - Aplicar um roteiro padrão em artigos
// ============================================================
// Usado pela aplicação em um artigo (operacoes-artigo.ts) e pela aplicação
// em massa por tipo de peça (roteiros-padrao.ts). O modelo é resolvido contra
// o catálogo de Tipos de Serviço: cada tipo carrega a etapa, e é dela que a OP
// herda o destino no tótem.
// ============================================================

import type { Prisma, TipoServico } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { PASSO_SEQUENCIA, type RoteiroPadrao } from '../data/roteiros-padrao.js';

export function codigosDoRoteiro(roteiro: RoteiroPadrao): number[] {
  return [
    ...new Set(
      roteiro.operacoes.flatMap((o) =>
        [o.codigoTipoServico, o.avisaEtapaDoCodigoTipoServico].filter((c): c is number => c != null),
      ),
    ),
  ];
}

/** Tipos de Serviço do roteiro, por código, e os códigos que não estão no catálogo. */
export async function resolverTipos(roteiro: RoteiroPadrao) {
  const codigos = codigosDoRoteiro(roteiro);
  const tipos = await prisma.tipoServico.findMany({ where: { codigo: { in: codigos }, ativo: true } });
  const porCodigo = new Map(tipos.map((t) => [t.codigo!, t]));
  return { porCodigo, faltando: codigos.filter((c) => !porCodigo.has(c)) };
}

/** As operações do roteiro prontas para gravar num artigo (sequência 10, 20, 30…). */
export function operacoesDoRoteiro(
  artigoId: string,
  roteiro: RoteiroPadrao,
  porCodigo: Map<number, TipoServico>,
): Prisma.OperacaoArtigoCreateManyInput[] {
  return roteiro.operacoes.map((op, idx) => {
    const tipo = porCodigo.get(op.codigoTipoServico)!;
    return {
      artigoId,
      etapaId: tipo.etapaId,
      tipoServicoId: tipo.id,
      codigoOp: String((idx + 1) * PASSO_SEQUENCIA),
      ordem: idx,
      tipoServico: tipo.nome,
      tempoUnitMin: op.tempoUnitMin,
      tempoSetupMin: op.tempoSetupMin,
      exigeInspecao: op.exigeInspecao,
      gatilhoAlertaPecas: op.gatilhoAlertaPecas ?? null,
      avisaAoIniciar: op.avisaAoIniciar ?? false,
      terceirizada: op.terceirizada ?? false,
      fornecedor: op.fornecedor ?? null,
      prazoPrevistoDias: op.prazoPrevistoDias ?? null,
      esperaHoras: op.esperaHoras ?? null,
      exigeLoteCompleto: op.exigeLoteCompleto ?? false,
      etapaAvisadaId:
        op.avisaEtapaDoCodigoTipoServico != null
          ? (porCodigo.get(op.avisaEtapaDoCodigoTipoServico)?.etapaId ?? null)
          : null,
      observacoes: op.observacoes,
    };
  });
}

/** Artigos ativos (não arquivados) do filtro que ainda não têm nenhuma operação no roteiro. */
export function filtroSemRoteiro(f: { tipoProduto: string; clienteId?: string | null }): Prisma.ArtigoWhereInput {
  return {
    ativo: true,
    status: { not: 'arquivado' },
    tipoProduto: f.tipoProduto as Prisma.ArtigoWhereInput['tipoProduto'],
    ...(f.clienteId ? { clienteId: f.clienteId } : {}),
    operacoes: { none: {} },
  };
}
