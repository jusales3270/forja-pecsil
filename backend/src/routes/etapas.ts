// ============================================================
// Forja - Rotas de Etapas (read-only, pra dropdowns no backoffice)
// ============================================================
//
//   GET /api/etapas — lista etapas ativas, ordenadas por ordemPadrao
// ============================================================

import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';

export async function etapasRoutes(app: FastifyInstance) {
  app.get(
    '/etapas',
    { onRequest: [app.authenticate] },
    async () => {
      const etapas = await prisma.etapa.findMany({
        where: { ativa: true },
        orderBy: { ordemPadrao: 'asc' },
        select: {
          id: true,
          nome: true,
          ordemPadrao: true,
          slaHoras: true,
          aplicaParaTipos: true,
          exigeCheckpointQualidade: true,
        },
      });

      return { data: etapas };
    }
  );
}
