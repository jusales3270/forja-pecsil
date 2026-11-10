// ============================================================
// Forja - Metalização interna ou externa, decidida no Desbaste
// ============================================================
// Quem sabe se o lote vai para o fornecedor (o alemão) é o Desbaste, não a
// Metalização. Por isso a escolha é feita ao iniciar a operação da estação
// imediatamente anterior à Metalização no roteiro do lote.
//
//   Externa → a OP de Metalização fica bloqueada (nunca entra na fila da
//             Metalização) e aparece congelada na estação seguinte (Encaixe e
//             Arredondamento). Só o responsável dessa estação libera, ao
//             confirmar que o lote voltou.
//   Interna → nada muda: a Metalização produz normalmente.
//
// Sem migration: "externa" é a OP de Metalização com envioExternoEm; "interna"
// é um evento na timeline (acao metalizacao_interna_indicada) ou a OP já ter
// começado. envioExternoEm é regravado quando o lote inteiro sai do Desbaste,
// que é quando as peças realmente vão para o fornecedor.
// ============================================================

import type { Prisma } from '@prisma/client';
import { isMetalizacao } from '@forja/shared';

export type ModoMetalizacao = 'interno' | 'externo';

export interface OpDoLote {
  id: string;
  ordem: number;
  codigoOp: string;
  etapaId: string;
  etapaNome: string;
  status: string;
  quantidadeConcluida: number;
  envioExternoEm: Date | null;
  recebimentoExternoEm: Date | null;
}

export const ACAO_INTERNA = 'metalizacao_interna_indicada';
export const ACAO_EXTERNA = 'metalizacao_externa_indicada';

function ordenar<T extends { ordem: number; codigoOp: string; id: string }>(ops: T[]): T[] {
  return [...ops].sort((a, b) => a.ordem - b.ordem || a.codigoOp.localeCompare(b.codigoOp) || a.id.localeCompare(b.id));
}

/**
 * A OP de Metalização cuja escolha cabe à OP informada: a operação logo antes
 * da Metalização é da mesma estação que ela (o Desbaste). Nulo quando a OP não
 * antecede uma Metalização.
 */
export function metalizacaoDecididaPor<T extends OpDoLote>(ops: T[], opId: string): T | null {
  const o = ordenar(ops);
  const i = o.findIndex((x) => x.id === opId);
  if (i < 0) return null;
  for (let j = i + 1; j < o.length; j++) {
    if (isMetalizacao(o[j].etapaNome)) {
      return o[j - 1].etapaId === o[i].etapaId ? o[j] : null;
    }
  }
  return null;
}

/** A operação que vem depois (a estação que recebe o lote de volta). */
export function operacaoSeguinte<T extends OpDoLote>(ops: T[], opId: string): T | null {
  const o = ordenar(ops);
  const i = o.findIndex((x) => x.id === opId);
  return i >= 0 && i + 1 < o.length ? o[i + 1] : null;
}

/** Operações antes da informada (o que precisa terminar para o lote sair). */
export function operacoesAnteriores<T extends OpDoLote>(ops: T[], opId: string): T[] {
  const o = ordenar(ops);
  const i = o.findIndex((x) => x.id === opId);
  return i > 0 ? o.slice(0, i) : [];
}

export function modoAtual(metal: OpDoLote, indicouInterna: boolean): ModoMetalizacao | null {
  if (metal.envioExternoEm) return 'externo';
  if (indicouInterna || metal.status !== 'na_fila' || metal.quantidadeConcluida > 0) return 'interno';
  return null;
}

/** Ainda dá para trocar a escolha: a Metalização não começou nem voltou. */
export function podeAlterar(metal: OpDoLote): boolean {
  if (metal.recebimentoExternoEm || metal.quantidadeConcluida > 0) return false;
  return metal.status === 'na_fila' || (metal.status === 'bloqueada' && !!metal.envioExternoEm);
}

/** O lote inteiro já saiu das operações anteriores (foi para o fornecedor). */
export function loteSaiu(ops: OpDoLote[], metalId: string, quantidadeLote: number): boolean {
  return operacoesAnteriores(ops, metalId).every((o) => o.quantidadeConcluida >= quantidadeLote);
}

/** Ids das OPs de Metalização em que alguém indicou "interna". */
export async function metalizacoesIndicadasInternas(
  db: Prisma.TransactionClient | { eventoOS: Prisma.TransactionClient['eventoOS'] },
  loteIds: string[],
): Promise<Set<string>> {
  if (loteIds.length === 0) return new Set();
  const eventos = await db.eventoOS.findMany({
    where: { loteId: { in: loteIds }, payload: { path: ['acao'], equals: ACAO_INTERNA } },
    select: { payload: true },
  });
  return new Set(eventos.map((e) => (e.payload as any)?.opLoteId).filter(Boolean));
}

/** Carrega as OPs do lote no formato usado aqui. */
export async function carregarOpsDoLote(tx: Prisma.TransactionClient, loteId: string): Promise<OpDoLote[]> {
  const ops = await tx.oPLote.findMany({
    where: { loteId },
    select: {
      id: true, ordem: true, codigoOp: true, etapaId: true, status: true, quantidadeConcluida: true,
      envioExternoEm: true, recebimentoExternoEm: true, etapa: { select: { nome: true } },
    },
  });
  return ops.map(({ etapa, ...o }) => ({ ...o, etapaNome: etapa.nome }));
}

/**
 * Grava a escolha feita no Desbaste. Idempotente: repetir a mesma escolha não
 * faz nada. Trocar só vale enquanto a Metalização não começou.
 * Devolve o modo final e se mudou algo.
 */
export async function aplicarEscolha(
  tx: Prisma.TransactionClient,
  params: {
    metalId: string;
    modo: ModoMetalizacao;
    fornecedor?: string | null;
    autorId: string;
    osId: string;
    loteId: string;
    quantidadeLote: number;
  },
): Promise<{ modo: ModoMetalizacao; mudou: boolean }> {
  await tx.$queryRaw`SELECT id FROM ops_lote WHERE id = ${params.metalId} FOR UPDATE`;
  const ops = await carregarOpsDoLote(tx, params.loteId);
  const metal = ops.find((o) => o.id === params.metalId);
  if (!metal) throw Object.assign(new Error('OP de metalização não encontrada.'), { statusCode: 404 });
  const internas = await metalizacoesIndicadasInternas(tx, [params.loteId]);
  const atual = modoAtual(metal, internas.has(metal.id));
  if (atual === params.modo) return { modo: atual, mudou: false };
  if (!podeAlterar(metal)) {
    throw Object.assign(
      new Error('A metalização deste lote já começou ou já voltou. Não dá mais para trocar entre interna e externa.'),
      { statusCode: 409 },
    );
  }

  const meta = await tx.oPLote.findUniqueOrThrow({ where: { id: metal.id }, select: { codigoOp: true, tipoServico: true, fornecedor: true } });
  if (params.modo === 'externo') {
    await tx.oPLote.update({
      where: { id: metal.id },
      data: {
        status: 'bloqueada',
        envioExternoEm: new Date(),
        quantidadeEnvioExterno: params.quantidadeLote,
        fornecedor: params.fornecedor || meta.fornecedor,
      },
    });
  } else {
    await tx.oPLote.update({
      where: { id: metal.id },
      data: { status: 'na_fila', envioExternoEm: null, quantidadeEnvioExterno: null },
    });
  }
  await tx.eventoOS.create({
    data: {
      osId: params.osId,
      loteId: params.loteId,
      tipo: 'observacao_livre',
      autorId: params.autorId,
      payload: {
        acao: params.modo === 'externo' ? ACAO_EXTERNA : ACAO_INTERNA,
        opLoteId: metal.id,
        codigoOp: meta.codigoOp,
        tipoServico: meta.tipoServico,
        quantidade: params.quantidadeLote,
        fornecedor: params.modo === 'externo' ? params.fornecedor || meta.fornecedor : undefined,
        trocou: atual !== null,
      },
    },
  });
  return { modo: params.modo, mudou: true };
}

/**
 * Chamada quando uma OP fecha o lote inteiro. Se a operação seguinte é uma
 * Metalização marcada como externa, é agora que o lote vai para o fornecedor:
 * regrava envioExternoEm com a hora real da saída e registra na timeline.
 * Devolve a estação que vai receber o lote de volta (para atualizar a tela).
 */
export async function registrarSaidaExterna(
  tx: Prisma.TransactionClient,
  opLoteId: string,
  autorId: string,
): Promise<{ metalId: string; etapaRetornoId: string | null } | null> {
  const op = await tx.oPLote.findUnique({
    where: { id: opLoteId },
    select: { loteId: true, lote: { select: { quantidadePecas: true, osId: true } } },
  });
  if (!op) return null;
  const ops = await carregarOpsDoLote(tx, op.loteId);
  const metal = operacaoSeguinte(ops, opLoteId);
  if (!metal || !isMetalizacao(metal.etapaNome) || !metal.envioExternoEm || metal.recebimentoExternoEm) return null;
  if (!loteSaiu(ops, metal.id, op.lote.quantidadePecas)) return null;

  const agora = new Date();
  const dados = await tx.oPLote.update({
    where: { id: metal.id },
    data: { envioExternoEm: agora },
    select: { codigoOp: true, tipoServico: true, fornecedor: true, quantidadeEnvioExterno: true, exigeInspecao: true },
  });
  await tx.eventoOS.create({
    data: {
      osId: op.lote.osId,
      loteId: op.loteId,
      tipo: 'op_lote_iniciada',
      autorId,
      payload: {
        acao: 'metalizacao_envio_externo',
        opLoteId: metal.id,
        codigoOp: dados.codigoOp,
        tipoServico: dados.tipoServico,
        quantidadeConcluida: 0,
        quantidadeEnviada: dados.quantidadeEnvioExterno,
        quantidadeTotal: op.lote.quantidadePecas,
        exigeInspecao: dados.exigeInspecao,
        fornecedor: dados.fornecedor,
      },
    },
  });
  return { metalId: metal.id, etapaRetornoId: operacaoSeguinte(ops, metal.id)?.etapaId ?? null };
}
