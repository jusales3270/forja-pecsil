// ============================================================
// Forja - Rotas de Plano de Inspeção (aninhadas em OperacaoArtigo)
// ============================================================
//
//   GET    /api/artigos/:artigoId/operacoes/:opId/plano   — pega o plano (com cotas)
//   POST   /api/artigos/:artigoId/operacoes/:opId/plano   — cria plano (idempotente)
//   PATCH  /api/artigos/:artigoId/operacoes/:opId/plano   — atualiza observacoesGerais
//   DELETE /api/artigos/:artigoId/operacoes/:opId/plano   — remove plano (cascade nas cotas)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const atualizarPlanoSchema = z.object({
  observacoesGerais: z.string().max(2000).optional().nullable(),
});

async function garantirOperacaoExisteNoArtigo(artigoId: string, opId: string) {
  return prisma.operacaoArtigo.findFirst({
    where: { id: opId, artigoId },
    select: { id: true },
  });
}

export async function planosInspecaoRoutes(app: FastifyInstance) {
  // ---------------- GET ----------------
  app.get(
    '/artigos/:artigoId/operacoes/:opId/plano',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const op = await garantirOperacaoExisteNoArtigo(artigoId, opId);
      if (!op) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada para esse artigo',
        });
      }

      const plano = await prisma.planoInspecao.findUnique({
        where: { operacaoArtigoId: opId },
        include: {
          cotas: {
            orderBy: [{ ordem: 'asc' }, { codigoCota: 'asc' }],
          },
        },
      });

      if (!plano) {
        return reply.code(404).send({
          error: 'plano_nao_encontrado',
          message: 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      return { data: plano };
    }
  );

  // ---------------- CRIAR (idempotente) ----------------
  app.post(
    '/artigos/:artigoId/operacoes/:opId/plano',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const op = await garantirOperacaoExisteNoArtigo(artigoId, opId);
      if (!op) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada para esse artigo',
        });
      }

      // Body opcional: pode mandar observacoesGerais já no create
      const parsed = atualizarPlanoSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const existente = await prisma.planoInspecao.findUnique({
        where: { operacaoArtigoId: opId },
      });

      if (existente) {
        // Idempotente: retorna o existente sem erro
        return reply.code(200).send({ data: existente });
      }

      const plano = await prisma.planoInspecao.create({
        data: {
          operacaoArtigoId: opId,
          observacoesGerais: parsed.data.observacoesGerais ?? null,
        },
      });

      return reply.code(201).send({ data: plano });
    }
  );

  // ---------------- ATUALIZAR observacoesGerais ----------------
  app.patch(
    '/artigos/:artigoId/operacoes/:opId/plano',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const op = await garantirOperacaoExisteNoArtigo(artigoId, opId);
      if (!op) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada para esse artigo',
        });
      }

      const parsed = atualizarPlanoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const existente = await prisma.planoInspecao.findUnique({
        where: { operacaoArtigoId: opId },
      });

      if (!existente) {
        return reply.code(404).send({
          error: 'plano_nao_encontrado',
          message: 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const atualizado = await prisma.planoInspecao.update({
        where: { operacaoArtigoId: opId },
        data: {
          observacoesGerais:
            parsed.data.observacoesGerais === undefined
              ? undefined
              : parsed.data.observacoesGerais,
        },
      });

      return { data: atualizado };
    }
  );

  // ---------------- DELETAR ----------------
  app.delete(
    '/artigos/:artigoId/operacoes/:opId/plano',
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const op = await garantirOperacaoExisteNoArtigo(artigoId, opId);
      if (!op) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada para esse artigo',
        });
      }

      const existente = await prisma.planoInspecao.findUnique({
        where: { operacaoArtigoId: opId },
      });

      if (!existente) {
        return reply.code(404).send({
          error: 'plano_nao_encontrado',
          message: 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      await prisma.planoInspecao.delete({
        where: { operacaoArtigoId: opId },
      });

      return reply.code(204).send();
    }
  );
}
