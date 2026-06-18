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
    const opsRaw = await prisma.oPLote.groupBy({
      by: ['etapaId', 'status'],
      _count: { _all: true },
    });
    const etapas = await prisma.etapa.findMany({ select: { id: true, nome: true, ordemPadrao: true } });
    const mapaEtapa = new Map(etapas.map((e) => [e.id, e]));

    const opsPorEtapa: Record<string, { etapaId: string; nome: string; ordemPadrao: number; total: number; porStatus: Record<string, number> }> = {};
    for (const r of opsRaw) {
      const et = mapaEtapa.get(r.etapaId);
      if (!et) continue;
      if (!opsPorEtapa[r.etapaId]) {
        opsPorEtapa[r.etapaId] = { etapaId: r.etapaId, nome: et.nome, ordemPadrao: et.ordemPadrao, total: 0, porStatus: {} };
      }
      opsPorEtapa[r.etapaId].porStatus[r.status] = r._count._all;
      opsPorEtapa[r.etapaId].total += r._count._all;
    }
    const kanban = Object.values(opsPorEtapa).sort((a, b) => a.ordemPadrao - b.ordemPadrao);

    // Resumo de inspecao (ultimas concluidas)
    const inspecaoRaw = await prisma.inspecaoOP.groupBy({
      by: ['resultado'],
      where: { resultado: { not: null } },
      _count: { _all: true },
    });
    const inspecao: Record<string, number> = {};
    for (const r of inspecaoRaw) if (r.resultado) inspecao[r.resultado] = r._count._all;

    return {
      data: {
        geradoEm: agora,
        osPorStatus,
        osAtrasadas,
        kanban,
        inspecao,
      },
    };
  });
}
