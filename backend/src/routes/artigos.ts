// ============================================================
// Forja - Rotas de Artigo
// ============================================================
// Endpoints:
//   GET    /api/artigos                          — lista (com filtros)
//   GET    /api/artigos/:id                      — detalhe completo
//   POST   /api/artigos                          — criar (status: rascunho)
//   PUT    /api/artigos/:id                      — atualizar campos
//   DELETE /api/artigos/:id                      — soft delete (ativo=false)
//
//   POST   /api/artigos/:id/ativar               — rascunho -> ativo
//   POST   /api/artigos/:id/arquivar             — ativo -> arquivado
//   POST   /api/artigos/:id/desarquivar          — arquivado -> ativo
//   POST   /api/artigos/:id/voltar-rascunho      — ativo -> rascunho
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { StatusArtigo, TipoProduto } from '@prisma/client';

// ============================================================
// Schemas de validação
// ============================================================

const tipoProdutoEnum = z.enum([
  'forma',
  'bloco',
  'fundo_forma',
  'fundo_bloco',
  'molde',
  'arruela',
  'cabeca_sopro',
  'forminha',
  'puncao',
  'funil',
]);

const artigoBaseSchema = z.object({
  codigo: z
    .string()
    .min(1, 'Código é obrigatório')
    .max(100, 'Código muito longo'),
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(500, 'Descrição muito longa'),
  tipoProduto: tipoProdutoEnum,
  clienteId: z.string().uuid('clienteId inválido').optional(),
  clienteNome: z.string().min(1).max(200).optional(),
  material: z.string().max(200).nullable().optional(),
  poPadrao: z.string().max(100).nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const criarArtigoSchema = artigoBaseSchema.refine(
  (d) => d.clienteId || d.clienteNome,
  { message: 'clienteId ou clienteNome é obrigatório', path: ['clienteId'] },
);

const atualizarArtigoSchema = artigoBaseSchema.partial();

const statusArtigoEnum = z.enum(['rascunho', 'ativo', 'arquivado']);

// ============================================================
// Rotas
// ============================================================

export async function artigosRoutes(app: FastifyInstance) {
  // ---------------- LISTA (com filtros) ----------------
  app.get(
    '/artigos',
    { onRequest: [app.authenticate] },
    async (request) => {
      const querySchema = z.object({
        clienteId: z.string().uuid().optional(),
        status: statusArtigoEnum.optional(),
        tipoProduto: tipoProdutoEnum.optional(),
        q: z.string().max(200).optional(),
        ativo: z.coerce.boolean().optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return { data: [] };
      }

      const { clienteId, status, tipoProduto, q, ativo } = parsed.data;

      const artigos = await prisma.artigo.findMany({
        where: {
          ...(clienteId ? { clienteId } : {}),
          ...(status ? { status } : {}),
          ...(tipoProduto ? { tipoProduto } : {}),
          ...(ativo !== undefined ? { ativo } : { ativo: true }),
          ...(q
            ? {
                OR: [
                  { codigo: { contains: q, mode: 'insensitive' } },
                  { descricao: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          cliente: { select: { id: true, nome: true } },
          criadoPor: { select: { id: true, nome: true } },
          _count: {
            select: { desenhos: true, operacoes: true },
          },
        },
        orderBy: { atualizadoEm: 'desc' },
      });

      return { data: artigos };
    }
  );

  // ---------------- DETALHE COMPLETO ----------------
  app.get(
    '/artigos/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const artigo = await prisma.artigo.findUnique({
        where: { id: parsed.data.id },
        include: {
          cliente: true,
          criadoPor: { select: { id: true, nome: true, papel: true } },
          desenhos: { orderBy: { criadoEm: 'asc' } },
          operacoes: {
            include: {
              etapa: { select: { id: true, nome: true, ordemPadrao: true } },
              tipoServicoRel: {
                select: { id: true, nome: true, exigeInspecao: true },
              },
              planoInspecao: {
                include: {
                  cotas: { orderBy: { ordem: 'asc' } },
                },
              },
            },
            orderBy: { ordem: 'asc' },
          },
        },
      });

      if (!artigo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Artigo não encontrado' });
      }

      return { data: artigo };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/artigos',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = criarArtigoSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: parsed.error.flatten(),
        });
      }

      // Resolver clienteId: se veio clienteNome, faz find-or-create
      let clienteId = parsed.data.clienteId;

      if (!clienteId && parsed.data.clienteNome) {
        const nomeNormalizado = parsed.data.clienteNome.trim();
        let cliente = await prisma.cliente.findFirst({
          where: { nome: { equals: nomeNormalizado, mode: 'insensitive' } },
        });
        if (!cliente) {
          cliente = await prisma.cliente.create({
            data: { nome: nomeNormalizado },
          });
        }
        clienteId = cliente.id;
      } else {
        // Verifica se cliente existe pelo ID
        const cliente = await prisma.cliente.findUnique({
          where: { id: clienteId! },
        });
        if (!cliente) {
          return reply.code(404).send({
            error: 'cliente_not_found',
            message: 'Cliente não encontrado',
          });
        }
      }

      // Verifica unicidade de código + cliente
      const existente = await prisma.artigo.findUnique({
        where: {
          codigo_clienteId: {
            codigo: parsed.data.codigo,
            clienteId: clienteId!,
          },
        },
      });

      if (existente) {
        return reply.code(409).send({
          error: 'duplicate_codigo_cliente',
          message: `Já existe um Artigo com o código "${parsed.data.codigo}" para esse cliente`,
        });
      }

      // Pega usuário autenticado (do JWT)
      const pessoaId = (request.user as any).pessoaId;

      const { clienteNome, ...dadosLimpos } = parsed.data;
      const artigo = await prisma.artigo.create({
        data: {
          ...dadosLimpos,
          clienteId: clienteId!,
          status: 'rascunho',
          criadoPorId: pessoaId,
        },
        include: {
          cliente: { select: { id: true, nome: true } },
          criadoPor: { select: { id: true, nome: true } },
        },
      });

      return reply.code(201).send({ data: artigo });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.put(
    '/artigos/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);

      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = atualizarArtigoSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const artigo = await prisma.artigo.findUnique({
        where: { id: paramsParsed.data.id },
      });

      if (!artigo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Artigo não encontrado' });
      }

      // Se mudou cliente, valida existência
      if (
        bodyParsed.data.clienteId &&
        bodyParsed.data.clienteId !== artigo.clienteId
      ) {
        const cliente = await prisma.cliente.findUnique({
          where: { id: bodyParsed.data.clienteId },
        });
        if (!cliente) {
          return reply.code(404).send({
            error: 'cliente_not_found',
            message: 'Cliente não encontrado',
          });
        }
      }

      // Se mudou código ou cliente, valida unicidade
      const novoCodigo = bodyParsed.data.codigo ?? artigo.codigo;
      const novoClienteId = bodyParsed.data.clienteId ?? artigo.clienteId;
      if (novoCodigo !== artigo.codigo || novoClienteId !== artigo.clienteId) {
        const existente = await prisma.artigo.findUnique({
          where: {
            codigo_clienteId: {
              codigo: novoCodigo,
              clienteId: novoClienteId,
            },
          },
        });
        if (existente && existente.id !== artigo.id) {
          return reply.code(409).send({
            error: 'duplicate_codigo_cliente',
            message: `Já existe um Artigo com o código "${novoCodigo}" para esse cliente`,
          });
        }
      }

      const atualizado = await prisma.artigo.update({
        where: { id: paramsParsed.data.id },
        data: bodyParsed.data,
        include: {
          cliente: { select: { id: true, nome: true } },
        },
      });

      return { data: atualizado };
    }
  );

  // ---------------- DELETAR (soft delete) ----------------
  app.delete(
    '/artigos/:id',
    { onRequest: [app.requireExcluir] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);

      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const artigo = await prisma.artigo.findUnique({
        where: { id: parsed.data.id },
      });

      if (!artigo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Artigo não encontrado' });
      }

      await prisma.artigo.update({
        where: { id: parsed.data.id },
        data: { ativo: false },
      });

      return { data: { id: parsed.data.id, desativado: true } };
    }
  );

  // ============================================================
  // AÇÕES DE MUDANÇA DE STATUS
  // ============================================================

  // Helper: muda status do artigo se a transição for válida
  async function mudarStatus(
    request: any,
    reply: any,
    statusEsperadoAtual: StatusArtigo[],
    statusNovo: StatusArtigo,
    validacaoExtra?: (artigoId: string) => Promise<string | null>
  ) {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const parsed = paramsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid_input', message: 'ID inválido' });
    }

    const artigo = await prisma.artigo.findUnique({
      where: { id: parsed.data.id },
    });

    if (!artigo) {
      return reply
        .code(404)
        .send({ error: 'not_found', message: 'Artigo não encontrado' });
    }

    if (!statusEsperadoAtual.includes(artigo.status)) {
      return reply.code(409).send({
        error: 'invalid_state_transition',
        message: `Não é possível mudar para "${statusNovo}" a partir do status atual "${artigo.status}"`,
        statusAtual: artigo.status,
      });
    }

    // Validação extra opcional
    if (validacaoExtra) {
      const erro = await validacaoExtra(parsed.data.id);
      if (erro) {
        return reply.code(409).send({
          error: 'validation_failed',
          message: erro,
        });
      }
    }

    const atualizado = await prisma.artigo.update({
      where: { id: parsed.data.id },
      data: { status: statusNovo },
    });

    return { data: atualizado };
  }

  // ---------------- ATIVAR (rascunho -> ativo) ----------------
  app.post(
    '/artigos/:id/ativar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      return mudarStatus(request, reply, ['rascunho'], 'ativo', async (id) => {
        // Validação: Artigo precisa ter pelo menos uma operação
        const count = await prisma.operacaoArtigo.count({
          where: { artigoId: id },
        });
        if (count === 0) {
          return 'Artigo precisa ter ao menos uma operação cadastrada para ser ativado';
        }
        return null;
      });
    }
  );

  // ---------------- ARQUIVAR (ativo -> arquivado) ----------------
  app.post(
    '/artigos/:id/arquivar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      return mudarStatus(request, reply, ['ativo'], 'arquivado');
    }
  );

  // ---------------- DESARQUIVAR (arquivado -> ativo) ----------------
  app.post(
    '/artigos/:id/desarquivar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      return mudarStatus(request, reply, ['arquivado'], 'ativo');
    }
  );

  // ---------------- VOLTAR PARA RASCUNHO (ativo -> rascunho) ----------------
  app.post(
    '/artigos/:id/voltar-rascunho',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      return mudarStatus(request, reply, ['ativo'], 'rascunho');
    }
  );
}
