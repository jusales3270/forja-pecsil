// ============================================================
// Forja - Dashboard do Chefe (Sprint 6)
// Agregacao de producao: OS por status, OPs por etapa,
// OS atrasadas, resumo de inspecao.
// ============================================================

import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard  -> visao macro pro chefe
  app.get('/dashboard', { onRequest: [app.authenticate] }, async () => {
    const agora = new Date();

    // OS por status
    const osPorStatusRaw = await prisma.oS.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const osPorStatus: Record<string, number> = {};
    for (const r of osPorStatusRaw) osPorStatus[r.status] = r._count._all;

    // OS atrasadas: prazo vencido e nao finalizada/cancelada
    const osAtrasadas = await prisma.oS.findMany({
      where: {
        prazoEntrega: { lt: agora },
        status: { notIn: ['finalizada', 'cancelada'] },
      },
      select: {
        id: true,
        codigoGrv: true,
        prazoEntrega: true,
        prioridade: true,
        status: true,
        cliente: { select: { nome: true } },
        artigo: { select: { codigo: true, descricao: true } },
      },
      orderBy: { prazoEntrega: 'asc' },
      take: 50,
    });

    // OPs por etapa x status (Kanban)
    // Kanban: lotes reais por etapa (cada OP vira um card), exceto concluidas
    const etapas = await prisma.etapa.findMany({
      select: { id: true, nome: true, ordemPadrao: true },
      orderBy: { ordemPadrao: 'asc' },
    });

    const opsAtivas = await prisma.oPLote.findMany({
      where: { status: { notIn: ['concluida'] } },
      select: {
        id: true,
        codigoOp: true,
        etapaId: true,
        status: true,
        criadoEm: true,
        lote: {
          select: {
            numeroLote: true,
            os: {
              select: {
                codigoGrv: true,
                prazoEntrega: true,
                prioridade: true,
                cliente: { select: { nome: true } },
                artigo: { select: { codigo: true } },
              },
            },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    const kanban = etapas.map((et) => {
      const cards = opsAtivas
        .filter((op) => op.etapaId === et.id)
        .map((op) => {
          const prazo = op.lote.os.prazoEntrega;
          const diasAtePrazo = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86_400_000);
          let semaforo: 'verde' | 'amarelo' | 'vermelho' = 'verde';
          if (diasAtePrazo < 0 || diasAtePrazo < 3) semaforo = 'vermelho';
          else if (diasAtePrazo < 7) semaforo = 'amarelo';
          return {
            opLoteId: op.id,
            codigoOp: op.codigoOp,
            codigoGrv: op.lote.os.codigoGrv,
            numeroLote: op.lote.numeroLote,
            cliente: op.lote.os.cliente.nome,
            artigo: op.lote.os.artigo.codigo,
            status: op.status,
            prioridade: op.lote.os.prioridade,
            diasAtePrazo,
            semaforo,
          };
        });
      return { etapaId: et.id, nome: et.nome, ordemPadrao: et.ordemPadrao, total: cards.length, cards };
    });

    // Resumo de inspecao (ultimas concluidas)
    const inspecaoRaw = await prisma.inspecaoOP.groupBy({
      by: ['resultado'],
      where: { resultado: { not: null } },
      _count: { _all: true },
    });
    const inspecao: Record<string, number> = {};
    for (const r of inspecaoRaw) if (r.resultado) inspecao[r.resultado] = r._count._all;

    // Lotes Fantasmas v2: gaps de apontamento (limite fixo de 4h pro painel TV)
    const limite4h = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const carimbosParados = await prisma.carimbo.findMany({
      where: {
        timestampSaida: null,
        timestampEntrada: { lt: limite4h },
        opLote: { status: 'em_processo' },
      },
      include: {
        opLote: { include: { lote: { include: { os: true } } } },
        etapa: true,
      },
      orderBy: { timestampEntrada: 'asc' },
      take: 20,
    });
    const opsParadas = carimbosParados.map((c) => ({
      codigoOp: c.opLote.codigoOp,
      codigoGrv: c.opLote.lote.os.codigoGrv,
      etapa: c.etapa.nome,
      horasParado: Math.floor((Date.now() - c.timestampEntrada.getTime()) / 3_600_000),
    }));

    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);
    const fimOntem = new Date(ontem);
    fimOntem.setHours(23, 59, 59, 999);
    const operadores = await prisma.pessoa.findMany({
      where: { papel: 'operador', ativo: true },
      select: { id: true, nome: true },
    });
    const turnosOntem = await prisma.apontamentoTurno.findMany({
      where: { data: { gte: ontem, lte: fimOntem } },
      select: { operadorId: true },
    });
    const fecharam = new Set(turnosOntem.map((t) => t.operadorId));
    const turnosNaoFechados = operadores
      .filter((o) => !fecharam.has(o.id))
      .map((o) => ({ operador: o.nome }));

    return {
      data: {
        geradoEm: agora,
        osPorStatus,
        osAtrasadas,
        kanban,
        inspecao,
        fantasmas: {
          opsParadas,
          turnosNaoFechados,
        },
      },
    };
  });
}
