// ============================================================
// Forja - Rotas de Pessoas (read-only no Sprint 3)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma, Papel } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const listaQuerySchema = z.object({
  papel: z
    .enum([
      'admin',
      'chefe',
      'pcp',
      'engenharia',
      'programador',
      'operador',
      'inspetor',
      'embalador',
    ])
    .optional(),
  ativo: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export async function pessoasRoutes(app: FastifyInstance) {
  app.get('/pessoas', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = listaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Filtros inválidos',
        details: parsed.error.flatten(),
      });
    }

    const where: Prisma.PessoaWhereInput = {};
    if (parsed.data.papel) where.papel = parsed.data.papel as Papel;
    if (parsed.data.ativo !== undefined) where.ativo = parsed.data.ativo;

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        codigoPessoal: true,
        papel: true,
        ativo: true,
      },
    });

    return { data: pessoas };
  });
}
