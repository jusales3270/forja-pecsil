// ============================================================
// Forja - Inspecao Dimensional (Sprint 5)
// Abre inspecao de uma OP, registra medicoes por cota,
// calcula dentroTolerancia no servidor, conclui com resultado.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const abrirSchema = z.object({
  opLoteId: z.string().uuid(),
  tipo: z.enum(['primeira_peca', 'amostragem', 'final']),
});

const medicaoSchema = z.object({
  cotaInspecaoId: z.string().uuid(),
  numeroPecaInspecionada: z.number().int().min(1),
  valorMedido: z.number(),
  observacoes: z.string().max(500).nullable().optional(),
});

const concluirSchema = z.object({
  resultado: z.enum(['aprovado', 'reprovado', 'com_observacoes']),
  observacoesGerais: z.string().max(2000).nullable().optional(),
});

// resolve tolerancia: cota define -> usa; senao -> fallback tolerancia geral do cliente
async function resolverTolerancia(cota: any, clienteId: string) {
  if (cota.toleranciaMais != null && cota.toleranciaMenos != null) {
    return { mais: cota.toleranciaMais, menos: cota.toleranciaMenos, origem: 'cota' };
  }
  const geral = await prisma.toleranciaGeralCliente.findFirst({
    where: {
      clienteId,
      faixaMin: { lte: cota.valorNominal },
      faixaMax: { gte: cota.valorNominal },
    },
  });
  if (geral) {
    return { mais: geral.toleranciaMais, menos: geral.toleranciaMenos, origem: 'geral' };
  }
  return null; // sem tolerancia definida
}

export async function inspecaoRoutes(app: FastifyInstance) {
  // POST /api/inspecoes  -> abre inspecao de uma OP
  app.post('/inspecoes', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { opLoteId, tipo } = abrirSchema.parse(request.body);
    const inspetorId = (request.user as any).pessoaId;

    const opLote = await prisma.oPLote.findUnique({ where: { id: opLoteId } });
    if (!opLote) {
      return reply.code(404).send({ error: 'not_found', message: 'OP nao encontrada' });
    }

    const inspecao = await prisma.inspecaoOP.create({
      data: { opLoteId, tipo, inspetorId, timestampIniciada: new Date() },
    });

    return reply.code(201).send({ data: inspecao });
  });

  // GET /api/inspecoes/:id  -> detalhe + medicoes + cotas do plano
  app.get('/inspecoes/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const inspecao = await prisma.inspecaoOP.findUnique({
      where: { id },
      include: {
        inspetor: { select: { id: true, nome: true } },
        medicoes: {
          include: { cotaInspecao: { select: { id: true, codigoCota: true } } },
          orderBy: { timestamp: 'asc' },
        },
        opLote: {
          include: {
            operacaoArtigo: {
              include: {
                planoInspecao: { include: { cotas: { orderBy: { ordem: 'asc' } } } },
              },
            },
            lote: { include: { os: { include: { cliente: true } } } },
          },
        },
      },
    });

    if (!inspecao) {
      return reply.code(404).send({ error: 'not_found', message: 'Inspecao nao encontrada' });
    }

    return { data: inspecao };
  });

  // POST /api/inspecoes/:id/medicoes  -> registra medicao (calcula dentroTolerancia)
  app.post('/inspecoes/:id/medicoes', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = medicaoSchema.parse(request.body);
    const inspetorId = (request.user as any).pessoaId;

    const cota = await prisma.cotaInspecao.findUnique({
      where: { id: body.cotaInspecaoId },
      include: {
        planoInspecao: {
          include: {
            operacaoArtigo: { include: { artigo: { select: { clienteId: true } } } },
          },
        },
      },
    });
    if (!cota) {
      return reply.code(404).send({ error: 'not_found', message: 'Cota nao encontrada' });
    }

    const clienteId = cota.planoInspecao.operacaoArtigo.artigo.clienteId;
    const tol = await resolverTolerancia(cota, clienteId);

    let dentroTolerancia = true;
    if (tol) {
      const limiteSup = cota.valorNominal + tol.mais;
      const limiteInf = cota.valorNominal - tol.menos;
      dentroTolerancia = body.valorMedido >= limiteInf && body.valorMedido <= limiteSup;
    }

    const medicao = await prisma.medicaoInspecao.create({
      data: {
        inspecaoOpId: id,
        cotaInspecaoId: body.cotaInspecaoId,
        numeroPecaInspecionada: body.numeroPecaInspecionada,
        valorMedido: body.valorMedido,
        dentroTolerancia,
        inspetorId,
        observacoes: body.observacoes ?? null,
      },
    });

    return reply.code(201).send({ data: { ...medicao, toleranciaOrigem: tol?.origem ?? 'sem_tolerancia' } });
  });

  // PATCH /api/inspecoes/:id/concluir  -> fecha com resultado
  app.patch('/inspecoes/:id/concluir', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { resultado, observacoesGerais } = concluirSchema.parse(request.body);

    const inspecao = await prisma.inspecaoOP.update({
      where: { id },
      data: { resultado, observacoesGerais: observacoesGerais ?? null, timestampConcluida: new Date() },
    });

    return { data: inspecao };
  });
}
