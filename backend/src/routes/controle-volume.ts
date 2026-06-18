// ============================================================
// Forja - Controle de Volume (Sprint 5)
// Registro de volumetria por peca/lote.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const registrarSchema = z.object({
  loteId: z.string().uuid(),
  numeroPeca: z.number().int().min(1),
  volumeSolicitado: z.number(),
  volumeEncontrado: z.number(),
  temperatura: z.number().nullable().optional(),
  horarioEntrada: z.string().datetime({ offset: true }),
  horarioSaida: z.string().datetime({ offset: true }).nullable().optional(),
  observacoes: z.string().max(500).nullable().optional(),
});

export async function controleVolumeRoutes(app: FastifyInstance) {
  // POST /api/controle-volume  -> registra medicao de volume
  app.post('/controle-volume', { onRequest: [app.authenticate] }, async (request, reply) => {
    const body = registrarSchema.parse(request.body);
    const responsavelId = (request.user as any).pessoaId;

    const correcaoNecessaria = body.volumeSolicitado - body.volumeEncontrado;

    const registro = await prisma.controleVolume.create({
      data: {
        loteId: body.loteId,
        numeroPeca: body.numeroPeca,
        data: new Date(body.horarioEntrada),
        volumeSolicitado: body.volumeSolicitado,
        volumeEncontrado: body.volumeEncontrado,
        correcaoNecessaria,
        temperatura: body.temperatura ?? null,
        horarioEntrada: new Date(body.horarioEntrada),
        horarioSaida: body.horarioSaida ? new Date(body.horarioSaida) : null,
        responsavelId,
        observacoes: body.observacoes ?? null,
      },
    });

    return reply.code(201).send({ data: registro });
  });

  // GET /api/controle-volume/:loteId  -> lista registros de um lote
  app.get('/controle-volume/:loteId', { onRequest: [app.authenticate] }, async (request) => {
    const { loteId } = z.object({ loteId: z.string().uuid() }).parse(request.params);

    const registros = await prisma.controleVolume.findMany({
      where: { loteId },
      include: { responsavel: { select: { id: true, nome: true } } },
      orderBy: { horarioEntrada: 'asc' },
    });

    return { data: registros };
  });
}
