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
  // Posição do serviço dentro da etapa. Nulo = etapa de processo único.
  // Preenchido só onde a etapa tem operações internas (fundição).
  ordemNaEtapa: z.number().int().positive('ordemNaEtapa deve ser >= 1').nullable().optional(),
  exigeInspecao: z.boolean().default(false),
  ativo: z.boolean().optional(),
  observacoes: z.string().nullable().optional(),

});

const atualizarTipoServicoSchema = criarTipoServicoSchema.partial().extend({
  // Ao trocar a estação do tipo, leva junto as operações dos artigos (OS
  // futuras) e as OPs ainda não iniciadas (OS em andamento).
  propagarEtapa: z.boolean().optional(),
});

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
        // Dentro da etapa, quem tem ordem de fase vem na sequência produtiva;
        // o resto (etapas de processo único) segue alfabético como sempre.
        orderBy: [
          { etapa: { ordemPadrao: 'asc' } },
          { ordemNaEtapa: 'asc' },
          { nome: 'asc' },
        ],
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

      const { propagarEtapa, ...dados } = bodyParsed.data;
      const etapaNova = dados.etapaId && dados.etapaId !== tipo.etapaId ? dados.etapaId : null;

      const resultado = await prisma.$transaction(async (tx) => {
        const atualizado = await tx.tipoServico.update({
          where: { id: tipo.id },
          data: dados,
          include: { etapa: true },
        });

        if (!etapaNova || !propagarEtapa) {
          return { atualizado, operacoesMovidas: 0, opsMovidas: [] as { id: string; etapaId: string }[] };
        }

        // Operações cadastradas na mão não têm a FK — casam pelo nome, que é único
        const doTipo = {
          OR: [
            { tipoServicoId: tipo.id },
            { tipoServicoId: null, tipoServico: { equals: tipo.nome, mode: 'insensitive' as const } },
          ],
        };

        const { count: operacoesMovidas } = await tx.operacaoArtigo.updateMany({
          where: doTipo,
          data: { etapaId: etapaNova },
        });

        // Só OPs que ainda não começaram: sem peça feita, sem carimbo aberto,
        // sem envio externo. As demais terminam onde estão.
        const opsMovidas = await tx.oPLote.findMany({
          where: {
            operacaoArtigo: doTipo,
            etapaId: { not: etapaNova },
            status: 'na_fila',
            quantidadeConcluida: 0,
            envioExternoEm: null,
            carimbos: { none: { timestampSaida: null } },
          },
          select: { id: true, etapaId: true },
        });
        if (opsMovidas.length > 0) {
          await tx.oPLote.updateMany({
            where: { id: { in: opsMovidas.map((o) => o.id) } },
            data: { etapaId: etapaNova },
          });
        }

        return { atualizado, operacoesMovidas, opsMovidas };
      });

      if (etapaNova && resultado.opsMovidas.length > 0) {
        for (const etapaAntiga of new Set(resultado.opsMovidas.map((o) => o.etapaId))) {
          app.io.to(`estacao:${etapaAntiga}`).emit('op:encerrada', { etapaId: etapaAntiga });
        }
        for (const op of resultado.opsMovidas) {
          app.io.to(`estacao:${etapaNova}`).emit('op:nova-na-fila', { opLoteId: op.id, etapaId: etapaNova });
        }
      }

      return {
        data: resultado.atualizado,
        meta: {
          operacoesArtigoMovidas: resultado.operacoesMovidas,
          opsLoteMovidas: resultado.opsMovidas.length,
        },
      };
    }
  );

  // ---------------- DESATIVAR (soft delete) ----------------
  app.delete(
    '/tipos-servico/:id',
    { onRequest: [app.requireAdmin] },
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
