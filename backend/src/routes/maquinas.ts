// ============================================================
// Forja - Rotas de Máquinas
// ============================================================
//
//   GET  /api/maquinas      — lista (filtros etapaId, ativa)
//   POST /api/maquinas      — cria máquina numa estação (admin)
//   PUT  /api/maquinas/:id  — edita máquina (admin)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma, TipoMaquina } from '@prisma/client';
import { prisma } from '../db/prisma.js';

const listaQuerySchema = z.object({
  etapaId: z.string().uuid().optional(),
  ativa: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const criarMaquinaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  codigoInterno: z.string().trim().min(1, 'Código interno é obrigatório').max(60),
  tipo: z.nativeEnum(TipoMaquina),
  etapaId: z.string().uuid('Estação inválida'),
  ativa: z.boolean().default(true),
});

const atualizarMaquinaSchema = criarMaquinaSchema.partial();

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

  // ---------------- CRIAR ----------------
  app.post('/maquinas', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const parsed = criarMaquinaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const dados = parsed.data;

    if (!(await prisma.etapa.findUnique({ where: { id: dados.etapaId }, select: { id: true } }))) {
      return reply.code(404).send({ error: 'etapa_not_found', message: 'Estação informada não existe' });
    }
    if (await prisma.maquina.findUnique({ where: { codigoInterno: dados.codigoInterno }, select: { id: true } })) {
      return reply.code(409).send({ error: 'duplicate_codigo', message: `Já existe uma máquina com o código ${dados.codigoInterno}` });
    }

    const maquina = await prisma.maquina.create({
      data: dados,
      include: { etapa: { select: { id: true, nome: true } } },
    });
    return reply.code(201).send({ data: maquina });
  });

  // ---------------- EDITAR ----------------
  app.put('/maquinas/:id', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    }
    const parsed = atualizarMaquinaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const id = params.data.id;
    const dados = parsed.data;

    const atual = await prisma.maquina.findUnique({ where: { id }, select: { id: true, codigoInterno: true, etapaId: true } });
    if (!atual) {
      return reply.code(404).send({ error: 'not_found', message: 'Máquina não encontrada' });
    }
    if (dados.codigoInterno && dados.codigoInterno !== atual.codigoInterno) {
      if (await prisma.maquina.findUnique({ where: { codigoInterno: dados.codigoInterno }, select: { id: true } })) {
        return reply.code(409).send({ error: 'duplicate_codigo', message: `Já existe uma máquina com o código ${dados.codigoInterno}` });
      }
    }
    if (dados.etapaId && dados.etapaId !== atual.etapaId) {
      if (!(await prisma.etapa.findUnique({ where: { id: dados.etapaId }, select: { id: true } }))) {
        return reply.code(404).send({ error: 'etapa_not_found', message: 'Estação informada não existe' });
      }
    }

    // Máquina com OP rodando não muda de estação nem é desativada no meio do trabalho
    if ((dados.etapaId && dados.etapaId !== atual.etapaId) || dados.ativa === false) {
      const emUso = await prisma.carimbo.count({ where: { maquinaId: id, timestampSaida: null } });
      if (emUso > 0) {
        return reply.code(409).send({
          error: 'maquina_em_uso',
          message: 'A máquina tem OP em execução. Encerre a OP antes de mover ou desativar a máquina.',
        });
      }
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: dados,
      include: { etapa: { select: { id: true, nome: true } } },
    });
    return { data: maquina };
  });
}
