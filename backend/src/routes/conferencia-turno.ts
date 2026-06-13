// ============================================================
// Forja - Conferencia de Fim de Turno (Sprint 4 - Bloco B)
// Fim de turno e CONFERENCIA, nao digitacao: o sistema soma os
// ApontamentoPeca do dia (Bloco A) e o operador confirma/ajusta.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

function inicioFimDoDia(dataISO?: string) {
  const base = dataISO ? new Date(dataISO) : new Date();
  const inicio = new Date(base);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(base);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

const previaQuerySchema = z.object({
  data: z.string().datetime({ offset: true }).optional(),
});

const linhaSchema = z.object({
  maquinaId: z.string().uuid(),
  maquinaNome: z.string(),
  contadoSistema: z.number().int().nonnegative(),
  ajustado: z.number().int().nonnegative(),
  justificativa: z.string().max(500).nullable().optional(),
});

const fecharSchema = z.object({
  data: z.string().datetime({ offset: true }).optional(),
  linhas: z.array(linhaSchema),
  observacoes: z.string().max(2000).nullable().optional(),
});

export async function conferenciaTurnoRoutes(app: FastifyInstance) {
  // GET /api/conferencia-turno/previa  -> o que o sistema contou hoje, por maquina
  app.get(
    '/conferencia-turno/previa',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { data } = previaQuerySchema.parse(request.query);
      const operadorId = (request.user as any).pessoaId;
      const { inicio, fim } = inicioFimDoDia(data);

      const pecas = await prisma.apontamentoPeca.findMany({
        where: { operadorId, criadoEm: { gte: inicio, lte: fim } },
        include: { maquina: { select: { id: true, nome: true } } },
      });

      const mapa = new Map<string, { maquinaId: string; maquinaNome: string; contadoSistema: number }>();
      for (const p of pecas) {
        const atual = mapa.get(p.maquinaId);
        if (atual) {
          atual.contadoSistema += 1;
        } else {
          mapa.set(p.maquinaId, {
            maquinaId: p.maquinaId,
            maquinaNome: p.maquina.nome,
            contadoSistema: 1,
          });
        }
      }

      // ja existe fechamento desse operador nesse dia?
      const fechamento = await prisma.apontamentoTurno.findFirst({
        where: { operadorId, data: inicio },
      });

      return {
        data: {
          referencia: inicio,
          jaFechado: !!fechamento,
          linhas: Array.from(mapa.values()),
          totalSistema: pecas.length,
        },
      };
    },
  );

  // POST /api/conferencia-turno/fechar  -> grava/atualiza o fechamento do dia
  app.post(
    '/conferencia-turno/fechar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { data, linhas, observacoes } = fecharSchema.parse(request.body);
      const operadorId = (request.user as any).pessoaId;
      const { inicio } = inicioFimDoDia(data);

      const totalAjustado = linhas.reduce((s, l) => s + l.ajustado, 0);

      const fechamento = await prisma.apontamentoTurno.upsert({
        where: { operadorId_data: { operadorId, data: inicio } },
        create: {
          operadorId,
          data: inicio,
          producao: { linhas, totalAjustado },
          observacoes: observacoes ?? null,
        },
        update: {
          producao: { linhas, totalAjustado },
          observacoes: observacoes ?? null,
        },
      });

      return reply.code(201).send({ data: fechamento });
    },
  );
}
