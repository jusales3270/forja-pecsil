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
/** A Fundição avisou que mandou as peças que faltavam (o Desbaste ainda confirma). */
export const ACAO_ENVIO_ORIGEM = 'falta_enviada';

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
  /** Peças que a Fundição disse ter enviado. */
  enviadas: number;
  /** Enviadas pela Fundição e ainda não confirmadas pelo Desbaste. */
  aguardandoConfirmacao: number;
  enviadoPor: string | null;
  enviadoEm: Date | null;
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
      OR: [ACAO_CONFERENCIA, ACAO_COMPLEMENTO, ACAO_FALTA_ACEITA, ACAO_ENVIO_ORIGEM].map((acao) => ({ payload: { path: ['acao'], equals: acao } })),
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
        pendente: 0, enviadas: 0, aguardandoConfirmacao: 0, enviadoPor: null, enviadoEm: null,
        conferidoPor: e.autor?.nome ?? null, conferidoEm: e.timestamp,
      });
    } else {
      const c = mapa.get(p.opLoteId);
      if (!c) continue;
      const qtd = Number(p.quantidade) || 0;
      if (p.acao === ACAO_COMPLEMENTO) c.complementos += qtd;
      else if (p.acao === ACAO_ENVIO_ORIGEM) { c.enviadas += qtd; c.enviadoPor = e.autor?.nome ?? null; c.enviadoEm = e.timestamp; }
      else c.aceitas += qtd;
    }
  }
  for (const c of mapa.values()) {
    c.pendente = Math.max(0, c.esperado - c.contado - c.complementos - c.aceitas);
    c.aguardandoConfirmacao = Math.min(c.pendente, Math.max(0, c.enviadas - c.complementos));
  }
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
  const pendente = conf.pendente - params.quantidade;
  return {
    ...conf, complementos: conf.complementos + params.quantidade, pendente,
    aguardandoConfirmacao: Math.min(pendente, Math.max(0, conf.enviadas - conf.complementos - params.quantidade)),
  };
}

/**
 * A Fundição avisa que mandou as peças que faltavam. A falta continua aberta
 * (e a faixa na Fundição também) até o Desbaste confirmar que recebeu; o
 * Desbaste é avisado para conferir.
 */
export async function registrarEnvioDaOrigem(
  tx: Prisma.TransactionClient,
  params: { opLoteId: string; quantidade: number; autorId: string },
): Promise<{ conferencia: Conferencia; etapaDesbasteId: string }> {
  const op = await contexto(tx, params.opLoteId);
  await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${op.loteId} FOR UPDATE`;
  const conf = (await carregarConferencias(tx, [op.loteId])).get(op.id);
  if (!conf || conf.pendente <= 0) throw Object.assign(new Error('Não há peças faltando neste lote.'), { statusCode: 409 });
  const podeEnviar = conf.pendente - conf.aguardandoConfirmacao;
  if (podeEnviar <= 0) {
    throw Object.assign(new Error('As peças que faltam já foram enviadas. Falta o Desbaste confirmar o recebimento.'), { statusCode: 409 });
  }
  if (params.quantidade > podeEnviar) {
    throw Object.assign(new Error(`Faltam só ${podeEnviar} peça(s) para enviar.`), { statusCode: 400 });
  }
  const autor = await tx.pessoa.findUnique({ where: { id: params.autorId }, select: { nome: true } });
  await tx.eventoOS.create({
    data: {
      osId: op.lote.osId, loteId: op.loteId, tipo: 'observacao_livre', autorId: params.autorId,
      payload: {
        acao: ACAO_ENVIO_ORIGEM, opLoteId: op.id, codigoOp: op.codigoOp, tipoServico: op.tipoServico,
        quantidade: params.quantidade, faltavam: conf.pendente,
      },
    },
  });
  const desbaste = await tx.oPLote.findUniqueOrThrow({ where: { id: op.id }, select: { etapaId: true } });
  await tx.alerta.create({ data: {
    tipo: 'os_em_risco', severidade: 'warning', entidadeTipo: 'OPLote', entidadeId: op.id,
    etapaDestinoId: desbaste.etapaId, canal: 'dashboard',
    mensagem:
      `${op.lote.os.codigoGrv} (${op.lote.os.artigo.codigo}) — lote ${op.lote.numeroLote}: a Fundição enviou ` +
      `${params.quantidade} das ${conf.pendente} peças que faltavam${autor?.nome ? ` (${autor.nome})` : ''}. ` +
      `Confira e confirme em "Chegaram peças" quando chegarem.`,
  } });
  return {
    conferencia: { ...conf, enviadas: conf.enviadas + params.quantidade, aguardandoConfirmacao: conf.aguardandoConfirmacao + params.quantidade, enviadoPor: autor?.nome ?? null, enviadoEm: new Date() },
    etapaDesbasteId: desbaste.etapaId,
  };
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
  /** Enviadas pela Fundição e ainda não confirmadas pelo Desbaste. */
  aguardandoConfirmacao: number;
  enviadoPor: string | null;
  enviadoEm: Date | null;
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
      aguardandoConfirmacao: c.aguardandoConfirmacao, enviadoPor: c.enviadoPor, enviadoEm: c.enviadoEm,
    });
  }
  return lista.sort((a, b) => a.conferidoEm.getTime() - b.conferidoEm.getTime());
}

export interface FaltaIntegracao {
  /** Id estável: a OP de chegada (uma conferência por OP). */
  id: string;
  osId: string;
  codigoGrv: string;
  cliente: string;
  artigo: { codigo: string; descricao: string };
  numeroLote: number;
  esperado: number;
  /** Contado na chegada. */
  contado: number;
  /** Faltaram na conferência. */
  faltaInicial: number;
  /** Chegaram depois. */
  chegaramDepois: number;
  /** PCP deu como perdidas. */
  aceitas: number;
  /** Ainda faltando agora. */
  faltam: number;
  /** A Fundição disse ter enviado (total). */
  enviadas: number;
  /** Enviadas pela Fundição e ainda não confirmadas pelo Desbaste. */
  aguardandoConfirmacao: number;
  enviadoPor: string | null;
  enviadoEm: Date | null;
  situacao: 'aberta' | 'resolvida';
  resolucao: 'pecas_chegaram' | 'falta_aceita' | null;
  conferidoPor: string | null;
  conferidoEm: Date;
  resolvidoPor: string | null;
  resolvidoEm: Date | null;
  estacaoConferencia: string | null;
  estacaoOrigem: string | null;
}

/**
 * Faltas de chegada para a integração (Business OS): todas as abertas e as
 * resolvidas desde `desde`. Uma linha por conferência com falta; a plataforma
 * guarda pelo `id` e avisa o chefe quando aparece uma nova ou ela se resolve.
 */
export async function listarFaltasParaIntegracao(
  tx: Prisma.TransactionClient,
  params: { desde: Date },
): Promise<FaltaIntegracao[]> {
  const conferencias = await tx.eventoOS.findMany({
    where: { payload: { path: ['acao'], equals: ACAO_CONFERENCIA } },
    orderBy: { timestamp: 'asc' },
    select: { loteId: true, payload: true },
  });
  const comFalta = conferencias.filter((e) => Number((e.payload as any)?.faltam) > 0 && e.loteId);
  const loteIds = [...new Set(comFalta.map((e) => e.loteId!))];
  if (loteIds.length === 0) return [];

  const eventos = await tx.eventoOS.findMany({
    where: {
      loteId: { in: loteIds },
      OR: [ACAO_CONFERENCIA, ACAO_COMPLEMENTO, ACAO_FALTA_ACEITA, ACAO_ENVIO_ORIGEM].map((acao) => ({ payload: { path: ['acao'], equals: acao } })),
    },
    orderBy: { timestamp: 'asc' },
    select: { payload: true, timestamp: true, autor: { select: { nome: true } } },
  });

  type Linha = FaltaIntegracao & { opLoteId: string };
  const linhas = new Map<string, Linha>();
  for (const e of eventos) {
    const p = e.payload as any;
    if (!p?.opLoteId) continue;
    if (p.acao === ACAO_CONFERENCIA) {
      if (linhas.has(p.opLoteId) || !(Number(p.faltam) > 0)) continue;
      linhas.set(p.opLoteId, {
        opLoteId: p.opLoteId, id: p.opLoteId, osId: '', codigoGrv: '', cliente: '', artigo: { codigo: '', descricao: '' },
        numeroLote: 0, esperado: p.esperado, contado: p.contado, faltaInicial: p.esperado - p.contado,
        chegaramDepois: 0, aceitas: 0, faltam: p.esperado - p.contado,
        enviadas: 0, aguardandoConfirmacao: 0, enviadoPor: null, enviadoEm: null, situacao: 'aberta', resolucao: null,
        conferidoPor: e.autor?.nome ?? null, conferidoEm: e.timestamp, resolvidoPor: null, resolvidoEm: null,
        estacaoConferencia: null, estacaoOrigem: null,
      });
      continue;
    }
    const l = linhas.get(p.opLoteId);
    if (!l || l.faltam <= 0) continue;
    const qtd = Number(p.quantidade) || 0;
    if (p.acao === ACAO_ENVIO_ORIGEM) {
      l.enviadas += qtd; l.enviadoPor = e.autor?.nome ?? null; l.enviadoEm = e.timestamp;
      l.aguardandoConfirmacao = Math.min(l.faltam, Math.max(0, l.enviadas - l.chegaramDepois));
      continue;
    }
    if (p.acao === ACAO_COMPLEMENTO) l.chegaramDepois += qtd;
    else l.aceitas += qtd;
    l.faltam = Math.max(0, l.faltaInicial - l.chegaramDepois - l.aceitas);
    l.aguardandoConfirmacao = Math.min(l.faltam, Math.max(0, l.enviadas - l.chegaramDepois));
    if (l.faltam === 0) {
      l.situacao = 'resolvida';
      l.resolucao = p.acao === ACAO_FALTA_ACEITA ? 'falta_aceita' : 'pecas_chegaram';
      l.resolvidoPor = e.autor?.nome ?? null;
      l.resolvidoEm = e.timestamp;
    }
  }

  const resultado: FaltaIntegracao[] = [];
  for (const l of linhas.values()) {
    if (l.situacao === 'resolvida' && l.resolvidoEm! < params.desde) continue;
    const op = await tx.oPLote.findUnique({
      where: { id: l.opLoteId },
      select: {
        loteId: true, etapa: { select: { nome: true } },
        lote: { select: { numeroLote: true, os: { select: { id: true, codigoGrv: true, cliente: { select: { nome: true } }, artigo: { select: { codigo: true, descricao: true } } } } } },
      },
    });
    if (!op) continue;
    const ops = ordenar(await carregarOpsDoLote(tx, op.loteId));
    const anterior = ops[ops.findIndex((o) => o.id === l.opLoteId) - 1] ?? null;
    const { opLoteId: _op, ...linha } = l;
    resultado.push({
      ...linha,
      osId: op.lote.os.id, codigoGrv: op.lote.os.codigoGrv, cliente: op.lote.os.cliente.nome,
      artigo: { codigo: op.lote.os.artigo.codigo, descricao: op.lote.os.artigo.descricao },
      numeroLote: op.lote.numeroLote, estacaoConferencia: op.etapa.nome, estacaoOrigem: anterior?.etapaNome ?? null,
    });
  }
  return resultado.sort((a, b) => b.conferidoEm.getTime() - a.conferidoEm.getTime());
}

/** A operação logo antes da informada (de onde as peças saíram). */
export function operacaoAnterior<T extends OpDoLote>(ops: T[], opId: string): T | null {
  const o = ordenar(ops);
  return o[o.findIndex((x) => x.id === opId) - 1] ?? null;
}
