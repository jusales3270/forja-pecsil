// ============================================================
// Forja - Rotas de Etapas (estações)
// ============================================================
//
//   GET  /api/etapas              — lista etapas (ativas; ?incluirInativas=true p/ cadastro)
//   POST /api/etapas              — cria estação (admin)
//   PUT  /api/etapas/:id          — edita estação (admin)
//   GET  /api/etapas/:id/pipeline — fases internas da etapa e onde está cada OS
//
// Cada peça tem roteiro próprio: a estação existe para receber as operações
// que o PCP colocar no roteiro, não para impor uma ordem. ordemPadrao só
// organiza listas e colunas.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { montarPipelineEtapa } from '../lib/pipeline-etapa.js';

const selectEtapa = {
  id: true,
  nome: true,
  ordemPadrao: true,
  slaHoras: true,
  aplicaParaTipos: true,
  exigeCheckpointQualidade: true,
  ativa: true,
} as const;

const criarEtapaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  ordemPadrao: z.number().int().positive('Ordem deve ser >= 1').optional(),
  slaHoras: z.number().int().min(0).default(24),
  exigeCheckpointQualidade: z.boolean().default(false),
  ativa: z.boolean().default(true),
});

const atualizarEtapaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(120).optional(),
  ordemPadrao: z.number().int().positive('Ordem deve ser >= 1').optional(),
  slaHoras: z.number().int().min(0).optional(),
  exigeCheckpointQualidade: z.boolean().optional(),
  ativa: z.boolean().optional(),
});

async function nomeEmUso(nome: string, ignorarId?: string) {
  return prisma.etapa.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' }, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
    select: { id: true },
  });
}

export async function etapasRoutes(app: FastifyInstance) {
  app.get(
    '/etapas',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { incluirInativas } = z
        .object({ incluirInativas: z.enum(['true', 'false']).optional() })
        .catch({})
        .parse(request.query);

      const etapas = await prisma.etapa.findMany({
        where: incluirInativas === 'true' ? {} : { ativa: true },
        orderBy: { ordemPadrao: 'asc' },
        select: selectEtapa,
      });

      return { data: etapas };
    }
  );

  // ---------------- CRIAR ESTAÇÃO ----------------
  app.post('/etapas', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const parsed = criarEtapaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const dados = parsed.data;

    if (await nomeEmUso(dados.nome)) {
      return reply.code(409).send({ error: 'duplicate_name', message: `Já existe uma estação chamada "${dados.nome}"` });
    }

    // Sem ordem informada, a estação nova entra no fim da lista
    let ordemPadrao = dados.ordemPadrao;
    if (ordemPadrao == null) {
      const ultima = await prisma.etapa.aggregate({ _max: { ordemPadrao: true } });
      ordemPadrao = (ultima._max.ordemPadrao ?? 0) + 1;
    } else if (await prisma.etapa.findUnique({ where: { ordemPadrao }, select: { id: true } })) {
      return reply.code(409).send({ error: 'duplicate_ordem', message: `A ordem ${ordemPadrao} já é usada por outra estação` });
    }

    const etapa = await prisma.etapa.create({
      data: {
        nome: dados.nome,
        ordemPadrao,
        slaHoras: dados.slaHoras,
        exigeCheckpointQualidade: dados.exigeCheckpointQualidade,
        ativa: dados.ativa,
        aplicaParaTipos: [],
      },
      select: selectEtapa,
    });

    return reply.code(201).send({ data: etapa });
  });

  // ---------------- EDITAR ESTAÇÃO ----------------
  app.put('/etapas/:id', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    }
    const parsed = atualizarEtapaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const id = params.data.id;
    const dados = parsed.data;

    const atual = await prisma.etapa.findUnique({ where: { id }, select: { id: true, ordemPadrao: true } });
    if (!atual) {
      return reply.code(404).send({ error: 'not_found', message: 'Estação não encontrada' });
    }
    if (dados.nome && (await nomeEmUso(dados.nome, id))) {
      return reply.code(409).send({ error: 'duplicate_name', message: `Já existe uma estação chamada "${dados.nome}"` });
    }
    if (dados.ordemPadrao != null && dados.ordemPadrao !== atual.ordemPadrao) {
      const ocupada = await prisma.etapa.findUnique({ where: { ordemPadrao: dados.ordemPadrao }, select: { id: true } });
      if (ocupada) {
        return reply.code(409).send({ error: 'duplicate_ordem', message: `A ordem ${dados.ordemPadrao} já é usada por outra estação` });
      }
    }

    // Desativar esconderia OPs em aberto dos tótens: bloqueia enquanto houver trabalho lá
    if (dados.ativa === false) {
      const emAberto = await prisma.oPLote.count({ where: { etapaId: id, status: { not: 'concluida' } } });
      if (emAberto > 0) {
        return reply.code(409).send({
          error: 'estacao_com_ops',
          message: `A estação tem ${emAberto} OP(s) em aberto. Conclua ou mova essas OPs antes de desativar.`,
        });
      }
    }

    const etapa = await prisma.etapa.update({ where: { id }, data: dados, select: selectEtapa });
    return { data: etapa };
  });

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
