// ============================================================
// Forja - Avisos internos (canal dashboard)
// ============================================================
// Alertas que ficam DENTRO da aplicação. WhatsApp é outro canal,
// avaliado no Sprint 7 — aqui nada sai do sistema.
//
//   GET   /api/avisos?etapaId=  — não lidos da estação + os pessoais
//   PATCH /api/avisos/:id/lido  — marca um como lido
//   POST  /api/avisos/marcar-lidos — marca todos como lidos
//
// Aviso de estação é o caso normal: o tratamento térmico avisa a ENGENHARIA,
// e quem estiver no tótem da engenharia vê — não importa quem está logado nem
// quem foi cadastrado com qual papel.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

export async function avisosRoutes(app: FastifyInstance) {
  // ---------------- LISTA (não lidos) ----------------
  app.get('/avisos', { onRequest: [app.authenticate] }, async (request) => {
    const user = request.user as any;

    const querySchema = z.object({
      etapaId: z.string().uuid().optional(),
      incluirLidos: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      limit: z.coerce.number().min(1).max(100).default(30),
    });
    const parsed = querySchema.safeParse(request.query);
    const { etapaId, incluirLidos, limit } = parsed.success
      ? parsed.data
      : { etapaId: undefined, incluirLidos: false, limit: 30 };

    const avisos = await prisma.alerta.findMany({
      where: {
        canal: 'dashboard',
        // Avisos da estação que está aberta + os endereçados à pessoa.
        OR: [
          { destinatarioId: user.pessoaId },
          ...(etapaId ? [{ etapaDestinoId: etapaId }] : []),
        ],
        ...(incluirLidos ? {} : { visualizadoEm: null }),
      },
      orderBy: { criadoEm: 'desc' },
      take: limit,
    });

    // Enriquece com o contexto da OP, quando o aviso é sobre uma
    const idsOpLote = avisos
      .filter((a) => a.entidadeTipo === 'OPLote')
      .map((a) => a.entidadeId);

    const opsLote = idsOpLote.length
      ? await prisma.oPLote.findMany({
          where: { id: { in: idsOpLote } },
          select: {
            id: true,
            codigoOp: true,
            tipoServico: true,
            status: true,
            quantidadeConcluida: true,
            etapa: { select: { id: true, nome: true } },
            etapaAvisada: { select: { id: true, nome: true } },
            lote: {
              select: {
                numeroLote: true,
                quantidadePecas: true,
                os: {
                  select: {
                    id: true,
                    codigoGrv: true,
                    artigo: { select: { codigo: true, descricao: true } },
                  },
                },
              },
            },
          },
        })
      : [];
    const porId = new Map(opsLote.map((o) => [o.id, o]));

    return {
      data: avisos.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        severidade: a.severidade,
        mensagem: a.mensagem,
        criadoEm: a.criadoEm,
        visualizadoEm: a.visualizadoEm,
        opLote: a.entidadeTipo === 'OPLote' ? (porId.get(a.entidadeId) ?? null) : null,
      })),
    };
  });

  // ---------------- MARCAR UM COMO LIDO ----------------
  app.patch(
    '/avisos/:id/lido',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as any;
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const aviso = await prisma.alerta.findUnique({ where: { id: parsed.data.id } });
      // Aviso de estação é do posto, não de uma pessoa: qualquer um que esteja
      // ali pode dar como lido, como se apagasse do quadro da parede.
      const podeLer =
        aviso &&
        (aviso.etapaDestinoId !== null || aviso.destinatarioId === user.pessoaId);
      if (!podeLer) {
        return reply.code(404).send({ error: 'not_found', message: 'Aviso não encontrado' });
      }

      const atualizado = await prisma.alerta.update({
        where: { id: parsed.data.id },
        data: { visualizadoEm: new Date() },
      });

      return { data: atualizado };
    },
  );

  // ---------------- MARCAR TODOS COMO LIDOS ----------------
  app.post(
    '/avisos/marcar-lidos',
    { onRequest: [app.authenticate] },
    async (request) => {
      const user = request.user as any;
      const body = z
        .object({ etapaId: z.string().uuid().optional() })
        .safeParse(request.body ?? {});
      const etapaId = body.success ? body.data.etapaId : undefined;

      const r = await prisma.alerta.updateMany({
        where: {
          canal: 'dashboard',
          visualizadoEm: null,
          OR: [
            { destinatarioId: user.pessoaId },
            ...(etapaId ? [{ etapaDestinoId: etapaId }] : []),
          ],
        },
        data: { visualizadoEm: new Date() },
      });
      return { data: { marcados: r.count } };
    },
  );
}
