// ============================================================
// Forja - Abertura da OS no chão de fábrica
// ============================================================
// Lotes, OPs (cópia do roteiro do Artigo), aviso à 1ª estação e cópia da
// lista de materiais. Usado por POST /os (OS aberta direto) e por
// POST /os/:id/liberar (rascunho vindo do orçamento do Business OS).
// ============================================================

import { Prisma } from '@prisma/client';
import { avisarChegada } from './aviso-chegada.js';

export type DivisaoLotes =
  | { tipoDivisao?: 'unico' }
  | { tipoDivisao: 'quantidade_lotes'; quantidadeLotes: number }
  | { tipoDivisao: 'tamanho_lote'; tamanhoLote: number }
  | undefined;

/** Quantidade de cada lote. */
export function calcularDivisaoLotes(total: number, divisao: DivisaoLotes): number[] {
  if (!divisao || !divisao.tipoDivisao || divisao.tipoDivisao === 'unico') return [total];
  if (divisao.tipoDivisao === 'quantidade_lotes') {
    const n = divisao.quantidadeLotes;
    if (n <= 0 || n > total) return [total];
    const base = Math.floor(total / n);
    const resto = total - base * n;
    // Distribui o resto: primeiros lotes ganham +1 peça
    return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
  }
  if (divisao.tipoDivisao === 'tamanho_lote') {
    const x = divisao.tamanhoLote;
    if (x <= 0 || x >= total) return [total];
    const lotes: number[] = [];
    let restante = total;
    while (restante > 0) {
      const q = Math.min(x, restante);
      lotes.push(q);
      restante -= q;
    }
    return lotes;
  }
  return [total];
}

export async function criarEvento(
  tx: Prisma.TransactionClient,
  data: { osId: string; loteId?: string; tipo: any; autorId?: string; payload?: any; visivelDashboard?: boolean },
) {
  return tx.eventoOS.create({
    data: {
      osId: data.osId,
      loteId: data.loteId,
      tipo: data.tipo,
      autorId: data.autorId,
      payload: data.payload ?? undefined,
      visivelDashboard: data.visivelDashboard ?? true,
    },
  });
}

type Operacao = Prisma.OperacaoArtigoGetPayload<{}>;
export type AvisoChegada = { etapaId: string; opLoteId: string; loteId: string };

/**
 * Cria os lotes e, em cada um, as OPs (cópia do roteiro). A estação da 1ª
 * operação é avisada. Devolve os avisos para emitir no socket depois do commit.
 */
export async function gerarLotesEOps(
  tx: Prisma.TransactionClient,
  args: { osId: string; operacoes: Operacao[]; divisaoLotes: number[]; autorId: string },
): Promise<AvisoChegada[]> {
  const avisos: AvisoChegada[] = [];
  for (let i = 0; i < args.divisaoLotes.length; i++) {
    const quantidadeLote = args.divisaoLotes[i];
    const lote = await tx.lote.create({ data: { osId: args.osId, numeroLote: i + 1, quantidadePecas: quantidadeLote } });

    let primeiraOp: { id: string; ordem: number } | null = null;
    for (const op of args.operacoes) {
      const criada = await tx.oPLote.create({
        data: {
          loteId: lote.id,
          operacaoArtigoId: op.id,
          etapaId: op.etapaId,
          ordem: op.ordem,
          tempoUnitPlanejado: op.tempoUnitMin,
          tempoTotalPlanejado: op.tempoUnitMin * quantidadeLote,
          codigoOp: op.codigoOp,
          tipoServico: op.tipoServico,
          exigeInspecao: op.exigeInspecao,
          gatilhoAlertaPecas: op.gatilhoAlertaPecas,
          avisaAoIniciar: op.avisaAoIniciar,
          etapaAvisadaId: op.etapaAvisadaId,
          terceirizada: op.terceirizada,
          fornecedor: op.fornecedor,
          prazoPrevistoDias: op.prazoPrevistoDias,
          custoPrevisto: op.custoPrevisto,
          esperaHoras: op.esperaHoras,
          exigeLoteCompleto: op.exigeLoteCompleto,
          observacoes: op.observacoes ?? null,
        },
        select: { id: true, ordem: true },
      });
      if (!primeiraOp || criada.ordem < primeiraOp.ordem) primeiraOp = criada;
    }

    // A estação da 1ª operação do roteiro — seja ela qual for — fica sabendo
    if (primeiraOp) {
      const aviso = await avisarChegada(tx, { opLoteId: primeiraOp.id, quantidade: quantidadeLote });
      if (aviso) avisos.push({ ...aviso, opLoteId: primeiraOp.id, loteId: lote.id });
    }

    await criarEvento(tx, {
      osId: args.osId,
      loteId: lote.id,
      tipo: 'lote_criado',
      autorId: args.autorId,
      payload: { numeroLote: lote.numeroLote, quantidadePecas: lote.quantidadePecas, totalOps: args.operacoes.length },
    });
  }
  return avisos;
}

/** Cópia da lista de materiais do Artigo (por peça) para a OS, com o total. */
export async function copiarMateriais(tx: Prisma.TransactionClient, args: { osId: string; artigoId: string; quantidadeTotal: number }) {
  const lista = await tx.materialArtigo.findMany({ where: { artigoId: args.artigoId }, orderBy: { ordem: 'asc' } });
  if (!lista.length) return 0;
  await tx.materialOS.deleteMany({ where: { osId: args.osId } });
  await tx.materialOS.createMany({
    data: lista.map((m) => ({
      osId: args.osId,
      materialCodigo: m.materialCodigo,
      descricao: m.descricao,
      quantidadePorPeca: m.quantidade,
      quantidadeTotal: m.quantidade.mul(args.quantidadeTotal),
      unidade: m.unidade,
      observacoes: m.observacoes,
      ordem: m.ordem,
    })),
  });
  return lista.length;
}

/** Código provisório do rascunho (o PCP troca pelo número da OS ao liberar). */
export const PREFIXO_PROVISORIO = 'ORC-';
/** Rascunho de orçamento de TREINO: serve para praticar e nunca é liberado. */
export const PREFIXO_TREINO = 'TREINO-';
export const ORIGEM_TREINO = 'business_os_treino';
export const ehCodigoProvisorio = (codigo: string) => codigo.toUpperCase().startsWith(PREFIXO_PROVISORIO);
