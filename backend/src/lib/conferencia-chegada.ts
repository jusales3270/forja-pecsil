// ============================================================
// Forja - Conferência de chegada do lote no Desbaste
// ============================================================
// O lote sai da Fundição valendo 70, mas às vezes chegam 65 no Desbaste. Sem
// conferência ninguém percebia: o Desbaste encerrava 65 como parcial e as 5
// ficavam "pendentes" para sempre, travando o lote sem explicação.
//
// Regra (PCP):
//   - Na primeira vez que a OP de chegada (a primeira do Desbaste no roteiro
//     do lote) é iniciada, quem está no posto conta as peças. Obrigatório.
//   - Se chegou menos, o lote CONTINUA valendo 70: o Desbaste só trabalha as
//     65 conferidas e o lote não fecha. PCP e Fundição são avisados.
//   - Resolve de dois jeitos: as peças aparecem (o Desbaste registra) ou o
//     PCP aceita a falta (o lote passa a valer 65 dali em diante).
//
// Sem migration: tudo fica na timeline da OS (eventos com `acao` abaixo), e
// calcularFluxoDePecas desconta a falta pendente do que a OP de chegada recebe.
// ============================================================

import type { Prisma } from '@prisma/client';
import { isDesbaste } from '@forja/shared';
import { avisarProximaSeLoteCompleto } from './aviso-chegada.js';
import { carregarOpsDoLote, registrarSaidaExterna, type OpDoLote } from './metalizacao-lote.js';

export const ACAO_CONFERENCIA = 'conferencia_chegada';
export const ACAO_COMPLEMENTO = 'conferencia_complemento';
export const ACAO_FALTA_ACEITA = 'falta_aceita';

type Db = Pick<Prisma.TransactionClient, 'eventoOS'>;

export interface Conferencia {
  opLoteId: string;
  /** O que o sistema dizia ter sido liberado para o Desbaste. */
  esperado: number;
  /** O que o operador contou na chegada. */
  contado: number;
  /** Peças que apareceram depois. */
  complementos: number;
  /** Peças que o PCP deu como perdidas. */
  aceitas: number;
  /** Ainda faltando: trava o lote. */
  pendente: number;
  conferidoPor: string | null;
  conferidoEm: Date;
}

function ordenar<T extends { ordem: number; codigoOp: string; id: string }>(ops: T[]): T[] {
  return [...ops].sort((a, b) => a.ordem - b.ordem || a.codigoOp.localeCompare(b.codigoOp) || a.id.localeCompare(b.id));
}

/** A OP onde o lote é conferido: a primeira do Desbaste que vem depois de outra operação. */
export function opDeChegada<T extends OpDoLote>(ops: T[]): T | null {
  const o = ordenar(ops);
  for (let i = 1; i < o.length; i++) if (isDesbaste(o[i].etapaNome)) return o[i];
  return null;
}

/** Conferências dos lotes, por OP de chegada. */
export async function carregarConferencias(db: Db, loteIds: string[]): Promise<Map<string, Conferencia>> {
  const mapa = new Map<string, Conferencia>();
  if (loteIds.length === 0) return mapa;
  const eventos = await db.eventoOS.findMany({
    where: {
      loteId: { in: loteIds },
      OR: [ACAO_CONFERENCIA, ACAO_COMPLEMENTO, ACAO_FALTA_ACEITA].map((acao) => ({ payload: { path: ['acao'], equals: acao } })),
    },
    orderBy: { timestamp: 'asc' },
    select: { payload: true, timestamp: true, autor: { select: { nome: true } } },
  });
  for (const e of eventos) {
    const p = e.payload as any;
    if (!p?.opLoteId) continue;
    if (p.acao === ACAO_CONFERENCIA) {
      if (mapa.has(p.opLoteId)) continue; // vale a primeira
      mapa.set(p.opLoteId, {
        opLoteId: p.opLoteId, esperado: p.esperado, contado: p.contado, complementos: 0, aceitas: 0,
        pendente: 0, conferidoPor: e.autor?.nome ?? null, conferidoEm: e.timestamp,
      });
    } else {
      const c = mapa.get(p.opLoteId);
      if (!c) continue;
      if (p.acao === ACAO_COMPLEMENTO) c.complementos += Number(p.quantidade) || 0;
      else c.aceitas += Number(p.quantidade) || 0;
    }
  }
  for (const c of mapa.values()) c.pendente = Math.max(0, c.esperado - c.contado - c.complementos - c.aceitas);
  return mapa;
}

/** A OP de chegada ainda precisa ser conferida antes de iniciar. */
export function conferenciaExigida(op: { id: string; quantidadeConcluida: number }, chegada: { id: string } | null, conferencias: Map<string, Conferencia>): boolean {
  return !!chegada && chegada.id === op.id && !conferencias.has(op.id) && op.quantidadeConcluida === 0;
}

async function contexto(tx: Prisma.TransactionClient, opLoteId: string) {
  return tx.oPLote.findUniqueOrThrow({
    where: { id: opLoteId },
    select: {
      id: true, loteId: true, codigoOp: true, tipoServico: true,
      lote: { select: { numeroLote: true, quantidadePecas: true, osId: true, os: { select: { codigoGrv: true, artigo: { select: { codigo: true } } } } } },
    },
  });
}

/**
 * Grava a contagem da chegada. Com falta, avisa o PCP (cada conta PCP ativa)
 * e a estação de onde as peças vieram (a Fundição).
 */
export async function registrarConferencia(
  tx: Prisma.TransactionClient,
  params: { opLoteId: string; esperado: number; contado: number; autorId: string },
): Promise<{ faltam: number; etapaOrigemId: string | null }> {
  const op = await contexto(tx, params.opLoteId);
  const faltam = params.esperado - params.contado;
  const autor = await tx.pessoa.findUnique({ where: { id: params.autorId }, select: { nome: true } });
  await tx.eventoOS.create({
    data: {
      osId: op.lote.osId, loteId: op.loteId, tipo: 'observacao_livre', autorId: params.autorId,
      payload: {
        acao: ACAO_CONFERENCIA, opLoteId: op.id, codigoOp: op.codigoOp, tipoServico: op.tipoServico,
        esperado: params.esperado, contado: params.contado, faltam,
      },
    },
  });
  if (faltam <= 0) return { faltam: 0, etapaOrigemId: null };

  const ops = await carregarOpsDoLote(tx, op.loteId);
  const ordenadas = ordenar(ops);
  const anterior = ordenadas[ordenadas.findIndex((o) => o.id === op.id) - 1] ?? null;
  const mensagem =
    `${op.lote.os.codigoGrv} (${op.lote.os.artigo.codigo}) — lote ${op.lote.numeroLote}: ` +
    `chegaram ${params.contado} de ${params.esperado} peças no Desbaste. Faltam ${faltam}.` +
    `${autor?.nome ? ` Conferido por ${autor.nome}.` : ''}`;

  const pcps = await tx.pessoa.findMany({ where: { papel: 'pcp', ativo: true }, select: { id: true } });
  for (const p of pcps) {
    await tx.alerta.create({ data: {
      tipo: 'os_em_risco', severidade: 'warning', entidadeTipo: 'OPLote', entidadeId: op.id,
      destinatarioId: p.id, canal: 'dashboard', mensagem,
    } });
  }
  if (anterior) {
    await tx.alerta.create({ data: {
      tipo: 'os_em_risco', severidade: 'warning', entidadeTipo: 'OPLote', entidadeId: op.id,
      etapaDestinoId: anterior.etapaId, canal: 'dashboard',
      mensagem: `${mensagem} Confira de onde saíram as peças que faltam.`,
    } });
  }
  return { faltam, etapaOrigemId: anterior?.etapaId ?? null };
}

/** As peças que faltavam apareceram (todas ou parte). */
export async function registrarComplemento(
  tx: Prisma.TransactionClient,
  params: { opLoteId: string; quantidade: number; autorId: string },
): Promise<Conferencia> {
  const op = await contexto(tx, params.opLoteId);
  await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${op.loteId} FOR UPDATE`;
  const conf = (await carregarConferencias(tx, [op.loteId])).get(op.id);
  if (!conf || conf.pendente <= 0) throw Object.assign(new Error('Não há peças faltando neste lote.'), { statusCode: 409 });
  if (params.quantidade > conf.pendente) {
    throw Object.assign(new Error(`Faltam só ${conf.pendente} peça(s) neste lote.`), { statusCode: 400 });
  }
  await tx.eventoOS.create({
    data: {
      osId: op.lote.osId, loteId: op.loteId, tipo: 'observacao_livre', autorId: params.autorId,
      payload: {
        acao: ACAO_COMPLEMENTO, opLoteId: op.id, codigoOp: op.codigoOp, tipoServico: op.tipoServico,
        quantidade: params.quantidade, faltavam: conf.pendente, faltam: conf.pendente - params.quantidade,
      },
    },
  });
  return { ...conf, complementos: conf.complementos + params.quantidade, pendente: conf.pendente - params.quantidade };
}

/**
 * Lote inteiro terminou: conclui o lote e, se for o último, a OS. Mesma regra
 * do encerramento no tótem. Devolve se o lote foi concluído.
 */
export async function concluirLoteEOsSeTerminou(
  tx: Prisma.TransactionClient,
  params: { loteId: string; osId: string; autorId: string },
): Promise<boolean> {
  const restantes = await tx.oPLote.count({ where: { loteId: params.loteId, status: { notIn: ['concluida'] } } });
  if (restantes > 0) return false;
  await tx.lote.update({ where: { id: params.loteId }, data: { status: 'concluido' } });
  const lotesRestantes = await tx.lote.count({ where: { osId: params.osId, status: { notIn: ['concluido'] } } });
  if (lotesRestantes === 0) {
    await tx.oS.update({ where: { id: params.osId }, data: { status: 'finalizada' } });
    await tx.eventoOS.create({
      data: { osId: params.osId, tipo: 'os_finalizada', autorId: params.autorId, payload: { acao: 'finalizada_automaticamente' } },
    });
  }
  return true;
}

/**
 * O PCP dá a falta como perdida: o lote passa a valer o que chegou. Toda OP
 * parada que já fez essa quantidade fecha agora (avisa a próxima estação e,
 * se a metalização for externa, registra a saída para o fornecedor).
 * Devolve as estações que precisam atualizar a tela.
 */
export async function aceitarFalta(
  tx: Prisma.TransactionClient,
  params: { opLoteId: string; autorId: string },
): Promise<{ quantidadeAntes: number; quantidadeDepois: number; estacoes: string[] }> {
  const op = await contexto(tx, params.opLoteId);
  await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${op.loteId} FOR UPDATE`;
  const conf = (await carregarConferencias(tx, [op.loteId])).get(op.id);
  if (!conf || conf.pendente <= 0) throw Object.assign(new Error('Não há peças faltando neste lote.'), { statusCode: 409 });

  const lote = await tx.lote.findUniqueOrThrow({ where: { id: op.loteId }, select: { quantidadePecas: true } });
  const antes = lote.quantidadePecas;
  const depois = antes - conf.pendente;
  if (depois < 1) throw Object.assign(new Error('O lote ficaria sem peças.'), { statusCode: 409 });

  await tx.lote.update({ where: { id: op.loteId }, data: { quantidadePecas: depois } });
  await tx.eventoOS.create({
    data: {
      osId: op.lote.osId, loteId: op.loteId, tipo: 'observacao_livre', autorId: params.autorId,
      payload: {
        acao: ACAO_FALTA_ACEITA, opLoteId: op.id, codigoOp: op.codigoOp, tipoServico: op.tipoServico,
        quantidade: conf.pendente, quantidadeLoteAntes: antes, quantidadeLoteDepois: depois,
      },
    },
  });

  // Metalização externa já indicada foi marcada com o lote antigo
  await tx.oPLote.updateMany({
    where: { loteId: op.loteId, envioExternoEm: { not: null }, recebimentoExternoEm: null, quantidadeEnvioExterno: { gt: depois } },
    data: { quantidadeEnvioExterno: depois },
  });

  const estacoes = new Set<string>();
  const ops = ordenar(await tx.oPLote.findMany({
    where: { loteId: op.loteId },
    select: { id: true, ordem: true, codigoOp: true, etapaId: true, status: true, quantidadeConcluida: true, exigeInspecao: true, envioExternoEm: true, recebimentoExternoEm: true },
  }));
  for (const o of ops) {
    estacoes.add(o.etapaId);
    if (o.status !== 'na_fila' || o.quantidadeConcluida < depois) continue;
    if (o.envioExternoEm && !o.recebimentoExternoEm) continue;
    await tx.oPLote.update({ where: { id: o.id }, data: { status: o.exigeInspecao ? 'aguardando_qualidade' : 'concluida' } });
    await avisarProximaSeLoteCompleto(tx, o.id);
    await registrarSaidaExterna(tx, o.id, params.autorId);
  }
  await concluirLoteEOsSeTerminou(tx, { loteId: op.loteId, osId: op.lote.osId, autorId: params.autorId });
  return { quantidadeAntes: antes, quantidadeDepois: depois, estacoes: [...estacoes] };
}

export interface FaltaAberta {
  opLoteId: string;
  osId: string;
  codigoGrv: string;
  artigo: string;
  numeroLote: number;
  esperado: number;
  contado: number;
  faltam: number;
  conferidoPor: string | null;
  conferidoEm: Date;
  /** Estação de onde as peças saíram (a Fundição). */
  etapaOrigemId: string | null;
  estacaoOrigem: string | null;
}

/**
 * Faltas de chegada ainda abertas em OS ativas. Com `etapaOrigemId`, só as
 * que saíram daquela estação: é a faixa vermelha no tótem da Fundição.
 */
export async function listarFaltasAbertas(
  tx: Prisma.TransactionClient,
  filtro: { etapaOrigemId?: string } = {},
): Promise<FaltaAberta[]> {
  const conferidos = await tx.eventoOS.findMany({
    where: {
      payload: { path: ['acao'], equals: ACAO_CONFERENCIA },
      os: { status: { in: ['aberta', 'em_producao'] } },
    },
    select: { loteId: true },
  });
  const loteIds = [...new Set(conferidos.map((e) => e.loteId).filter((id): id is string => !!id))];
  const conferencias = await carregarConferencias(tx, loteIds);
  const abertas = [...conferencias.values()].filter((c) => c.pendente > 0);
  const lista: FaltaAberta[] = [];
  for (const c of abertas) {
    const op = await tx.oPLote.findUnique({
      where: { id: c.opLoteId },
      select: {
        loteId: true,
        lote: { select: { numeroLote: true, os: { select: { id: true, codigoGrv: true, artigo: { select: { codigo: true } } } } } },
      },
    });
    if (!op) continue;
    const ops = ordenar(await carregarOpsDoLote(tx, op.loteId));
    const anterior = ops[ops.findIndex((o) => o.id === c.opLoteId) - 1] ?? null;
    if (filtro.etapaOrigemId && anterior?.etapaId !== filtro.etapaOrigemId) continue;
    lista.push({
      opLoteId: c.opLoteId, osId: op.lote.os.id, codigoGrv: op.lote.os.codigoGrv, artigo: op.lote.os.artigo.codigo,
      numeroLote: op.lote.numeroLote, esperado: c.esperado, contado: c.contado + c.complementos, faltam: c.pendente,
      conferidoPor: c.conferidoPor, conferidoEm: c.conferidoEm,
      etapaOrigemId: anterior?.etapaId ?? null, estacaoOrigem: anterior?.etapaNome ?? null,
    });
  }
  return lista.sort((a, b) => a.conferidoEm.getTime() - b.conferidoEm.getTime());
}
