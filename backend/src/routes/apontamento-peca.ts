// ============================================================
// Forja - Apontamento Peca a Peca (Sprint 4 - Bloco A)
// Registro incremental "+1 peca". Autenticacao do operador = assinatura.
// Controle interno de produtividade (Rota 2 simplificada).
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const registrarSchema = z.object({
  opLoteId: z.string().uuid('opLoteId inválido'),
  maquinaId: z.string().uuid('maquinaId inválido'),
  observacoes: z.string().max(500).nullable().optional(),
});

const opLoteParamSchema = z.object({
  opLoteId: z.string().uuid(),
});

export async function apontamentoPecaRoutes(app: FastifyInstance) {
  // POST /api/apontamento-peca  -> registra +1 peca
  app.post(
    '/apontamento-peca',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { opLoteId, maquinaId, observacoes } = registrarSchema.parse(request.body);
      const operadorId = (request.user as any).pessoaId;

      const opLote = await prisma.oPLote.findUnique({ where: { id: opLoteId } });
      if (!opLote) {
        return reply.code(404).send({ error: 'not_found', message: 'OP não encontrada' });
      }

      const resultado = await prisma.$transaction(async (tx) => {
        // numero da peca = quantas ja existem nessa OP + 1 (sequencia informativa)
        const total = await tx.apontamentoPeca.count({ where: { opLoteId } });
        const numeroPeca = total + 1;

        const apontamento = await tx.apontamentoPeca.create({
          data: { opLoteId, maquinaId, operadorId, numeroPeca, observacoes: observacoes ?? null },
        });

        // carimbo aberto da OP recebe a contagem em tempo real
        const carimbo = await tx.carimbo.findFirst({
          where: { opLoteId, timestampSaida: null },
          orderBy: { timestampEntrada: 'desc' },
        });
        if (carimbo) {
          await tx.carimbo.update({
            where: { id: carimbo.id },
            data: { quantidadeConcluida: numeroPeca },
          });
        }

        // Gatilho de alerta parcial: a etapa avisada não espera o lote fechar.
        // Dispara uma única vez, ao cruzar a quantidade definida pelo PCP.
        let alertaParcial = false;
        if (
          opLote.gatilhoAlertaPecas != null &&
          !opLote.alertaParcialEm &&
          numeroPeca >= opLote.gatilhoAlertaPecas
        ) {
          await tx.oPLote.update({
            where: { id: opLoteId },
            data: { alertaParcialEm: new Date() },
          });
          alertaParcial = true;

          // Persiste o aviso no painel (canal dashboard) para quem trabalha na
          // etapa avisada, mesmo que ninguém esteja com a tela aberta agora.
          if (opLote.etapaAvisadaId) {
            const contexto = await tx.oPLote.findUnique({
              where: { id: opLoteId },
              select: {
                codigoOp: true,
                tipoServico: true,
                lote: {
                  select: {
                    numeroLote: true,
                    os: { select: { codigoGrv: true, artigo: { select: { codigo: true } } } },
                  },
                },
              },
            });

            const mensagem = contexto
              ? `${contexto.lote.os.codigoGrv} (${contexto.lote.os.artigo.codigo}) — lote ${contexto.lote.numeroLote}: ${numeroPeca} peça(s) prontas em ${contexto.tipoServico}. Pode adiantar o próximo programa.`
              : `${numeroPeca} peça(s) prontas. Pode adiantar o próximo programa.`;

            // O aviso é da ESTAÇÃO avisada, não de uma pessoa: quem abrir
            // aquele tótem vê, seja quem for que esteja lá.
            await tx.alerta.create({
              data: {
                tipo: 'parcial_pronta',
                severidade: 'info',
                entidadeTipo: 'OPLote',
                entidadeId: opLoteId,
                etapaDestinoId: opLote.etapaAvisadaId,
                canal: 'dashboard',
                mensagem,
              },
            });
          }
        }

        return { apontamento, numeroPeca, alertaParcial };
      });

      app.io
        .to(`estacao:${opLote.etapaId}`)
        .emit('peca:registrada', {
          opLoteId,
          maquinaId,
          numeroPeca: resultado.numeroPeca,
        });

      if (resultado.alertaParcial) {
        // Aviso de "já tem peça pronta" — a próxima etapa pode se preparar
        // (ex: engenharia começa o programa sem esperar o lote todo).
        app.io.emit('op:parcial-pronta', {
          opLoteId,
          etapaId: opLote.etapaId,
          etapaAvisadaId: opLote.etapaAvisadaId,
          codigoOp: opLote.codigoOp,
          tipoServico: opLote.tipoServico,
          quantidade: resultado.numeroPeca,
          gatilho: opLote.gatilhoAlertaPecas,
        });
      }

      return reply.code(201).send({
        data: resultado.apontamento,
        meta: { alertaParcial: resultado.alertaParcial },
      });
    },
  );

  // DELETE /api/apontamento-peca/ultima -> desfaz o ultimo registro do operador na maquina
  app.delete(
    '/apontamento-peca/ultima',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { opLoteId, maquinaId } = registrarSchema
        .pick({ opLoteId: true, maquinaId: true })
        .parse(request.body);
      const operadorId = (request.user as any).pessoaId;

      const ultimo = await prisma.apontamentoPeca.findFirst({
        where: { opLoteId, maquinaId, operadorId },
        orderBy: { criadoEm: 'desc' },
      });

      if (!ultimo) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'Nenhuma peça desse operador nessa máquina pra desfazer' });
      }

      const opLote = await prisma.oPLote.findUnique({ where: { id: opLoteId } });

      await prisma.$transaction(async (tx) => {
        await tx.apontamentoPeca.delete({ where: { id: ultimo.id } });
        const total = await tx.apontamentoPeca.count({ where: { opLoteId } });
        const carimbo = await tx.carimbo.findFirst({
          where: { opLoteId, timestampSaida: null },
          orderBy: { timestampEntrada: 'desc' },
        });
        if (carimbo) {
          await tx.carimbo.update({
            where: { id: carimbo.id },
            data: { quantidadeConcluida: total },
          });
        }
      });

      if (opLote) {
        app.io.to(`estacao:${opLote.etapaId}`).emit('peca:desfeita', { opLoteId, maquinaId });
      }

      return { data: { desfeito: true, apontamentoId: ultimo.id } };
    },
  );

  // GET /api/apontamento-peca/:opLoteId -> lista + contagem da OP
  app.get(
    '/apontamento-peca/:opLoteId',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { opLoteId } = opLoteParamSchema.parse(request.params);

      const [pecas, total] = await Promise.all([
        prisma.apontamentoPeca.findMany({
          where: { opLoteId },
          include: {
            maquina: { select: { id: true, nome: true } },
            operador: { select: { id: true, nome: true } },
          },
          orderBy: { numeroPeca: 'asc' },
        }),
        prisma.apontamentoPeca.count({ where: { opLoteId } }),
      ]);

      // contagem por maquina (pro indicador de progresso do totem)
      const porMaquina = await prisma.apontamentoPeca.groupBy({
        by: ['maquinaId'],
        where: { opLoteId },
        _count: { _all: true },
      });

      return { data: { total, pecas, porMaquina } };
    },
  );
}
