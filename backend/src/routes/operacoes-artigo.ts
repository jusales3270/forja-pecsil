// ============================================================
// Forja - Rotas de Operações do Artigo (aninhadas em Artigo)
// ============================================================
//
//   GET    /api/artigos/:artigoId/operacoes              — lista (ordenada)
//   POST   /api/artigos/:artigoId/operacoes              — cria
//   GET    /api/artigos/:artigoId/operacoes/:id          — detalhe
//   PATCH  /api/artigos/:artigoId/operacoes/:id          — atualiza
//   DELETE /api/artigos/:artigoId/operacoes/:id          — remove
//   POST   /api/artigos/:artigoId/operacoes/reordenar    — bulk reorder
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { buscarRoteiroPadrao, PASSO_SEQUENCIA } from '../data/roteiros-padrao.js';

const criarOperacaoSchema = z.object({
  etapaId: z.string().uuid('etapaId inválido'),
  tipoServicoId: z.string().uuid('tipoServicoId inválido').optional(),
  codigoOp: z.string().min(1, 'codigoOp é obrigatório').max(20),
  ordem: z.number().int().nonnegative('ordem deve ser >= 0'),
  tipoServico: z.string().min(1, 'tipoServico é obrigatório').max(200),
  tempoUnitMin: z.number().finite().nonnegative('tempoUnitMin deve ser >= 0'),
  tempoSetupMin: z.number().int().nonnegative().default(0),
  exigeInspecao: z.boolean().default(false),
  gatilhoAlertaPecas: z.number().int().positive().nullable().optional(),
  avisaAoIniciar: z.boolean().optional(),
  terceirizada: z.boolean().optional(),
  fornecedor: z.string().max(200).nullable().optional(),
  prazoPrevistoDias: z.number().int().positive().nullable().optional(),
  custoPrevisto: z.number().nonnegative().nullable().optional(),
  esperaHoras: z.number().int().positive().nullable().optional(),
  exigeLoteCompleto: z.boolean().optional(),
  etapaAvisadaId: z.string().uuid().nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

const atualizarOperacaoSchema = criarOperacaoSchema.partial();

const aplicarRoteiroSchema = z.object({
  roteiroId: z.string().min(1, 'roteiroId é obrigatório'),
  /** true = apaga as operações existentes antes de aplicar */
  substituir: z.boolean().default(false),
});

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

async function garantirArtigoExiste(artigoId: string) {
  return prisma.artigo.findUnique({
    where: { id: artigoId },
    select: { id: true },
  });
}

async function garantirEtapaExiste(etapaId: string) {
  return prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { id: true },
  });
}

async function garantirTipoServicoExiste(tipoServicoId: string) {
  return prisma.tipoServico.findUnique({
    where: { id: tipoServicoId },
    select: { id: true },
  });
}

export async function operacoesArtigoRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get(
    '/artigos/:artigoId/operacoes',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
        });
      }

      const operacoes = await prisma.operacaoArtigo.findMany({
        where: { artigoId },
        orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }],
        include: {
          etapa: { select: { id: true, nome: true } },
          tipoServicoRel: { select: { id: true, nome: true } },
          planoInspecao: { select: { id: true } },
        },
      });

      return { data: operacoes };
    }
  );

  // ---------------- DETALHE ----------------
  app.get(
    '/artigos/:artigoId/operacoes/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as {
        artigoId: string;
        id: string;
      };

      const operacao = await prisma.operacaoArtigo.findFirst({
        where: { id, artigoId },
        include: {
          etapa: { select: { id: true, nome: true } },
          tipoServicoRel: { select: { id: true, nome: true } },
          planoInspecao: { select: { id: true } },
        },
      });

      if (!operacao) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada',
        });
      }

      return { data: operacao };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/artigos/:artigoId/operacoes',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
        });
      }

      const parsed = criarOperacaoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const etapa = await garantirEtapaExiste(parsed.data.etapaId);
      if (!etapa) {
        return reply.code(404).send({
          error: 'etapa_nao_encontrada',
          message: 'Etapa não encontrada',
        });
      }

      if (parsed.data.tipoServicoId) {
        const ts = await garantirTipoServicoExiste(parsed.data.tipoServicoId);
        if (!ts) {
          return reply.code(404).send({
            error: 'tipo_servico_nao_encontrado',
            message: 'Tipo de Serviço não encontrado',
          });
        }
      }

      try {
        const operacao = await prisma.operacaoArtigo.create({
          data: {
            artigoId,
            etapaId: parsed.data.etapaId,
            tipoServicoId: parsed.data.tipoServicoId,
            codigoOp: parsed.data.codigoOp,
            ordem: parsed.data.ordem,
            tipoServico: parsed.data.tipoServico,
            tempoUnitMin: parsed.data.tempoUnitMin,
            tempoSetupMin: parsed.data.tempoSetupMin,
            exigeInspecao: parsed.data.exigeInspecao,
            gatilhoAlertaPecas: parsed.data.gatilhoAlertaPecas ?? null,
            avisaAoIniciar: parsed.data.avisaAoIniciar ?? false,
            terceirizada: parsed.data.terceirizada ?? false,
            fornecedor: parsed.data.fornecedor ?? null,
            prazoPrevistoDias: parsed.data.prazoPrevistoDias ?? null,
            custoPrevisto: parsed.data.custoPrevisto ?? null,
            esperaHoras: parsed.data.esperaHoras ?? null,
            exigeLoteCompleto: parsed.data.exigeLoteCompleto ?? false,
            etapaAvisadaId: parsed.data.etapaAvisadaId ?? null,
            observacoes: parsed.data.observacoes,
          },
          include: {
            etapa: { select: { id: true, nome: true } },
            tipoServicoRel: { select: { id: true, nome: true } },
          },
        });

        return reply.code(201).send({ data: operacao });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return reply.code(409).send({
            error: 'duplicate_codigo_op',
            message: `Já existe uma operação com o código "${parsed.data.codigoOp}" para esse artigo`,
          });
        }
        throw err;
      }
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.patch(
    '/artigos/:artigoId/operacoes/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as {
        artigoId: string;
        id: string;
      };

      const parsed = atualizarOperacaoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const atual = await prisma.operacaoArtigo.findFirst({
        where: { id, artigoId },
      });

      if (!atual) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada',
        });
      }

      if (parsed.data.etapaId) {
        const etapa = await garantirEtapaExiste(parsed.data.etapaId);
        if (!etapa) {
          return reply.code(404).send({
            error: 'etapa_nao_encontrada',
            message: 'Etapa não encontrada',
          });
        }
      }

      if (parsed.data.tipoServicoId) {
        const ts = await garantirTipoServicoExiste(parsed.data.tipoServicoId);
        if (!ts) {
          return reply.code(404).send({
            error: 'tipo_servico_nao_encontrado',
            message: 'Tipo de Serviço não encontrado',
          });
        }
      }

      try {
        const atualizado = await prisma.operacaoArtigo.update({
          where: { id },
          data: parsed.data,
          include: {
            etapa: { select: { id: true, nome: true } },
            tipoServicoRel: { select: { id: true, nome: true } },
          },
        });

        return { data: atualizado };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return reply.code(409).send({
            error: 'duplicate_codigo_op',
            message: `Já existe uma operação com o código "${parsed.data.codigoOp}" para esse artigo`,
          });
        }
        throw err;
      }
    }
  );

  // ---------------- DELETAR ----------------
  app.delete(
    '/artigos/:artigoId/operacoes/:id',
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const { artigoId, id } = request.params as {
        artigoId: string;
        id: string;
      };

      const operacao = await prisma.operacaoArtigo.findFirst({
        where: { id, artigoId },
        include: {
          planoInspecao: { select: { id: true } },
          _count: { select: { opsLote: true } },
        },
      });

      if (!operacao) {
        return reply.code(404).send({
          error: 'operacao_nao_encontrada',
          message: 'Operação não encontrada',
        });
      }

      if (operacao.planoInspecao) {
        return reply.code(409).send({
          error: 'operacao_com_plano_inspecao',
          message:
            'Esta operação tem um Plano de Inspeção vinculado. Remova o plano antes de deletar a operação.',
        });
      }

      if (operacao._count.opsLote > 0) {
        return reply.code(409).send({
          error: 'operacao_em_uso',
          message: `Esta operação já está em uso em ${operacao._count.opsLote} lote(s) e não pode ser removida.`,
        });
      }

      await prisma.operacaoArtigo.delete({ where: { id } });

      return reply.code(204).send();
    }
  );

  // ---------------- APLICAR ROTEIRO PADRÃO ----------------
  app.post(
    '/artigos/:artigoId/operacoes/aplicar-roteiro',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
        });
      }

      const parsed = aplicarRoteiroSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const roteiro = buscarRoteiroPadrao(parsed.data.roteiroId);
      if (!roteiro) {
        return reply.code(404).send({
          error: 'roteiro_nao_encontrado',
          message: 'Roteiro padrão não encontrado',
        });
      }

      // Resolve os códigos do roteiro contra o catálogo de Tipos de Serviço.
      // Cada tipo carrega a etapa — é dela que a OP herda o destino no tótem.
      const codigos = [
        ...new Set(
          roteiro.operacoes.flatMap((o) =>
            [o.codigoTipoServico, o.avisaEtapaDoCodigoTipoServico].filter(
              (c): c is number => c != null,
            ),
          ),
        ),
      ];
      const tipos = await prisma.tipoServico.findMany({
        where: { codigo: { in: codigos }, ativo: true },
      });
      const porCodigo = new Map(tipos.map((t) => [t.codigo!, t]));

      const faltando = codigos.filter((c) => !porCodigo.has(c));
      if (faltando.length > 0) {
        return reply.code(409).send({
          error: 'tipos_servico_faltando',
          message: `Este roteiro usa Tipos de Serviço que não estão no catálogo (códigos: ${faltando.join(', ')}). Cadastre-os antes de aplicar.`,
          codigosFaltando: faltando,
        });
      }

      const existentes = await prisma.operacaoArtigo.findMany({
        where: { artigoId },
        include: { _count: { select: { opsLote: true } } },
      });

      if (existentes.length > 0 && !parsed.data.substituir) {
        return reply.code(409).send({
          error: 'artigo_ja_tem_operacoes',
          message: `Este artigo já tem ${existentes.length} operação(ões). Confirme a substituição para aplicar o roteiro.`,
          totalExistentes: existentes.length,
        });
      }

      // Não dá pra apagar operação que já virou OP de lote numa OS real.
      const emUso = existentes.filter((o) => o._count.opsLote > 0);
      if (emUso.length > 0) {
        return reply.code(409).send({
          error: 'operacoes_em_uso',
          message: `${emUso.length} operação(ões) deste artigo já estão em uso em OS abertas e não podem ser substituídas.`,
        });
      }

      try {
        const criadas = await prisma.$transaction(async (tx) => {
          if (existentes.length > 0) {
            // Plano de inspeção depende da operação; some junto.
            await tx.planoInspecao.deleteMany({
              where: { operacaoArtigoId: { in: existentes.map((o) => o.id) } },
            });
            await tx.operacaoArtigo.deleteMany({ where: { artigoId } });
          }

          return Promise.all(
            roteiro.operacoes.map((op, idx) => {
              const tipo = porCodigo.get(op.codigoTipoServico)!;
              return tx.operacaoArtigo.create({
                data: {
                  artigoId,
                  etapaId: tipo.etapaId,
                  tipoServicoId: tipo.id,
                  codigoOp: String((idx + 1) * PASSO_SEQUENCIA),
                  ordem: idx,
                  tipoServico: tipo.nome,
                  tempoUnitMin: op.tempoUnitMin,
                  tempoSetupMin: op.tempoSetupMin,
                  exigeInspecao: op.exigeInspecao,
                  gatilhoAlertaPecas: op.gatilhoAlertaPecas ?? null,
                  avisaAoIniciar: op.avisaAoIniciar ?? false,
                  terceirizada: op.terceirizada ?? false,
                  fornecedor: op.fornecedor ?? null,
                  prazoPrevistoDias: op.prazoPrevistoDias ?? null,
                  esperaHoras: op.esperaHoras ?? null,
                  exigeLoteCompleto: op.exigeLoteCompleto ?? false,
                  etapaAvisadaId:
                    op.avisaEtapaDoCodigoTipoServico != null
                      ? (porCodigo.get(op.avisaEtapaDoCodigoTipoServico)?.etapaId ?? null)
                      : null,
                  observacoes: op.observacoes,
                },
              });
            }),
          );
        });

        return reply.code(201).send({
          data: criadas,
          meta: {
            roteiro: roteiro.nome,
            criadas: criadas.length,
            substituidas: existentes.length,
          },
        });
      } catch (err) {
        app.log.error({ err }, 'Erro ao aplicar roteiro padrão');
        return reply.code(500).send({
          error: 'erro_interno',
          message: 'Erro ao aplicar o roteiro. Tente novamente.',
        });
      }
    },
  );

  // ---------------- REORDENAR (bulk) ----------------
  app.post(
    '/artigos/:artigoId/operacoes/reordenar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
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

      // Garante que todos os IDs pertencem a esse artigo
      const ids = parsed.data.ordens.map((o) => o.id);
      const existentes = await prisma.operacaoArtigo.findMany({
        where: { id: { in: ids }, artigoId },
        select: { id: true },
      });

      if (existentes.length !== ids.length) {
        return reply.code(400).send({
          error: 'operacoes_invalidas',
          message:
            'Uma ou mais operações da lista não pertencem a esse artigo ou não existem.',
        });
      }

      // Aplica todas as ordens numa transação
      await prisma.$transaction(
        parsed.data.ordens.map((o) =>
          prisma.operacaoArtigo.update({
            where: { id: o.id },
            data: { ordem: o.ordem },
          })
        )
      );

      const atualizadas = await prisma.operacaoArtigo.findMany({
        where: { artigoId },
        orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }],
        include: {
          etapa: { select: { id: true, nome: true } },
          tipoServicoRel: { select: { id: true, nome: true } },
        },
      });

      return { data: atualizadas };
    }
  );
}
