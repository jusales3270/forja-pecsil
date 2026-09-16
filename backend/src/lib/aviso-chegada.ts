// ============================================================
// Forja - Aviso de chegada da OS na estação
// ============================================================
// Cada peça tem roteiro próprio: uma OS pode começar na Metalização, ir ao
// Desbaste e voltar à Fundição. Quem diz a ordem são as operações que o PCP
// escolheu, não uma sequência fixa de estações. Por isso a estação é avisada
// quando a OS chega nela, com de onde veio e para onde vai depois.
//
// O aviso é da ESTAÇÃO (etapaDestinoId): as regras de leitura e confirmação
// são as mesmas dos demais avisos (routes/avisos.ts).
// ============================================================

import type { Prisma } from '@prisma/client';

export interface ChegadaAvisada {
  alertaId: string;
  etapaId: string;
}

export async function avisarChegada(
  tx: Prisma.TransactionClient,
  params: {
    opLoteId: string;
    quantidade: number;
    /** Estação/operação de onde as peças vieram. Nulo = OS recém-criada. */
    origem?: string | null;
  },
): Promise<ChegadaAvisada | null> {
  const op = await tx.oPLote.findUnique({
    where: { id: params.opLoteId },
    select: {
      id: true,
      loteId: true,
      ordem: true,
      etapaId: true,
      tipoServico: true,
      lote: {
        select: {
          numeroLote: true,
          os: { select: { codigoGrv: true, artigo: { select: { codigo: true } } } },
        },
      },
    },
  });
  if (!op) return null;

  const proxima = await tx.oPLote.findFirst({
    where: { loteId: op.loteId, ordem: { gt: op.ordem } },
    orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }],
    select: { tipoServico: true, etapa: { select: { nome: true } } },
  });

  const { os, numeroLote } = op.lote;
  const pecas = `${params.quantidade} peça${params.quantidade === 1 ? '' : 's'}`;
  const chegada = params.origem
    ? `${pecas} chegaram de ${params.origem} para ${op.tipoServico}`
    : `nova OS na fila de ${op.tipoServico} com ${pecas}`;
  const depois = proxima
    ? `Depois: ${proxima.etapa.nome} (${proxima.tipoServico}).`
    : 'É a última operação do roteiro.';

  const alerta = await tx.alerta.create({
    data: {
      tipo: 'op_chegou',
      severidade: 'info',
      entidadeTipo: 'OPLote',
      entidadeId: op.id,
      etapaDestinoId: op.etapaId,
      canal: 'dashboard',
      mensagem: `${os.codigoGrv} (${os.artigo.codigo}) — lote ${numeroLote}: ${chegada}. ${depois}`,
    },
    select: { id: true },
  });

  return { alertaId: alerta.id, etapaId: op.etapaId };
}

/**
 * Regra do PCP: a próxima estação só é avisada quando o LOTE INTEIRO sai da
 * operação anterior — não a cada parcial. Chamar depois de gravar a
 * quantidade concluída (encerramento no tótem ou retorno de envio externo).
 * Não avisa duas vezes a mesma operação.
 */
export async function avisarProximaSeLoteCompleto(
  tx: Prisma.TransactionClient,
  opLoteId: string,
): Promise<(ChegadaAvisada & { opLoteId: string }) | null> {
  const op = await tx.oPLote.findUnique({
    where: { id: opLoteId },
    select: {
      loteId: true,
      ordem: true,
      codigoOp: true,
      tipoServico: true,
      quantidadeConcluida: true,
      etapa: { select: { nome: true } },
      lote: { select: { quantidadePecas: true } },
    },
  });
  if (!op || op.quantidadeConcluida < op.lote.quantidadePecas) return null;

  const proxima = await tx.oPLote.findFirst({
    where: { loteId: op.loteId, ordem: { gt: op.ordem } },
    orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }],
    select: { id: true },
  });
  if (!proxima) return null;

  const jaAvisada = await tx.alerta.count({
    where: { tipo: 'op_chegou', entidadeTipo: 'OPLote', entidadeId: proxima.id },
  });
  if (jaAvisada > 0) return null;

  const aviso = await avisarChegada(tx, {
    opLoteId: proxima.id,
    quantidade: op.lote.quantidadePecas,
    origem: `${op.etapa.nome} (${op.tipoServico})`,
  });
  return aviso ? { ...aviso, opLoteId: proxima.id } : null;
}
