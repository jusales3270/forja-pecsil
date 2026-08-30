// ============================================================
// Forja - Rotas de Etapas (read-only, pra dropdowns no backoffice)
// ============================================================
//
//   GET /api/etapas              — lista etapas ativas, ordenadas por ordemPadrao
//   GET /api/etapas/:id/pipeline — fases internas da etapa e onde está cada OS
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { montarPipelineEtapa } from '../lib/pipeline-etapa.js';

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

  // ---------------- PIPELINE DE FASES DA ETAPA ----------------
  // Etapa de processo único devolve temFases: false — o tótem então mantém
  // exatamente a tela de sempre.
  app.get(
    '/etapas/:id/pipeline',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const pipeline = await montarPipelineEtapa(parsed.data.id);
      if (!pipeline) {
        return reply.code(404).send({ error: 'not_found', message: 'Etapa não encontrada' });
      }

      return { data: pipeline };
    }
  );
}
