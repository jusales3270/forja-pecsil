// ============================================================
// Forja - Rotas de Tolerância Geral por Cliente
// ============================================================
// Endpoints:
//   GET    /api/clientes/:clienteId/tolerancias-gerais   — lista por cliente
//   POST   /api/clientes/:clienteId/tolerancias-gerais   — criar
//   PUT    /api/tolerancias-gerais/:id                   — atualizar
//   DELETE /api/tolerancias-gerais/:id                   — deletar
//   GET    /api/clientes/:clienteId/tolerancias-gerais/lookup?valor=X
//                  — busca a tolerância aplicável a um valor nominal
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

// ============================================================
// Schemas de validação
// ============================================================

const criarToleranciaSchema = z
  .object({
    faixaMin: z.number().min(0, 'faixaMin deve ser ≥ 0'),
    faixaMax: z.number().positive('faixaMax deve ser > 0'),
    toleranciaMais: z.number().min(0, 'toleranciaMais deve ser ≥ 0'),
    toleranciaMenos: z.number().min(0, 'toleranciaMenos deve ser ≥ 0'),
    observacoes: z.string().nullable().optional(),
  })
  .refine((d) => d.faixaMax > d.faixaMin, {
    message: 'faixaMax deve ser maior que faixaMin',
    path: ['faixaMax'],
  });

const atualizarToleranciaSchema = z.object({
  faixaMin: z.number().min(0).optional(),
  faixaMax: z.number().positive().optional(),
  toleranciaMais: z.number().min(0).optional(),
  toleranciaMenos: z.number().min(0).optional(),
  observacoes: z.string().nullable().optional(),
});

// Helper: verifica se uma faixa nova/atualizada se sobrepõe com outras já existentes
async function temSobreposicao(
  clienteId: string,
  faixaMin: number,
  faixaMax: number,
  ignorarId?: string
): Promise<boolean> {
  const sobrepostas = await prisma.toleranciaGeralCliente.findMany({
    where: {
      clienteId,
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
      // Há sobreposição se: faixaMin_existente < faixaMax_nova AND faixaMax_existente > faixaMin_nova
      AND: [{ faixaMin: { lt: faixaMax } }, { faixaMax: { gt: faixaMin } }],
    },
  });
  return sobrepostas.length > 0;
}

// ============================================================
// Rotas
// ============================================================

export async function toleranciasGeraisRoutes(app: FastifyInstance) {
  // ---------------- LISTA POR CLIENTE ----------------
  app.get(
    '/clientes/:clienteId/tolerancias-gerais',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ clienteId: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'clienteId inválido' });
      }

      const cliente = await prisma.cliente.findUnique({
        where: { id: parsed.data.clienteId },
      });

      if (!cliente) {
        return reply
          .code(404)
          .send({ error: 'cliente_not_found', message: 'Cliente não encontrado' });
      }

      const tolerancias = await prisma.toleranciaGeralCliente.findMany({
        where: { clienteId: parsed.data.clienteId },
        orderBy: { faixaMin: 'asc' },
      });

      return { data: tolerancias };
    }
  );

  // ---------------- LOOKUP (busca tolerância aplicável a um valor) ----------------
  app.get(
    '/clientes/:clienteId/tolerancias-gerais/lookup',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ clienteId: z.string().uuid() });
      const querySchema = z.object({ valor: z.coerce.number() });

      const paramsParsed = paramsSchema.safeParse(request.params);
      const queryParsed = querySchema.safeParse(request.query);

      if (!paramsParsed.success || !queryParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'clienteId ou valor inválidos',
        });
      }

      const { clienteId } = paramsParsed.data;
      const { valor } = queryParsed.data;

      // Busca a faixa que contém o valor (faixaMin <= valor < faixaMax)
      const tolerancia = await prisma.toleranciaGeralCliente.findFirst({
        where: {
          clienteId,
          faixaMin: { lte: valor },
          faixaMax: { gt: valor },
        },
      });

      if (!tolerancia) {
        return {
          data: null,
          message: 'Nenhuma tolerância geral cadastrada para esse valor',
        };
      }

      return { data: tolerancia };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/clientes/:clienteId/tolerancias-gerais',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ clienteId: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);

      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'clienteId inválido' });
      }

      const bodyParsed = criarToleranciaSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const { clienteId } = paramsParsed.data;
      const data = bodyParsed.data;

      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) {
        return reply
          .code(404)
          .send({ error: 'cliente_not_found', message: 'Cliente não encontrado' });
      }

      // Verifica sobreposição de faixas
      const sobreposicao = await temSobreposicao(
        clienteId,
        data.faixaMin,
        data.faixaMax
      );
      if (sobreposicao) {
        return reply.code(409).send({
          error: 'faixa_sobreposta',
          message: `Já existe tolerância cobrindo parte da faixa ${data.faixaMin}-${data.faixaMax}`,
        });
      }

      const tolerancia = await prisma.toleranciaGeralCliente.create({
        data: { ...data, clienteId },
      });

      return reply.code(201).send({ data: tolerancia });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.put(
    '/tolerancias-gerais/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);

      if (!paramsParsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = atualizarToleranciaSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const tolerancia = await prisma.toleranciaGeralCliente.findUnique({
        where: { id: paramsParsed.data.id },
      });

      if (!tolerancia) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Tolerância não encontrada' });
      }

      // Calcula os novos valores efetivos pra validar
      const novoMin = bodyParsed.data.faixaMin ?? tolerancia.faixaMin;
      const novoMax = bodyParsed.data.faixaMax ?? tolerancia.faixaMax;

      if (novoMax <= novoMin) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'faixaMax deve ser maior que faixaMin',
        });
      }

      // Verifica sobreposição (ignorando o registro atual)
      const sobreposicao = await temSobreposicao(
        tolerancia.clienteId,
        novoMin,
        novoMax,
        tolerancia.id
      );
      if (sobreposicao) {
        return reply.code(409).send({
          error: 'faixa_sobreposta',
          message: `Já existe tolerância cobrindo parte da faixa ${novoMin}-${novoMax}`,
        });
      }

      const atualizada = await prisma.toleranciaGeralCliente.update({
        where: { id: paramsParsed.data.id },
        data: bodyParsed.data,
      });

      return { data: atualizada };
    }
  );

  // ---------------- DELETAR ----------------
  app.delete(
    '/tolerancias-gerais/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const tolerancia = await prisma.toleranciaGeralCliente.findUnique({
        where: { id: parsed.data.id },
      });

      if (!tolerancia) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Tolerância não encontrada' });
      }

      await prisma.toleranciaGeralCliente.delete({
        where: { id: parsed.data.id },
      });

      return { data: { id: parsed.data.id, deletado: true } };
    }
  );
}
