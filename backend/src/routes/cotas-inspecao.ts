// ============================================================
// Forja - Rotas de Cotas de Inspeção (aninhadas em PlanoInspecao)
// ============================================================
//
//   GET    /api/artigos/:artigoId/operacoes/:opId/plano/cotas              — lista (ordenada)
//   POST   /api/artigos/:artigoId/operacoes/:opId/plano/cotas              — cria
//   PATCH  /api/artigos/:artigoId/operacoes/:opId/plano/cotas/:cotaId      — atualiza
//   DELETE /api/artigos/:artigoId/operacoes/:opId/plano/cotas/:cotaId      — remove (se sem medições)
//   POST   /api/artigos/:artigoId/operacoes/:opId/plano/cotas/reordenar    — bulk reorder
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  CaracteristicaCota,
  FrequenciaMedicao,
  InstrumentoMedicao,
} from '@prisma/client';

// ============================================================
// Enums
// ============================================================

const caracteristicaEnum = z.enum(['funcional', 'critica', 'processo']);

const frequenciaEnum = z.enum([
  'todas',
  'primeira',
  'um_em_3',
  'um_em_5',
  'um_em_10',
  'na_preparacao',
]);

const instrumentoEnum = z.enum([
  'paq_digital',
  'comparador',
  'altimetro',
  'micrometro',
  'renishaw',
  'visual',
  'metrologia',
  'outros',
]);

// ============================================================
// Schemas
// ============================================================

const criarCotaSchema = z
  .object({
    codigoCota: z.string().min(1, 'codigoCota é obrigatório').max(50),
    valorNominal: z.number(),
    toleranciaMais: z.number().min(0, 'toleranciaMais deve ser >= 0').optional(),
    toleranciaMenos: z
      .number()
      .min(0, 'toleranciaMenos deve ser >= 0 (valor absoluto)')
      .optional(),
    caracteristica: caracteristicaEnum,
    frequenciaMonitorar: frequenciaEnum,
    frequenciaRegistrar: frequenciaEnum,
    instrumento: instrumentoEnum,
    ordem: z.number().int().nonnegative('ordem deve ser >= 0'),
    observacoes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) => {
      // Se as duas tolerâncias vierem, pelo menos uma deve ser > 0
      if (d.toleranciaMais !== undefined && d.toleranciaMenos !== undefined) {
        return d.toleranciaMais > 0 || d.toleranciaMenos > 0;
      }
      return true;
    },
    {
      message:
        'Quando ambas as tolerâncias forem informadas, pelo menos uma deve ser > 0',
      path: ['toleranciaMais'],
    }
  );

const atualizarCotaSchema = z
  .object({
    codigoCota: z.string().min(1).max(50).optional(),
    valorNominal: z.number().optional(),
    toleranciaMais: z.number().min(0).optional().nullable(),
    toleranciaMenos: z.number().min(0).optional().nullable(),
    caracteristica: caracteristicaEnum.optional(),
    frequenciaMonitorar: frequenciaEnum.optional(),
    frequenciaRegistrar: frequenciaEnum.optional(),
    instrumento: instrumentoEnum.optional(),
    ordem: z.number().int().nonnegative().optional(),
    observacoes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) => {
      if (
        d.toleranciaMais !== undefined &&
        d.toleranciaMais !== null &&
        d.toleranciaMenos !== undefined &&
        d.toleranciaMenos !== null
      ) {
        return d.toleranciaMais > 0 || d.toleranciaMenos > 0;
      }
      return true;
    },
    {
      message:
        'Quando ambas as tolerâncias forem informadas, pelo menos uma deve ser > 0',
      path: ['toleranciaMais'],
    }
  );

const reordenarSchema = z.object({
  ordens: z
    .array(
      z.object({
        id: z.string().uuid(),
        ordem: z.number().int().nonnegative(),
      })
    )
    .min(1, 'Lista de ordens não pode estar vazia'),
});

// ============================================================
// Helpers
// ============================================================

async function carregarPlanoDaOperacao(artigoId: string, opId: string) {
  const op = await prisma.operacaoArtigo.findFirst({
    where: { id: opId, artigoId },
    select: { id: true },
  });
  if (!op) return { erro: 'operacao_nao_encontrada' as const };

  const plano = await prisma.planoInspecao.findUnique({
    where: { operacaoArtigoId: opId },
    select: { id: true },
  });
  if (!plano) return { erro: 'plano_nao_encontrado' as const };

  return { planoId: plano.id };
}

// ============================================================
// Rotas
// ============================================================

export async function cotasInspecaoRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get(
    '/artigos/:artigoId/operacoes/:opId/plano/cotas',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const ctx = await carregarPlanoDaOperacao(artigoId, opId);
      if ('erro' in ctx) {
        return reply.code(404).send({
          error: ctx.erro,
          message:
            ctx.erro === 'operacao_nao_encontrada'
              ? 'Operação não encontrada para esse artigo'
              : 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const cotas = await prisma.cotaInspecao.findMany({
        where: { planoInspecaoId: ctx.planoId },
        orderBy: [{ ordem: 'asc' }, { codigoCota: 'asc' }],
      });

      return { data: cotas };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/artigos/:artigoId/operacoes/:opId/plano/cotas',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const ctx = await carregarPlanoDaOperacao(artigoId, opId);
      if ('erro' in ctx) {
        return reply.code(404).send({
          error: ctx.erro,
          message:
            ctx.erro === 'operacao_nao_encontrada'
              ? 'Operação não encontrada para esse artigo'
              : 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const parsed = criarCotaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      // Bloqueia duplicidade de codigoCota no mesmo plano (sem unique no banco)
      const duplicada = await prisma.cotaInspecao.findFirst({
        where: {
          planoInspecaoId: ctx.planoId,
          codigoCota: parsed.data.codigoCota,
        },
        select: { id: true },
      });

      if (duplicada) {
        return reply.code(409).send({
          error: 'duplicate_codigo_cota',
          message: `Já existe uma cota com o código "${parsed.data.codigoCota}" neste plano`,
        });
      }

      const cota = await prisma.cotaInspecao.create({
        data: {
          planoInspecaoId: ctx.planoId,
          codigoCota: parsed.data.codigoCota,
          valorNominal: parsed.data.valorNominal,
          toleranciaMais: parsed.data.toleranciaMais,
          toleranciaMenos: parsed.data.toleranciaMenos,
          caracteristica: parsed.data.caracteristica as CaracteristicaCota,
          frequenciaMonitorar: parsed.data.frequenciaMonitorar as FrequenciaMedicao,
          frequenciaRegistrar: parsed.data.frequenciaRegistrar as FrequenciaMedicao,
          instrumento: parsed.data.instrumento as InstrumentoMedicao,
          ordem: parsed.data.ordem,
          observacoes: parsed.data.observacoes,
        },
      });

      return reply.code(201).send({ data: cota });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.patch(
    '/artigos/:artigoId/operacoes/:opId/plano/cotas/:cotaId',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId, cotaId } = request.params as {
        artigoId: string;
        opId: string;
        cotaId: string;
      };

      const ctx = await carregarPlanoDaOperacao(artigoId, opId);
      if ('erro' in ctx) {
        return reply.code(404).send({
          error: ctx.erro,
          message:
            ctx.erro === 'operacao_nao_encontrada'
              ? 'Operação não encontrada para esse artigo'
              : 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const parsed = atualizarCotaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const atual = await prisma.cotaInspecao.findFirst({
        where: { id: cotaId, planoInspecaoId: ctx.planoId },
      });

      if (!atual) {
        return reply.code(404).send({
          error: 'cota_nao_encontrada',
          message: 'Cota não encontrada neste plano',
        });
      }

      // Se mudou o codigoCota, valida duplicidade
      if (
        parsed.data.codigoCota !== undefined &&
        parsed.data.codigoCota !== atual.codigoCota
      ) {
        const conflito = await prisma.cotaInspecao.findFirst({
          where: {
            planoInspecaoId: ctx.planoId,
            codigoCota: parsed.data.codigoCota,
            NOT: { id: cotaId },
          },
          select: { id: true },
        });

        if (conflito) {
          return reply.code(409).send({
            error: 'duplicate_codigo_cota',
            message: `Já existe uma cota com o código "${parsed.data.codigoCota}" neste plano`,
          });
        }
      }

      const atualizada = await prisma.cotaInspecao.update({
        where: { id: cotaId },
        data: {
          codigoCota: parsed.data.codigoCota,
          valorNominal: parsed.data.valorNominal,
          toleranciaMais:
            parsed.data.toleranciaMais === undefined
              ? undefined
              : parsed.data.toleranciaMais,
          toleranciaMenos:
            parsed.data.toleranciaMenos === undefined
              ? undefined
              : parsed.data.toleranciaMenos,
          caracteristica: parsed.data.caracteristica as
            | CaracteristicaCota
            | undefined,
          frequenciaMonitorar: parsed.data.frequenciaMonitorar as
            | FrequenciaMedicao
            | undefined,
          frequenciaRegistrar: parsed.data.frequenciaRegistrar as
            | FrequenciaMedicao
            | undefined,
          instrumento: parsed.data.instrumento as InstrumentoMedicao | undefined,
          ordem: parsed.data.ordem,
          observacoes:
            parsed.data.observacoes === undefined
              ? undefined
              : parsed.data.observacoes,
        },
      });

      return { data: atualizada };
    }
  );

  // ---------------- DELETAR ----------------
  app.delete(
    '/artigos/:artigoId/operacoes/:opId/plano/cotas/:cotaId',
    { onRequest: [app.requireExcluir] },
    async (request, reply) => {
      const { artigoId, opId, cotaId } = request.params as {
        artigoId: string;
        opId: string;
        cotaId: string;
      };

      const ctx = await carregarPlanoDaOperacao(artigoId, opId);
      if ('erro' in ctx) {
        return reply.code(404).send({
          error: ctx.erro,
          message:
            ctx.erro === 'operacao_nao_encontrada'
              ? 'Operação não encontrada para esse artigo'
              : 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const cota = await prisma.cotaInspecao.findFirst({
        where: { id: cotaId, planoInspecaoId: ctx.planoId },
        include: { _count: { select: { medicoes: true } } },
      });

      if (!cota) {
        return reply.code(404).send({
          error: 'cota_nao_encontrada',
          message: 'Cota não encontrada neste plano',
        });
      }

      if (cota._count.medicoes > 0) {
        return reply.code(409).send({
          error: 'cota_com_medicoes',
          message: `Esta cota já tem ${cota._count.medicoes} medição(ões) registrada(s) e não pode ser removida. Considere desativá-la ou criar uma revisão.`,
        });
      }

      await prisma.cotaInspecao.delete({ where: { id: cotaId } });

      return reply.code(204).send();
    }
  );

  // ---------------- REORDENAR (bulk) ----------------
  app.post(
    '/artigos/:artigoId/operacoes/:opId/plano/cotas/reordenar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, opId } = request.params as {
        artigoId: string;
        opId: string;
      };

      const ctx = await carregarPlanoDaOperacao(artigoId, opId);
      if ('erro' in ctx) {
        return reply.code(404).send({
          error: ctx.erro,
          message:
            ctx.erro === 'operacao_nao_encontrada'
              ? 'Operação não encontrada para esse artigo'
              : 'Esta operação ainda não tem Plano de Inspeção',
        });
      }

      const parsed = reordenarSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const ids = parsed.data.ordens.map((o) => o.id);
      const existentes = await prisma.cotaInspecao.findMany({
        where: { id: { in: ids }, planoInspecaoId: ctx.planoId },
        select: { id: true },
      });

      if (existentes.length !== ids.length) {
        return reply.code(400).send({
          error: 'cotas_invalidas',
          message:
            'Uma ou mais cotas da lista não pertencem a este plano ou não existem.',
        });
      }

      await prisma.$transaction(
        parsed.data.ordens.map((o) =>
          prisma.cotaInspecao.update({
            where: { id: o.id },
            data: { ordem: o.ordem },
          })
        )
      );

      const atualizadas = await prisma.cotaInspecao.findMany({
        where: { planoInspecaoId: ctx.planoId },
        orderBy: [{ ordem: 'asc' }, { codigoCota: 'asc' }],
      });

      return { data: atualizadas };
    }
  );
}
