// ============================================================
// Forja - Rotas de Motivo de Parada
// ============================================================
// Endpoints:
//   GET    /api/motivos-parada        — lista
//   GET    /api/motivos-parada/:id    — detalhe
//   POST   /api/motivos-parada        — criar
//   PUT    /api/motivos-parada/:id    — atualizar
//   DELETE /api/motivos-parada/:id    — desativar (soft delete)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

// ============================================================
// Schemas de validação
// ============================================================

const criarMotivoParadaSchema = z.object({
  codigo: z.number().int().positive('codigo deve ser um inteiro positivo').nullable().optional(),
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  planejado: z.boolean().default(false),
  ativo: z.boolean().optional(),
  capturaAutomaticaIot: z.boolean().default(false),
});

const atualizarMotivoParadaSchema = criarMotivoParadaSchema.partial();

// ============================================================
// Rotas
// ============================================================

export async function motivosParadaRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get(
    '/motivos-parada',
    { onRequest: [app.authenticate] },
    async (request) => {
      const querySchema = z.object({
        ativo: z.coerce.boolean().optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return { data: [] };
      }

      const { ativo } = parsed.data;

      const motivos = await prisma.motivoParada.findMany({
        where: {
          ...(ativo !== undefined ? { ativo } : {}),
        },
        orderBy: [{ codigo: 'asc' }, { nome: 'asc' }],
      });

      return { data: motivos };
    }
  );

  // ---------------- DETALHE ----------------
  app.get(
    '/motivos-parada/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'ID inválido',
        });
      }

      const motivo = await prisma.motivoParada.findUnique({
        where: { id: parsed.data.id },
      });

      if (!motivo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Motivo de parada não encontrado' });
      }

      return { data: motivo };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/motivos-parada',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = criarMotivoParadaSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: parsed.error.flatten(),
        });
      }

      const existente = await prisma.motivoParada.findUnique({
        where: { nome: parsed.data.nome },
      });

      if (existente) {
        return reply.code(409).send({
          error: 'duplicate_name',
          message: 'Já existe um Motivo de Parada com esse nome',
        });
      }

      if (parsed.data.codigo != null) {
        const codigoExistente = await prisma.motivoParada.findUnique({
          where: { codigo: parsed.data.codigo },
        });
        if (codigoExistente) {
          return reply.code(409).send({
            error: 'duplicate_codigo',
            message: `Já existe um Motivo de Parada com o código ${parsed.data.codigo}`,
          });
        }
      }

      const motivo = await prisma.motivoParada.create({
        data: parsed.data,
      });

      return reply.code(201).send({ data: motivo });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.put(
    '/motivos-parada/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);

      if (!paramsParsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = atualizarMotivoParadaSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const motivo = await prisma.motivoParada.findUnique({
        where: { id: paramsParsed.data.id },
      });

      if (!motivo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Motivo de parada não encontrado' });
      }

      if (bodyParsed.data.nome && bodyParsed.data.nome !== motivo.nome) {
        const existente = await prisma.motivoParada.findUnique({
          where: { nome: bodyParsed.data.nome },
        });
        if (existente) {
          return reply.code(409).send({
            error: 'duplicate_name',
            message: 'Já existe um Motivo de Parada com esse nome',
          });
        }
      }

      if (
        bodyParsed.data.codigo != null &&
        bodyParsed.data.codigo !== motivo.codigo
      ) {
        const codigoExistente = await prisma.motivoParada.findUnique({
          where: { codigo: bodyParsed.data.codigo },
        });
        if (codigoExistente) {
          return reply.code(409).send({
            error: 'duplicate_codigo',
            message: `Já existe um Motivo de Parada com o código ${bodyParsed.data.codigo}`,
          });
        }
      }

      const atualizado = await prisma.motivoParada.update({
        where: { id: paramsParsed.data.id },
        data: bodyParsed.data,
      });

      return { data: atualizado };
    }
  );

  // ---------------- DESATIVAR (soft delete) ----------------
  app.delete(
    '/motivos-parada/:id',
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const motivo = await prisma.motivoParada.findUnique({
        where: { id: parsed.data.id },
      });

      if (!motivo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Motivo de parada não encontrado' });
      }

      await prisma.motivoParada.update({
        where: { id: parsed.data.id },
        data: { ativo: false },
      });

      return { data: { id: parsed.data.id, desativado: true } };
    }
  );
}
