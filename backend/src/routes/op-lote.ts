// ============================================================
// Forja - Rotas de OPs de Lote (Operações em produção)
// Sprint 3: tótem do programador
// - Listar OPs pendentes e em andamento por estação (etapa)
// - Iniciar processamento (carimbo + processamento + evento)
// - Encerrar OP (fecha carimbo, atualiza estado, movimenta lote)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

// ============================================================
// Schemas
// ============================================================

const filtroEstacaoSchema = z.object({
  etapaId: z.string().uuid('etapaId inválido'),
  busca: z.string().optional(),
});

const iniciarSchema = z.object({
  maquinaId: z.string().uuid('maquinaId inválido'),
  operadorId: z.string().uuid('operadorId inválido'),
  observacoes: z.string().max(1000).nullable().optional(),
});

const encerrarSchema = z.object({
  quantidadeConcluida: z.number().int().min(0, 'Quantidade não pode ser negativa'),
  observacoes: z.string().max(1000).nullable().optional(),
});

const pausarSchema = z.object({
  motivoParadaId: z.string().uuid('motivoParadaId inválido'),
  observacoes: z.string().max(1000).nullable().optional(),
});

// ============================================================
// Helpers
// ============================================================

async function criarEvento(
  tx: Prisma.TransactionClient,
  data: {
    osId: string;
    loteId?: string;
    tipo: any;
    autorId?: string;
    payload?: any;
    visivelDashboard?: boolean;
  },
) {
  return tx.eventoOS.create({
    data: {
      osId: data.osId,
      loteId: data.loteId,
      tipo: data.tipo,
      autorId: data.autorId,
      payload: data.payload ?? undefined,
      visivelDashboard: data.visivelDashboard ?? true,
    },
  });
}

// Verifica se o usuário tem papel pra operar tótem
function podeOperarTotem(papel: string): boolean {
  return ['programador', 'pcp', 'admin'].includes(papel);
}

// ============================================================
// Rotas
// ============================================================

export async function opLoteRoutes(app: FastifyInstance) {
  // ---------------- LISTAR PENDENTES NA ESTAÇÃO ----------------
  // OPs com status na_fila na etapa, ordenadas por urgência (prioridade da OS + prazo)
  app.get(
    '/op-lote/pendentes',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = filtroEstacaoSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Filtros inválidos',
          details: parsed.error.flatten(),
        });
      }

      const { etapaId, busca } = parsed.data;

      const where: Prisma.OPLoteWhereInput = {
        etapaId,
        status: 'na_fila',
        lote: {
          os: {
            status: { in: ['aberta', 'em_producao'] },
          },
        },
      };

      if (busca) {
        where.lote = {
          ...where.lote,
          os: {
            ...(where.lote as any).os,
            OR: [
              { codigoGrv: { contains: busca, mode: 'insensitive' } },
              { artigo: { codigo: { contains: busca, mode: 'insensitive' } } },
              { artigo: { descricao: { contains: busca, mode: 'insensitive' } } },
              { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
            ],
          },
        };
      }

      const ops = await prisma.oPLote.findMany({
        where,
        include: {
          etapa: { select: { id: true, nome: true } },
          lote: {
            include: {
              os: {
                select: {
                  id: true,
                  codigoGrv: true,
                  prazoEntrega: true,
                  prioridade: true,
                  status: true,
                  observacoes: true,
                  cliente: { select: { id: true, nome: true } },
                  criadoPor: { select: { id: true, nome: true } },
                  artigo: { select: { id: true, codigo: true, descricao: true, observacoes: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { lote: { os: { prioridade: 'desc' } } },
          { lote: { os: { prazoEntrega: 'asc' } } },
          { ordem: 'asc' },
        ],
      });

      // Pra cada OP pendente, busca o último carimbo de saída de uma OP anterior
      // do mesmo lote (passo anterior) com observação preenchida.
      // Isso garante que a comunicação do programador anterior chegue ao próximo.
      const opsComContexto = await Promise.all(
        ops.map(async (op) => {
          const carimboAnterior = await prisma.carimbo.findFirst({
            where: {
              loteId: op.loteId,
              timestampSaida: { not: null },
              observacoes: { not: null },
              opLote: { ordem: { lt: op.ordem } },
            },
            orderBy: { timestampSaida: 'desc' },
            include: {
              etapa: { select: { id: true, nome: true } },
              programador: { select: { id: true, nome: true } },
              operadorResponsavel: { select: { id: true, nome: true } },
              maquina: { select: { id: true, nome: true } },
              opLote: { select: { id: true, codigoOp: true, tipoServico: true } },
            },
          });
          return { ...op, carimboAnterior };
        }),
      );

      return { data: opsComContexto };
    },
  );

  // ---------------- LISTAR EM ANDAMENTO NA ESTAÇÃO ----------------
  // OPs com status em_processo, com info de carimbo aberto e máquina
  app.get(
    '/op-lote/em-andamento',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const parsed = filtroEstacaoSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Filtros inválidos',
          details: parsed.error.flatten(),
        });
      }

      const { etapaId } = parsed.data;

      const ops = await prisma.oPLote.findMany({
        where: {
          etapaId,
          status: 'em_processo',
        },
        include: {
          etapa: { select: { id: true, nome: true } },
          lote: {
            include: {
              os: {
                select: {
                  id: true,
                  codigoGrv: true,
                  prazoEntrega: true,
                  prioridade: true,
                  cliente: { select: { id: true, nome: true } },
                  criadoPor: { select: { id: true, nome: true } },
                  artigo: { select: { id: true, codigo: true, descricao: true, observacoes: true } },
                },
              },
            },
          },
          // Carimbo mais recente sem saída = o aberto
          carimbos: {
            where: { timestampSaida: null },
            orderBy: { timestampEntrada: 'desc' },
            take: 1,
            include: {
              maquina: { select: { id: true, nome: true, codigoInterno: true } },
              programador: { select: { id: true, nome: true } },
              operadorResponsavel: { select: { id: true, nome: true } },
              // Parada em aberto (se a OP estiver pausada agora)
              paradas: {
                where: { fim: null },
                orderBy: { inicio: 'desc' },
                take: 1,
                include: {
                  motivoParada: { select: { id: true, nome: true, planejado: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { lote: { os: { prioridade: 'desc' } } },
          { lote: { os: { prazoEntrega: 'asc' } } },
        ],
      });

      return { data: ops };
    },
  );

  // ---------------- INICIAR PROCESSAMENTO DE OP ----------------
  app.post(
    '/op-lote/:id/iniciar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = iniciarSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user as any;
      if (!podeOperarTotem(user.papel)) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'Apenas programador, PCP ou admin podem iniciar OPs',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { maquinaId, operadorId, observacoes } = bodyParsed.data;
      const programadorId = user.pessoaId;

      // Carrega a OP e valida
      const opLote = await prisma.oPLote.findUnique({
        where: { id: opLoteId },
        include: {
          lote: { include: { os: { select: { id: true, status: true } } } },
        },
      });

      if (!opLote) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OP não encontrada' });
      }
      if (opLote.status !== 'na_fila') {
        return reply.code(400).send({
          error: 'op_nao_disponivel',
          message: `OP está com status "${opLote.status}" e não pode ser iniciada`,
        });
      }
      if (
        opLote.lote.os.status !== 'aberta' &&
        opLote.lote.os.status !== 'em_producao'
      ) {
        return reply.code(400).send({
          error: 'os_nao_ativa',
          message: `OS está com status "${opLote.lote.os.status}" e não permite iniciar OPs`,
        });
      }

      // Valida máquina: existe, ativa, pertence à etapa da OP
      const maquina = await prisma.maquina.findUnique({
        where: { id: maquinaId },
      });
      if (!maquina || !maquina.ativa) {
        return reply
          .code(404)
          .send({ error: 'maquina_invalida', message: 'Máquina não encontrada ou inativa' });
      }
      if (maquina.etapaId !== opLote.etapaId) {
        return reply.code(400).send({
          error: 'maquina_etapa_incorreta',
          message: 'Máquina não pertence à etapa desta OP',
        });
      }

      // Verifica se a máquina já tem outro processamento rodando
      const ocupada = await prisma.processamentoMaquina.findFirst({
        where: { maquinaId, status: 'rodando' },
      });
      if (ocupada) {
        return reply.code(409).send({
          error: 'maquina_ocupada',
          message: 'Máquina já está rodando outra OP. Encerre antes de iniciar nova.',
        });
      }

      // Valida operador: existe, ativo
      const operador = await prisma.pessoa.findUnique({
        where: { id: operadorId },
      });
      if (!operador || !operador.ativo) {
        return reply.code(404).send({
          error: 'operador_invalido',
          message: 'Operador não encontrado ou inativo',
        });
      }

      // Tudo certo — abre transação
      try {
        const resultado = await prisma.$transaction(async (tx) => {
          // Cria carimbo de entrada
          const carimbo = await tx.carimbo.create({
            data: {
              opLoteId: opLote.id,
              loteId: opLote.loteId,
              etapaId: opLote.etapaId,
              maquinaId,
              programadorId,
              operadorResponsavelId: operadorId,
              observacoes: observacoes ?? null,
            },
          });

          // Cria processamento
          const processamento = await tx.processamentoMaquina.create({
            data: {
              opLoteId: opLote.id,
              maquinaId,
              carimboId: carimbo.id,
              programadorId,
              operadorId,
              status: 'rodando',
            },
          });

          // Atualiza OPLote pra em_processo
          await tx.oPLote.update({
            where: { id: opLote.id },
            data: { status: 'em_processo' },
          });

          // Se for a primeira OP do lote a ir pra em_processo, atualiza Lote também
          const lote = await tx.lote.findUnique({
            where: { id: opLote.loteId },
            select: { status: true, osId: true },
          });
          if (lote && lote.status === 'na_fila') {
            await tx.lote.update({
              where: { id: opLote.loteId },
              data: { status: 'em_processo' },
            });
          }

          // Se for a primeira OS a entrar em produção, atualiza OS
          const os = await tx.oS.findUnique({
            where: { id: opLote.lote.os.id },
            select: { status: true },
          });
          if (os && os.status === 'aberta') {
            await tx.oS.update({
              where: { id: opLote.lote.os.id },
              data: { status: 'em_producao' },
            });
          }

          // Evento na timeline
          await criarEvento(tx, {
            osId: opLote.lote.os.id,
            loteId: opLote.loteId,
            tipo: 'op_lote_iniciada',
            autorId: programadorId,
            payload: {
              opLoteId: opLote.id,
              codigoOp: opLote.codigoOp,
              tipoServico: opLote.tipoServico,
              etapaId: opLote.etapaId,
              maquinaId,
              maquinaNome: maquina.nome,
              operadorId,
              operadorNome: operador.nome,
              carimboId: carimbo.id,
              processamentoId: processamento.id,
            },
          });

          return { carimbo, processamento };
        });

        // Emite evento em tempo real pra estação
        app.io
          .to(`estacao:${opLote.etapaId}`)
          .emit('op:iniciada', {
            opLoteId: opLote.id,
            loteId: opLote.loteId,
            etapaId: opLote.etapaId,
            maquinaId,
          });

        // Re-fetch com dados completos pra retornar
        const completo = await prisma.oPLote.findUnique({
          where: { id: opLote.id },
          include: {
            etapa: { select: { id: true, nome: true } },
            carimbos: {
              where: { id: resultado.carimbo.id },
              include: {
                maquina: { select: { id: true, nome: true } },
                programador: { select: { id: true, nome: true } },
                operadorResponsavel: { select: { id: true, nome: true } },
              },
            },
            lote: {
              include: {
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
        });

        return reply.code(201).send({ data: completo });
      } catch (err: any) {
        app.log.error({ err }, 'Erro ao iniciar OP');
        return reply.code(500).send({
          error: 'erro_interno',
          message: 'Erro ao iniciar OP. Tente novamente.',
        });
      }
    },
  );

  // ---------------- ENCERRAR OP ----------------
  app.post(
    '/op-lote/:id/encerrar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = encerrarSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user as any;
      if (!podeOperarTotem(user.papel)) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'Apenas programador, PCP ou admin podem encerrar OPs',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { quantidadeConcluida, observacoes } = bodyParsed.data;
      const autorId = user.pessoaId;

      // Carrega a OP com lote pra validar quantidade
      const opLote = await prisma.oPLote.findUnique({
        where: { id: opLoteId },
        include: {
          lote: { select: { id: true, osId: true, quantidadePecas: true } },
        },
      });

      if (!opLote) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OP não encontrada' });
      }
      if (opLote.status !== 'em_processo') {
        return reply.code(400).send({
          error: 'op_nao_em_processo',
          message: `OP está com status "${opLote.status}". Só OPs em processo podem ser encerradas.`,
        });
      }

      if (quantidadeConcluida > opLote.lote.quantidadePecas) {
        return reply.code(400).send({
          error: 'quantidade_invalida',
          message: `Quantidade (${quantidadeConcluida}) maior que o tamanho do lote (${opLote.lote.quantidadePecas})`,
        });
      }

      // Acha o carimbo aberto
      const carimboAberto = await prisma.carimbo.findFirst({
        where: { opLoteId: opLote.id, timestampSaida: null },
        orderBy: { timestampEntrada: 'desc' },
        include: { maquina: { select: { id: true, nome: true } } },
      });

      if (!carimboAberto) {
        return reply.code(400).send({
          error: 'carimbo_aberto_nao_encontrado',
          message: 'Nenhum carimbo aberto encontrado pra esta OP',
        });
      }

      const completou = quantidadeConcluida >= opLote.lote.quantidadePecas;
      const exigeInspecao = opLote.exigeInspecao;

      // Estado final da OP:
      // - Se completou e exige inspeção → aguardando_qualidade (placeholder Sprint 5)
      // - Se completou e não exige inspeção → concluida (lote avança automaticamente)
      // - Se não completou → volta pra na_fila (parcial)
      let novoStatusOp: 'na_fila' | 'aguardando_qualidade' | 'concluida';
      if (!completou) {
        novoStatusOp = 'na_fila';
      } else if (exigeInspecao) {
        novoStatusOp = 'aguardando_qualidade';
      } else {
        novoStatusOp = 'concluida';
      }

      try {
        const resultado = await prisma.$transaction(async (tx) => {
          // Fecha o carimbo
          await tx.carimbo.update({
            where: { id: carimboAberto.id },
            data: {
              timestampSaida: new Date(),
              quantidadeConcluida,
              observacoes: observacoes ?? carimboAberto.observacoes,
            },
          });

          // Fecha o processamento
          await tx.processamentoMaquina.updateMany({
            where: { carimboId: carimboAberto.id, status: 'rodando' },
            data: { status: 'finalizado', fim: new Date() },
          });

          // Fecha qualquer parada de máquina ainda aberta nesse carimbo —
          // não deixa parada pendurada quando o operador encerra a OP.
          await tx.paradaMaquina.updateMany({
            where: { carimboId: carimboAberto.id, fim: null },
            data: { fim: new Date() },
          });

          // Atualiza OPLote
          await tx.oPLote.update({
            where: { id: opLote.id },
            data: {
              status: novoStatusOp,
              quantidadeConcluida,
            },
          });

          // Movimentação automática do lote: se OP concluiu e não exige inspeção,
          // procura a próxima OP do lote (na_fila com ordem maior) e nada faz (já está na fila).
          // O Lote vira concluido se NÃO houver próxima OP (ou seja, era a última).
          let proximaOp: { id: string; ordem: number } | null = null;
          let loteConcluido = false;

          if (novoStatusOp === 'concluida') {
            proximaOp = await tx.oPLote.findFirst({
              where: {
                loteId: opLote.loteId,
                ordem: { gt: opLote.ordem },
                status: 'na_fila',
              },
              orderBy: { ordem: 'asc' },
              select: { id: true, ordem: true },
            });

            if (!proximaOp) {
              // Era a última OP — verifica se TODAS as OPs do lote estão concluídas
              const restantes = await tx.oPLote.count({
                where: {
                  loteId: opLote.loteId,
                  status: { notIn: ['concluida'] },
                },
              });
              if (restantes === 0) {
                await tx.lote.update({
                  where: { id: opLote.loteId },
                  data: { status: 'concluido' },
                });
                loteConcluido = true;
              }
            }
          }

          // Eventos
          await criarEvento(tx, {
            osId: opLote.lote.osId,
            loteId: opLote.loteId,
            tipo: completou ? 'op_lote_concluida' : 'observacao_livre',
            autorId,
            payload: {
              opLoteId: opLote.id,
              codigoOp: opLote.codigoOp,
              tipoServico: opLote.tipoServico,
              quantidadeConcluida,
              quantidadeTotal: opLote.lote.quantidadePecas,
              completou,
              exigeInspecao,
              novoStatus: novoStatusOp,
              carimboId: carimboAberto.id,
              maquinaNome: carimboAberto.maquina?.nome,
              proximaOpId: proximaOp?.id ?? null,
              loteConcluido,
              acao:
                novoStatusOp === 'concluida'
                  ? undefined
                  : 'encerramento_parcial',
            },
          });

          // Se o lote inteiro concluiu, verifica se a OS pode ser finalizada
          if (loteConcluido) {
            const lotesRestantes = await tx.lote.count({
              where: {
                osId: opLote.lote.osId,
                status: { notIn: ['concluido'] },
              },
            });
            if (lotesRestantes === 0) {
              await tx.oS.update({
                where: { id: opLote.lote.osId },
                data: { status: 'finalizada' },
              });
              await criarEvento(tx, {
                osId: opLote.lote.osId,
                tipo: 'os_finalizada',
                autorId,
                payload: { acao: 'finalizada_automaticamente' },
              });
            }
          }

          return { proximaOp, loteConcluido };
        });

        // Emite eventos em tempo real
        app.io
          .to(`estacao:${opLote.etapaId}`)
          .emit('op:encerrada', {
            opLoteId: opLote.id,
            loteId: opLote.loteId,
            etapaId: opLote.etapaId,
            novoStatus: novoStatusOp,
            completou,
          });

        if (novoStatusOp === 'concluida' && resultado.proximaOp) {
          // Notifica a estação da próxima OP que tem trabalho novo
          const proximaCompleta = await prisma.oPLote.findUnique({
            where: { id: resultado.proximaOp.id },
            select: { etapaId: true },
          });
          if (proximaCompleta) {
            app.io
              .to(`estacao:${proximaCompleta.etapaId}`)
              .emit('op:nova-na-fila', {
                opLoteId: resultado.proximaOp.id,
                loteId: opLote.loteId,
                etapaId: proximaCompleta.etapaId,
              });
          }
        }

        // Re-fetch
        const completo = await prisma.oPLote.findUnique({
          where: { id: opLote.id },
          include: {
            etapa: { select: { id: true, nome: true } },
            lote: {
              include: {
                os: {
                  select: {
                    id: true,
                    codigoGrv: true,
                    status: true,
                  },
                },
              },
            },
            carimbos: {
              orderBy: { timestampEntrada: 'desc' },
              take: 1,
              include: {
                maquina: { select: { id: true, nome: true } },
                programador: { select: { id: true, nome: true } },
                operadorResponsavel: { select: { id: true, nome: true } },
              },
            },
          },
        });

        return {
          data: completo,
          meta: {
            completou,
            novoStatus: novoStatusOp,
            proximaOpId: resultado.proximaOp?.id ?? null,
            loteConcluido: resultado.loteConcluido,
          },
        };
      } catch (err: any) {
        app.log.error({ err }, 'Erro ao encerrar OP');
        return reply.code(500).send({
          error: 'erro_interno',
          message: 'Erro ao encerrar OP. Tente novamente.',
        });
      }
    },
  );

  // ---------------- PAUSAR (registrar parada de máquina) ----------------
  app.post(
    '/op-lote/:id/pausar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = pausarSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user as any;
      if (!podeOperarTotem(user.papel)) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'Apenas programador, PCP ou admin podem pausar OPs',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { motivoParadaId, observacoes } = bodyParsed.data;
      const registradoPorId = user.pessoaId;

      const opLote = await prisma.oPLote.findUnique({
        where: { id: opLoteId },
        select: { id: true, status: true },
      });
      if (!opLote) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OP não encontrada' });
      }
      if (opLote.status !== 'em_processo') {
        return reply.code(400).send({
          error: 'op_nao_em_processo',
          message: `OP está com status "${opLote.status}" e não pode ser pausada`,
        });
      }

      const carimboAberto = await prisma.carimbo.findFirst({
        where: { opLoteId: opLote.id, timestampSaida: null },
        orderBy: { timestampEntrada: 'desc' },
      });
      if (!carimboAberto) {
        return reply.code(400).send({
          error: 'carimbo_aberto_nao_encontrado',
          message: 'Nenhum carimbo aberto encontrado pra esta OP',
        });
      }

      const paradaAberta = await prisma.paradaMaquina.findFirst({
        where: { carimboId: carimboAberto.id, fim: null },
      });
      if (paradaAberta) {
        return reply.code(409).send({
          error: 'parada_ja_aberta',
          message: 'Já existe uma parada em aberto para esta OP. Retome antes de pausar de novo.',
        });
      }

      const motivo = await prisma.motivoParada.findUnique({
        where: { id: motivoParadaId },
      });
      if (!motivo || !motivo.ativo) {
        return reply.code(404).send({
          error: 'motivo_parada_invalido',
          message: 'Motivo de parada não encontrado ou inativo',
        });
      }

      const parada = await prisma.paradaMaquina.create({
        data: {
          carimboId: carimboAberto.id,
          motivoParadaId,
          observacoes: observacoes ?? null,
          registradoPorId,
        },
        include: {
          motivoParada: { select: { id: true, nome: true, planejado: true } },
        },
      });

      return reply.code(201).send({ data: parada });
    },
  );

  // ---------------- RETOMAR (fechar parada de máquina aberta) ----------------
  app.post(
    '/op-lote/:id/retomar',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const user = request.user as any;
      if (!podeOperarTotem(user.papel)) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'Apenas programador, PCP ou admin podem retomar OPs',
        });
      }

      const { id: opLoteId } = paramsParsed.data;

      const carimboAberto = await prisma.carimbo.findFirst({
        where: { opLoteId, timestampSaida: null },
        orderBy: { timestampEntrada: 'desc' },
      });
      if (!carimboAberto) {
        return reply.code(400).send({
          error: 'carimbo_aberto_nao_encontrado',
          message: 'Nenhum carimbo aberto encontrado pra esta OP',
        });
      }

      const paradaAberta = await prisma.paradaMaquina.findFirst({
        where: { carimboId: carimboAberto.id, fim: null },
        orderBy: { inicio: 'desc' },
      });
      if (!paradaAberta) {
        return reply.code(400).send({
          error: 'parada_nao_encontrada',
          message: 'Não há parada em aberto para esta OP',
        });
      }

      const parada = await prisma.paradaMaquina.update({
        where: { id: paradaAberta.id },
        data: { fim: new Date() },
        include: {
          motivoParada: { select: { id: true, nome: true, planejado: true } },
        },
      });

      return { data: parada };
    },
  );
}
