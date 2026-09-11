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
// e somente contas vinculadas à engenharia podem ler ou confirmar esse aviso.
// Observar o tótem de outra estação não concede acesso aos avisos dela.
// ============================================================

import { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { calcularFluxoDePecas } from '../lib/fluxo-pecas.js';

// Consulta o vínculo atual: um JWT antigo não mantém acesso após troca de
// estação ou desativação. Papel administrativo não dispensa o vínculo.
async function escopoAvisos(pessoaId: string, etapaSolicitada?: string): Promise<Prisma.AlertaWhereInput> {
  const pessoa = await prisma.pessoa.findUnique({
    where: { id: pessoaId },
    select: { id: true, etapaId: true, ativo: true },
  });
  if (!pessoa?.ativo) {
    throw Object.assign(new Error('Conta indisponível. Entre novamente.'), { statusCode: 401 });
  }
  if (etapaSolicitada && etapaSolicitada !== pessoa.etapaId) {
    throw Object.assign(new Error('Os avisos são restritos às contas da estação destinatária.'), { statusCode: 403 });
  }
  return {
    canal: 'dashboard',
    OR: [
      // Se o aviso tem estação destinatária, o vínculo com ela é obrigatório,
      // mesmo que o registro também contenha um destinatário pessoal.
      { etapaDestinoId: null, destinatarioId: pessoa.id },
      ...(pessoa.etapaId ? [{ etapaDestinoId: pessoa.etapaId }] : []),
    ],
  };
}

export async function avisosRoutes(app: FastifyInstance) {
  // ---------------- LISTA (não lidos) ----------------
  app.get('/avisos', { onRequest: [app.authenticate] }, async (request, reply) => {

    const querySchema = z.object({
      etapaId: z.string().uuid().optional(),
      incluirLidos: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
      limit: z.coerce.number().min(1).max(100).default(30),
    });
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Filtros inválidos' });
    }
    const { etapaId, incluirLidos, limit } = parsed.data;
    const escopo = await escopoAvisos(request.user.pessoaId, etapaId);

    const avisos = await prisma.alerta.findMany({
      where: {
        ...escopo,
        ...(incluirLidos ? {} : { visualizadoEm: null }),
      },
      orderBy: { criadoEm: 'desc' },
      take: limit,
    });

    // Enriquece com o contexto da OP, quando o aviso é sobre uma
    const idsOpLote = avisos
      .filter((a) => a.entidadeTipo === 'OPLote')
      .map((a) => a.entidadeId);

    // O aviso precisa carregar tudo que a engenharia usa pra montar o programa:
    // qual artigo, qual desenho, quantas peças, pra quando, e principalmente
    // QUAIS operações vêm depois desta — que é o programa a ser feito.
    const opsLote = idsOpLote.length
      ? await prisma.oPLote.findMany({
          where: { id: { in: idsOpLote } },
          select: {
            id: true,
            codigoOp: true,
            ordem: true,
            tipoServico: true,
            status: true,
            quantidadeConcluida: true,
            observacoes: true,
            esperaHoras: true,
            terceirizada: true,
            etapa: { select: { id: true, nome: true } },
            etapaAvisada: { select: { id: true, nome: true } },
            carimbos: {
              where: { timestampSaida: null },
              orderBy: { timestampEntrada: 'desc' },
              take: 1,
              select: { timestampEntrada: true },
            },
            lote: {
              select: {
                id: true,
                numeroLote: true,
                quantidadePecas: true,
                observacoes: true,
                os: {
                  select: {
                    id: true,
                    codigoGrv: true,
                    prazoEntrega: true,
                    prioridade: true,
                    quantidadeTotal: true,
                    observacoes: true,
                    cliente: { select: { id: true, nome: true } },
                    artigo: {
                      select: {
                        id: true,
                        codigo: true,
                        descricao: true,
                        tipoProduto: true,
                        material: true,
                        observacoes: true,
                        desenhos: {
                          select: {
                            id: true,
                            artigoId: true,
                            tipo: true,
                            codigoDesenho: true,
                            revisao: true,
                            dataRevisao: true,
                            arquivoKey: true,
                            arquivoTipo: true,
                            arquivoTamanho: true,
                            arquivoNomeOriginal: true,
                            observacoes: true,
                            criadoEm: true,
                            atualizadoEm: true,
                          },
                          orderBy: [{ tipo: 'asc' }, { revisao: 'desc' }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];

    // As operações que vêm DEPOIS desta no roteiro do lote. É literalmente a
    // lista do que a engenharia precisa programar.
    const proximasPorOp = new Map<string, any[]>();
    for (const op of opsLote) {
      const seguintes = await prisma.oPLote.findMany({
        where: { loteId: op.lote.id, ordem: { gt: op.ordem } },
        orderBy: { ordem: 'asc' },
        take: 6,
        select: {
          id: true,
          codigoOp: true,
          tipoServico: true,
          status: true,
          terceirizada: true,
          esperaHoras: true,
          observacoes: true,
          etapa: { select: { id: true, nome: true } },
        },
      });
      proximasPorOp.set(op.id, seguintes);
    }

    const fluxo = await calcularFluxoDePecas([...new Set(opsLote.map((o) => o.lote.id))]);

    const porId = new Map(
      opsLote.map((o) => {
        const pecas = fluxo.get(o.id);
        const entrada = o.carimbos[0]?.timestampEntrada ?? null;
        return [
          o.id,
          {
            ...o,
            carimbos: undefined,
            iniciadaEm: entrada,
            /** Peças que chegaram nesta operação — o número real do aviso. */
            pecasNaOperacao: pecas?.liberadasPelaAnterior ?? o.lote.quantidadePecas,
            proximasOperacoes: proximasPorOp.get(o.id) ?? [],
          },
        ];
      }),
    );

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
      const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const escopo = await escopoAvisos(request.user.pessoaId);
      const where = { ...escopo, id: parsed.data.id };
      // A autorização faz parte do UPDATE, inclusive para pedidos diretos por ID.
      // Repetir a confirmação preserva o horário da primeira leitura.
      await prisma.alerta.updateMany({
        where: { ...where, visualizadoEm: null },
        data: { visualizadoEm: new Date() },
      });
      const atualizado = await prisma.alerta.findFirst({
        where,
        select: { id: true, visualizadoEm: true },
      });
      if (!atualizado) {
        return reply.code(404).send({ error: 'not_found', message: 'Aviso não encontrado' });
      }

      return { data: atualizado };
    },
  );

  // ---------------- MARCAR TODOS COMO LIDOS ----------------
  app.post(
    '/avisos/marcar-lidos',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const body = z
        .object({ etapaId: z.string().uuid().optional() })
        .safeParse(request.body ?? {});
      if (!body.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'Estação inválida' });
      }
      const escopo = await escopoAvisos(request.user.pessoaId, body.data.etapaId);

      const r = await prisma.alerta.updateMany({
        where: {
          ...escopo,
          visualizadoEm: null,
        },
        data: { visualizadoEm: new Date() },
      });
      return { data: { marcados: r.count } };
    },
  );
}
