// ============================================================
// Forja - Rotas de OPs de Lote (Operações em produção)
// Sprint 3: tótem do programador
// - Listar OPs pendentes e em andamento por estação (etapa)
// - Iniciar processamento (carimbo + processamento + evento)
// - Encerrar OP (fecha carimbo, atualiza estado, movimenta lote)
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isMetalizacao } from '@forja/shared';
import { metalizacaoExternaRoutes } from './metalizacao-externa.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { calcularFluxoDePecas } from '../lib/fluxo-pecas.js';
import { checarEstacaoDaOP } from '../lib/permissoes-estacao.js';

// ============================================================
// Schemas
// ============================================================

const filtroEstacaoSchema = z.object({
  etapaId: z.string().uuid('etapaId inválido'),
  busca: z.string().optional(),
});

// Operação terceirizada (feita fora) e operação de espera (cura, resfriamento)
// não ocupam máquina nem operador — por isso os dois campos são opcionais aqui
// e a exigência é validada conforme o tipo da OP.
const iniciarSchema = z.object({
  modoMetalizacao: z.literal('interno').optional(),
  maquinaId: z.string().uuid('maquinaId inválido').optional(),
  operadorId: z.string().uuid('operadorId inválido').optional(),
  observacoes: z.string().max(1000).nullable().optional(),
});

const encerrarSchema = z.object({
  quantidadeConcluida: z.number().int().min(0, 'Quantidade não pode ser negativa'),
  observacoes: z.string().max(1000).nullable().optional(),
});

const gatilhoAlertaSchema = z.object({
  /** null = desliga o alerta parcial nesta OP */
  gatilhoAlertaPecas: z.number().int().positive().nullable(),
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
// Primeiro filtro, barato: papéis que nunca operam o tótem morrem aqui, sem ir
// ao banco. Qual estação cada um pode operar é decidido depois, por
// checarEstacaoDaOP, que precisa saber de que etapa é a OP.
function podeOperarTotem(papel: string): boolean {
  return ['programador', 'pcp', 'admin', 'estacao'].includes(papel);
}

// ============================================================
// Rotas
// ============================================================

export async function opLoteRoutes(app: FastifyInstance) {
  await metalizacaoExternaRoutes(app);
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
                  criadoEm: true,
                  cliente: { select: { id: true, nome: true } },
                  criadoPor: { select: { id: true, nome: true } },
                  artigo: {
                    select: {
                      id: true,
                      codigo: true,
                      descricao: true,
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
                        orderBy: [{ tipo: 'asc' }, { codigoDesenho: 'asc' }, { revisao: 'asc' }],
                      },
                    },
                  },
                },
              },
              opsLote: {
                orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  codigoOp: true,
                  tipoServico: true,
                  ordem: true,
                  status: true,
                  quantidadeConcluida: true,
                  etapa: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { lote: { os: { prioridade: 'desc' } } },
          { lote: { os: { prazoEntrega: 'asc' } } },
          { ordem: 'asc' },
          { codigoOp: 'asc' },
          { id: 'asc' },
        ],
      });

      // Uma OP só é pendente quando tem peça esperando nela. As OPs de um lote
      // nascem todas na fila na criação da OS, mas ninguém molda o que ainda não
      // foi modelado — sem isso o operador via as 8 operações de uma vez e
      // precisava adivinhar qual era a da vez.
      const fluxo = await calcularFluxoDePecas([...new Set(ops.map((o) => o.loteId))]);

      // Operação anterior marcada como exigeLoteCompleto (o tratamento térmico)
      // segura o que vem depois até o lote fechar. A OP continua visível, com o
      // motivo, em vez de sumir sem explicação.
      const bloqueios = await prisma.oPLote.findMany({
        where: {
          loteId: { in: [...new Set(ops.map((o) => o.loteId))] },
          exigeLoteCompleto: true,
          status: { not: 'concluida' },
        },
        select: { loteId: true, ordem: true, tipoServico: true, quantidadeConcluida: true },
      });

      const opsComContexto = await Promise.all(
        ops.map(async (op) => {
          const pecas = fluxo.get(op.id);
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

          const trava = bloqueios.find(
            (b) => b.loteId === op.loteId && b.ordem < op.ordem,
          );

          return {
            ...op,
            carimboAnterior,
            pecasDisponiveis: pecas?.disponiveis ?? 0,
            liberadasPelaAnterior: pecas?.liberadasPelaAnterior ?? op.lote.quantidadePecas,
            bloqueadoPor: trava
              ? {
                  tipoServico: trava.tipoServico,
                  concluidas: trava.quantidadeConcluida,
                  total: op.lote.quantidadePecas,
                }
              : null,
          };
        }),
      );

      return {
        data: opsComContexto.filter((op) => op.pecasDisponiveis > 0),
      };
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
                  status: true,
                  observacoes: true,
                  criadoEm: true,
                  cliente: { select: { id: true, nome: true } },
                  criadoPor: { select: { id: true, nome: true } },
                  artigo: {
                    select: {
                      id: true,
                      codigo: true,
                      descricao: true,
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
                        orderBy: [{ tipo: 'asc' }, { codigoDesenho: 'asc' }, { revisao: 'asc' }],
                      },
                    },
                  },
                },
              },
              opsLote: {
                orderBy: { ordem: 'asc' },
                select: {
                  id: true,
                  codigoOp: true,
                  tipoServico: true,
                  ordem: true,
                  status: true,
                  quantidadeConcluida: true,
                  etapa: { select: { id: true, nome: true } },
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

      // Quantas peças esta OP recebeu da anterior — é o "3 de 12" que o
      // operador precisa ver quando o lote vem parcial.
      const fluxo = await calcularFluxoDePecas([...new Set(ops.map((o) => o.loteId))]);

      return {
        data: ops.map((op) => {
          const pecas = fluxo.get(op.id);
          return {
            ...op,
            pecasDisponiveis: pecas?.disponiveis ?? 0,
            liberadasPelaAnterior: pecas?.liberadasPelaAnterior ?? op.lote.quantidadePecas,
            bloqueadoPor: null,
          };
        }),
      };
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
          message: 'Seu usuário não opera o tótem. Entre com a conta da estação para iniciar OPs.',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { maquinaId, operadorId, observacoes } = bodyParsed.data;
      const programadorId = user.pessoaId;

      const bloqueio = await checarEstacaoDaOP(user, opLoteId);
      if (bloqueio) return reply.code(403).send(bloqueio);

      // Carrega a OP e valida
      const opLote = await prisma.oPLote.findUnique({
        where: { id: opLoteId },
        include: {
          etapa: { select: { nome: true } },
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

      // Regra do Rafael: operação marcada como exigeLoteCompleto trava o que vem
      // depois. O tratamento térmico é assim — lote parcialmente tratado não
      // desce pro desbaste.
      const travando = await prisma.oPLote.findFirst({
        where: {
          loteId: opLote.loteId,
          ordem: { lt: opLote.ordem },
          exigeLoteCompleto: true,
          status: { not: 'concluida' },
        },
        orderBy: { ordem: 'desc' },
        select: { tipoServico: true, quantidadeConcluida: true },
      });
      if (travando) {
        return reply.code(409).send({
          error: 'lote_incompleto_na_operacao_anterior',
          message: `${travando.tipoServico} ainda não fechou o lote (${travando.quantidadeConcluida}/${opLote.lote.quantidadePecas}). Esta operação só libera com o lote inteiro.`,
        });
      }

      const metalizacao = isMetalizacao(opLote.etapa.nome);
      if (metalizacao && bodyParsed.data.modoMetalizacao !== 'interno') {
        return reply.code(400).send({ error: 'escolha_metalizacao', message: 'Escolha metalização interna ou envio externo.' });
      }
      const fluxoInicio = await calcularFluxoDePecas([opLote.loteId]);
      if ((fluxoInicio.get(opLote.id)?.disponiveis ?? 0) <= 0) {
        return reply.code(409).send({ error: 'sem_pecas_disponiveis', message: 'Nenhuma peça foi liberada para esta operação.' });
      }
      const semMaquina = !metalizacao && (opLote.terceirizada || opLote.esperaHoras != null);

      // Terceirizada e espera não abrem máquina: o carimbo marca só o relógio.
      if (semMaquina) {
        const carimbo = await prisma.$transaction(async (tx) => {
          const inicio = await tx.oPLote.updateMany({
            where: { id: opLote.id, status: 'na_fila', envioExternoEm: null },
            data: { status: 'em_processo', ...(metalizacao ? { terceirizada: false } : {}) },
          });
          if (inicio.count !== 1) throw Object.assign(new Error('OP já iniciada ou enviada para fora. Atualize a fila.'), { statusCode: 409 });
          const c = await tx.carimbo.create({
            data: {
              opLoteId: opLote.id,
              loteId: opLote.loteId,
              etapaId: opLote.etapaId,
              programadorId,
              observacoes: observacoes ?? null,
            },
          });
          await tx.oPLote.update({
            where: { id: opLote.id },
            data: { status: 'em_processo' },
          });
          const lote = await tx.lote.findUnique({
            where: { id: opLote.loteId },
            select: { status: true },
          });
          if (lote?.status === 'na_fila') {
            await tx.lote.update({
              where: { id: opLote.loteId },
              data: { status: 'em_processo' },
            });
          }
          const os = await tx.oS.findUnique({
            where: { id: opLote.lote.os.id },
            select: { status: true },
          });
          if (os?.status === 'aberta') {
            await tx.oS.update({
              where: { id: opLote.lote.os.id },
              data: { status: 'em_producao' },
            });
          }
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
              carimboId: c.id,
              acao: opLote.terceirizada ? 'enviado_para_terceiro' : 'espera_iniciada',
              fornecedor: opLote.fornecedor,
              esperaHoras: opLote.esperaHoras,
            },
          });
          return c;
        });

        app.io.to(`estacao:${opLote.etapaId}`).emit('op:iniciada', {
          opLoteId: opLote.id,
          loteId: opLote.loteId,
          etapaId: opLote.etapaId,
          maquinaId: null,
        });

        const completo = await prisma.oPLote.findUnique({
          where: { id: opLote.id },
          include: {
            etapa: { select: { id: true, nome: true } },
            carimbos: { where: { id: carimbo.id } },
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
      }

      if (!maquinaId || !operadorId) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Máquina e operador são obrigatórios nesta operação',
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
          const inicio = await tx.oPLote.updateMany({
            where: { id: opLote.id, status: 'na_fila', envioExternoEm: null },
            data: { status: 'em_processo', ...(metalizacao ? { terceirizada: false } : {}) },
          });
          if (inicio.count !== 1) throw Object.assign(new Error('OP já iniciada ou enviada para fora. Atualize a fila.'), { statusCode: 409 });
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

          // Aviso de operação longa: o tratamento térmico leva ~3 dias e essa é
          // justamente a janela em que a engenharia programa o desbaste. Sem
          // isto o aviso é verbal — e quando ninguém avisa, a peça fica parada.
          // Dispara uma vez só: reiniciar depois de um encerramento parcial não
          // alerta de novo.
          let avisouInicio = false;
          if (
            opLote.avisaAoIniciar &&
            !opLote.alertaInicioEm &&
            opLote.etapaAvisadaId
          ) {
            await tx.oPLote.update({
              where: { id: opLote.id },
              data: { alertaInicioEm: new Date() },
            });
            avisouInicio = true;

            const contexto = await tx.oPLote.findUnique({
              where: { id: opLote.id },
              select: {
                tipoServico: true,
                lote: {
                  select: {
                    numeroLote: true,
                    os: {
                      select: {
                        codigoGrv: true,
                        artigo: { select: { codigo: true } },
                      },
                    },
                  },
                },
                etapaAvisada: { select: { nome: true } },
              },
            });

            const mensagem = contexto
              ? `${contexto.lote.os.codigoGrv} (${contexto.lote.os.artigo.codigo}) — lote ${contexto.lote.numeroLote} entrou em ${contexto.tipoServico}. Já dá pra adiantar o próximo programa.`
              : 'Operação de ciclo longo iniciada. Já dá pra adiantar o próximo programa.';

            // A API de avisos restringe leitura e confirmação às contas
            // vinculadas à estação destinatária.
            await tx.alerta.create({
              data: {
                tipo: 'fase_iniciada',
                severidade: 'info',
                entidadeTipo: 'OPLote',
                entidadeId: opLote.id,
                etapaDestinoId: opLote.etapaAvisadaId,
                canal: 'dashboard',
                mensagem,
              },
            });
          }

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

          return { carimbo, processamento, avisouInicio };
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

        if (resultado.avisouInicio) {
          // Global: quem precisa saber está na etapa avisada, não nesta.
          app.io.emit('op:fase-iniciada', {
            opLoteId: opLote.id,
            etapaId: opLote.etapaId,
            etapaAvisadaId: opLote.etapaAvisadaId,
            codigoOp: opLote.codigoOp,
            tipoServico: opLote.tipoServico,
          });
        }

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
        if (err.statusCode === 409) return reply.code(409).send({ error: 'op_nao_disponivel', message: err.message });
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
          message: 'Seu usuário não opera o tótem. Entre com a conta da estação para encerrar OPs.',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { quantidadeConcluida, observacoes } = bodyParsed.data;
      const autorId = user.pessoaId;

      const bloqueio = await checarEstacaoDaOP(user, opLoteId);
      if (bloqueio) return reply.code(403).send(bloqueio);

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

      // O teto não é o lote inteiro, é o que ESTA operação recebeu da anterior.
      // Encerrar a moldagem com 12 quando só 3 foram modeladas inflaria a conta
      // que a engenharia usa pra se programar.
      const fluxoLote = await calcularFluxoDePecas([opLote.loteId]);
      const recebidas =
        fluxoLote.get(opLote.id)?.liberadasPelaAnterior ?? opLote.lote.quantidadePecas;

      if (quantidadeConcluida > recebidas) {
        return reply.code(400).send({
          error: 'quantidade_invalida',
          message:
            recebidas === opLote.lote.quantidadePecas
              ? `Quantidade (${quantidadeConcluida}) maior que o tamanho do lote (${opLote.lote.quantidadePecas})`
              : `Quantidade (${quantidadeConcluida}) maior que as ${recebidas} peça(s) que chegaram nesta operação.`,
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
        if (err.statusCode === 409) return reply.code(409).send({ error: 'op_nao_disponivel', message: err.message });
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
          message: 'Seu usuário não opera o tótem. Entre com a conta da estação para pausar OPs.',
        });
      }

      const { id: opLoteId } = paramsParsed.data;
      const { motivoParadaId, observacoes } = bodyParsed.data;
      const registradoPorId = user.pessoaId;

      const bloqueio = await checarEstacaoDaOP(user, opLoteId);
      if (bloqueio) return reply.code(403).send(bloqueio);

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
          message: 'Seu usuário não opera o tótem. Entre com a conta da estação para retomar OPs.',
        });
      }

      const { id: opLoteId } = paramsParsed.data;

      const bloqueio = await checarEstacaoDaOP(user, opLoteId);
      if (bloqueio) return reply.code(403).send(bloqueio);

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

  // ---------------- EDITAR GATILHO DE ALERTA PARCIAL ----------------
  // O PCP ajusta, por lote, a quantidade que avisa a etapa seguinte.
  // Na prática quem define é o chão de fábrica (liga pro PCP), por isso
  // o número não pode ficar preso no roteiro.
  app.patch(
    '/op-lote/:id/gatilho-alerta',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = gatilhoAlertaSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user as any;
      if (!['pcp', 'admin', 'chefe'].includes(user.papel)) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'Apenas PCP, chefe ou admin podem ajustar o gatilho de alerta',
        });
      }

      const opLote = await prisma.oPLote.findUnique({
        where: { id: paramsParsed.data.id },
        include: { lote: { select: { quantidadePecas: true } } },
      });
      if (!opLote) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OP não encontrada' });
      }

      const { gatilhoAlertaPecas } = bodyParsed.data;
      if (
        gatilhoAlertaPecas != null &&
        gatilhoAlertaPecas > opLote.lote.quantidadePecas
      ) {
        return reply.code(400).send({
          error: 'gatilho_maior_que_lote',
          message: `O gatilho (${gatilhoAlertaPecas}) não pode ser maior que o lote (${opLote.lote.quantidadePecas} peças).`,
        });
      }

      const atualizado = await prisma.oPLote.update({
        where: { id: opLote.id },
        data: {
          gatilhoAlertaPecas,
          // Baixar o gatilho reabre a possibilidade de avisar de novo.
          alertaParcialEm:
            gatilhoAlertaPecas != null &&
            opLote.quantidadeConcluida < gatilhoAlertaPecas
              ? null
              : opLote.alertaParcialEm,
        },
      });

      return { data: atualizado };
    },
  );

  // ---------------- OBTER DETALHES DE UMA OP ----------------
  app.get(
    '/op-lote/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const { id } = paramsParsed.data;

      const op = await prisma.oPLote.findUnique({
        where: { id },
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
                  criadoEm: true,
                  cliente: { select: { id: true, nome: true } },
                  criadoPor: { select: { id: true, nome: true } },
                  artigo: {
                    select: {
                      id: true,
                      codigo: true,
                      descricao: true,
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
                        orderBy: [
                          { tipo: 'asc' },
                          { codigoDesenho: 'asc' },
                          { revisao: 'asc' },
                        ],
                      },
                    },
                  },
                },
              },
              opsLote: {
                orderBy: { ordem: 'asc' },
                select: {
                  id: true,
                  codigoOp: true,
                  tipoServico: true,
                  ordem: true,
                  status: true,
                  quantidadeConcluida: true,
                  etapa: { select: { id: true, nome: true } },
                },
              },
            },
          },
          carimbos: {
            orderBy: { timestampEntrada: 'desc' },
            include: {
              maquina: { select: { id: true, nome: true, codigoInterno: true } },
              programador: { select: { id: true, nome: true } },
              operadorResponsavel: { select: { id: true, nome: true } },
              paradas: {
                orderBy: { inicio: 'desc' },
                include: {
                  motivoParada: {
                    select: { id: true, nome: true, planejado: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!op) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OP não encontrada' });
      }

      return { data: op };
    },
  );
}
