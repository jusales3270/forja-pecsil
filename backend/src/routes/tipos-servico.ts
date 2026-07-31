// ============================================================
// Forja - Rotas de Tipo de Serviço
// ============================================================
// Endpoints:
//   GET    /api/tipos-servico        — lista
//   GET    /api/tipos-servico/:id    — detalhe
//   POST   /api/tipos-servico        — criar
//   PUT    /api/tipos-servico/:id    — atualizar
//   DELETE /api/tipos-servico/:id    — desativar (soft delete)
//   GET    /api/tipos-servico/search?q=... — autocomplete
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

// ============================================================
// Schemas de validação
// ============================================================

const criarTipoServicoSchema = z.object({
  codigo: z.number().int().positive('codigo deve ser um inteiro positivo').nullable().optional(),
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  etapaId: z.string().uuid('etapaId inválido'),
  exigeInspecao: z.boolean().default(false),
  ativo: z.boolean().optional(),
  observacoes: z.string().nullable().optional(),

});

const atualizarTipoServicoSchema = criarTipoServicoSchema.partial();

// ============================================================
// Rotas
// ============================================================

export async function tiposServicoRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get(
    '/tipos-servico',
    { onRequest: [app.authenticate] },
    async (request) => {
      const querySchema = z.object({
        ativo: z.coerce.boolean().optional(),
        etapaId: z.string().uuid().optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return { data: [] };
      }

      const { ativo, etapaId } = parsed.data;

      const tipos = await prisma.tipoServico.findMany({
        where: {
          ...(ativo !== undefined ? { ativo } : {}),
          ...(etapaId ? { etapaId } : {}),
        },
        include: {
          etapa: {
            select: { id: true, nome: true, ordemPadrao: true },
          },
        },
        orderBy: [{ etapa: { ordemPadrao: 'asc' } }, { nome: 'asc' }],
      });

      return { data: tipos };
    }
  );

  // ---------------- AUTOCOMPLETE ----------------
  app.get(
    '/tipos-servico/search',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const querySchema = z.object({
        q: z.string().min(1, 'q é obrigatório').max(200),
        limit: z.coerce.number().min(1).max(50).default(10),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Parâmetros inválidos',
          details: parsed.error.flatten(),
        });
      }

      const { q, limit } = parsed.data;

      const tipos = await prisma.tipoServico.findMany({
        where: {
          ativo: true,
          nome: { contains: q, mode: 'insensitive' },
        },
        include: {
          etapa: {
            select: { id: true, nome: true },
          },
        },
        orderBy: { nome: 'asc' },
        take: limit,
      });

      return { data: tipos };
    }
  );

  // ---------------- DETALHE ----------------
  app.get(
    '/tipos-servico/:id',
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

      const tipo = await prisma.tipoServico.findUnique({
        where: { id: parsed.data.id },
        include: {
          etapa: true,
        },
      });

      if (!tipo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Tipo de serviço não encontrado' });
      }

      return { data: tipo };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/tipos-servico',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = criarTipoServicoSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: parsed.error.flatten(),
        });
      }

      // Verifica se a etapa existe
      const etapa = await prisma.etapa.findUnique({
        where: { id: parsed.data.etapaId },
      });

      if (!etapa) {
        return reply.code(404).send({
          error: 'etapa_not_found',
          message: 'Etapa informada não existe',
        });
      }

      // Verifica unicidade do nome
      const existente = await prisma.tipoServico.findUnique({
        where: { nome: parsed.data.nome },
      });

      if (existente) {
        return reply.code(409).send({
          error: 'duplicate_name',
          message: 'Já existe um Tipo de Serviço com esse nome',
        });
      }

      // Verifica unicidade do código, se informado
      if (parsed.data.codigo != null) {
        const codigoExistente = await prisma.tipoServico.findUnique({
          where: { codigo: parsed.data.codigo },
        });
        if (codigoExistente) {
          return reply.code(409).send({
            error: 'duplicate_codigo',
            message: `Já existe um Tipo de Serviço com o código ${parsed.data.codigo}`,
          });
        }
      }

      const tipo = await prisma.tipoServico.create({
        data: parsed.data,
        include: { etapa: true },
      });

      return reply.code(201).send({ data: tipo });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.put(
    '/tipos-servico/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);

      if (!paramsParsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = atualizarTipoServicoSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const tipo = await prisma.tipoServico.findUnique({
        where: { id: paramsParsed.data.id },
      });

      if (!tipo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Tipo de serviço não encontrado' });
      }

      // Se mudou o nome, valida unicidade
      if (bodyParsed.data.nome && bodyParsed.data.nome !== tipo.nome) {
        const existente = await prisma.tipoServico.findUnique({
          where: { nome: bodyParsed.data.nome },
        });
        if (existente) {
          return reply.code(409).send({
            error: 'duplicate_name',
            message: 'Já existe um Tipo de Serviço com esse nome',
          });
        }
      }

      // Se mudou o código, valida unicidade
      if (
        bodyParsed.data.codigo != null &&
        bodyParsed.data.codigo !== tipo.codigo
      ) {
        const codigoExistente = await prisma.tipoServico.findUnique({
          where: { codigo: bodyParsed.data.codigo },
        });
        if (codigoExistente) {
          return reply.code(409).send({
            error: 'duplicate_codigo',
            message: `Já existe um Tipo de Serviço com o código ${bodyParsed.data.codigo}`,
          });
        }
      }

      // Se mudou a etapa, valida existência
      if (bodyParsed.data.etapaId && bodyParsed.data.etapaId !== tipo.etapaId) {
        const etapa = await prisma.etapa.findUnique({
          where: { id: bodyParsed.data.etapaId },
        });
        if (!etapa) {
          return reply.code(404).send({
            error: 'etapa_not_found',
            message: 'Etapa informada não existe',
          });
        }
      }

      const atualizado = await prisma.tipoServico.update({
        where: { id: paramsParsed.data.id },
        data: bodyParsed.data,
        include: { etapa: true },
      });

      return { data: atualizado };
    }
  );

  // ---------------- DESATIVAR (soft delete) ----------------
  app.delete(
    '/tipos-servico/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const tipo = await prisma.tipoServico.findUnique({
        where: { id: parsed.data.id },
      });

      if (!tipo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Tipo de serviço não encontrado' });
      }

      // Soft delete (desativa em vez de apagar)
      await prisma.tipoServico.update({
        where: { id: parsed.data.id },
        data: { ativo: false },
      });

      return { data: { id: parsed.data.id, desativado: true } };
    }
  );
}
