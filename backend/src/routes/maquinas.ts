// ============================================================
// Forja - Rotas de Máquinas (read-only no Sprint 3)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const listaQuerySchema = z.object({
  etapaId: z.string().uuid().optional(),
  ativa: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export async function maquinasRoutes(app: FastifyInstance) {
  app.get('/maquinas', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = listaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Filtros inválidos',
        details: parsed.error.flatten(),
      });
    }

    const where: Prisma.MaquinaWhereInput = {};
    if (parsed.data.etapaId) where.etapaId = parsed.data.etapaId;
    if (parsed.data.ativa !== undefined) where.ativa = parsed.data.ativa;

    const maquinas = await prisma.maquina.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { etapa: { select: { id: true, nome: true } } },
    });

    return { data: maquinas };
  });
}
