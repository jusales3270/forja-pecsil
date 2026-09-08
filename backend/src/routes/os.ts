// ============================================================
// Forja - Rotas de Ordens de Serviço (OS)
// Sprint 2b: criação, listagem, edição, cancelamento e timeline
// Geração automática de Lotes e OPLotes a partir do Artigo
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

// ============================================================
// Schemas
// ============================================================

const divisaoLotesSchema = z
  .union([
    z.object({
      tipoDivisao: z.literal('unico').optional(),
    }),
    z.object({
      tipoDivisao: z.literal('quantidade_lotes'),
      quantidadeLotes: z.number().int().min(1).max(100),
    }),
    z.object({
      tipoDivisao: z.literal('tamanho_lote'),
      tamanhoLote: z.number().int().min(1),
    }),
  ])
  .optional();

const criarOSSchema = z.object({
  codigoGrv: z
    .string()
    .min(1, 'Código GRV é obrigatório')
    .max(50, 'Código GRV muito longo'),
  clienteId: z.string().uuid('clienteId inválido'),
  artigoId: z.string().uuid('artigoId inválido'),
  quantidadeTotal: z.number().int().min(1, 'Quantidade deve ser >= 1'),
  prazoEntrega: z.string().datetime({ offset: true }),
  prioridade: z.enum(['normal', 'urgente']).default('normal'),
  observacoes: z.string().max(2000).nullable().optional(),
  // Financeiros
  precoUnitario: z.number().nonnegative().nullable().optional(),
  valorTotal: z.number().nonnegative().nullable().optional(),
  numeroFiscal: z.string().max(50).nullable().optional(),
  poCliente: z.string().max(100).nullable().optional(),
  statusFiscal: z.string().max(50).nullable().optional(),
  valorRecebido: z.number().nonnegative().nullable().optional(),
  dataNf: z.string().datetime({ offset: true }).nullable().optional(),
  dataPagamento: z.string().datetime({ offset: true }).nullable().optional(),
  // Divisão de lotes
  divisao: divisaoLotesSchema,
});

const atualizarOSSchema = z.object({
  prazoEntrega: z.string().datetime({ offset: true }).optional(),
  prioridade: z.enum(['normal', 'urgente']).optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  precoUnitario: z.number().nonnegative().nullable().optional(),
  valorTotal: z.number().nonnegative().nullable().optional(),
  numeroFiscal: z.string().max(50).nullable().optional(),
  poCliente: z.string().max(100).nullable().optional(),
  statusFiscal: z.string().max(50).nullable().optional(),
  valorRecebido: z.number().nonnegative().nullable().optional(),
  dataNf: z.string().datetime({ offset: true }).nullable().optional(),
  dataPagamento: z.string().datetime({ offset: true }).nullable().optional(),
});

const listaQuerySchema = z.object({
  clienteId: z.string().uuid().optional(),
  artigoId: z.string().uuid().optional(),
  status: z
    .enum(['aberta', 'em_producao', 'finalizada', 'atrasada', 'cancelada'])
    .optional(),
  prioridade: z.enum(['normal', 'urgente']).optional(),
  busca: z.string().optional(),
});

// ============================================================
// Helpers
// ============================================================

// Calcula como dividir a quantidade total em lotes
// Retorna array com a quantidade de cada lote
function calcularDivisaoLotes(
  total: number,
  divisao: z.infer<typeof divisaoLotesSchema>
): number[] {
  if (!divisao || !divisao.tipoDivisao || divisao.tipoDivisao === 'unico') {
    return [total];
  }

  if (divisao.tipoDivisao === 'quantidade_lotes') {
    const n = divisao.quantidadeLotes;
    if (n <= 0 || n > total) return [total];
    const base = Math.floor(total / n);
    const resto = total - base * n;
    // Distribui o resto: primeiros lotes ganham +1 peça
    return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
  }

  if (divisao.tipoDivisao === 'tamanho_lote') {
    const x = divisao.tamanhoLote;
    if (x <= 0 || x >= total) return [total];
    const lotes: number[] = [];
    let restante = total;
    while (restante > 0) {
      const q = Math.min(x, restante);
      lotes.push(q);
      restante -= q;
    }
    return lotes;
  }

  return [total];
}

// Cria evento de OS dentro de uma transação
async function criarEvento(
  tx: Prisma.TransactionClient,
  data: {
    osId: string;
    loteId?: string;
    tipo: any; // TipoEventoOS — string literal do enum Prisma
    autorId?: string;
    payload?: any;
    visivelDashboard?: boolean;
  }
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

// ============================================================
// Rotas
// ============================================================

export async function osRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get('/os', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = listaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Filtros inválidos',
        details: parsed.error.flatten(),
      });
    }

    const { clienteId, artigoId, status, prioridade, busca } = parsed.data;

    const where: Prisma.OSWhereInput = {};
    if (clienteId) where.clienteId = clienteId;
    if (artigoId) where.artigoId = artigoId;
    if (status) where.status = status;
    if (prioridade) where.prioridade = prioridade;
    if (busca) {
      where.OR = [
        { codigoGrv: { contains: busca, mode: 'insensitive' } },
        { artigo: { codigo: { contains: busca, mode: 'insensitive' } } },
        { artigo: { descricao: { contains: busca, mode: 'insensitive' } } },
      ];
    }

    const oses = await prisma.oS.findMany({
      where,
      orderBy: [{ prioridade: 'desc' }, { prazoEntrega: 'asc' }],
      include: {
        cliente: { select: { id: true, nome: true } },
        artigo: {
          select: { id: true, codigo: true, descricao: true, tipoProduto: true },
        },
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { lotes: true } },
      },
    });

    return { data: oses };
  });

  // ---------------- DETALHE ----------------
  app.get(
    '/os/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const os = await prisma.oS.findUnique({
        where: { id: parsed.data.id },
        include: {
          cliente: true,
          artigo: { select: { id: true, codigo: true, descricao: true, tipoProduto: true } },
          criadoPor: { select: { id: true, nome: true } },
          lotes: {
            orderBy: { numeroLote: 'asc' },
            include: {
              opsLote: {
                orderBy: { ordem: 'asc' },
                include: {
                  etapa: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
      });

      if (!os) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OS não encontrada' });
      }

      return { data: os };
    }
  );

  // ---------------- CRIAR ----------------
  app.post('/os', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = criarOSSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Dados inválidos',
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    const autorId = (request.user as any).pessoaId;

    // Validações de negócio antes de abrir transação

    // 1. Código GRV único
    const existente = await prisma.oS.findUnique({
      where: { codigoGrv: data.codigoGrv },
    });
    if (existente) {
      return reply.code(409).send({
        error: 'duplicate_codigo_grv',
        message: `Já existe uma OS com o código GRV "${data.codigoGrv}"`,
      });
    }

    // 2. Cliente existe e ativo
    const cliente = await prisma.cliente.findUnique({
      where: { id: data.clienteId },
    });
    if (!cliente || !cliente.ativo) {
      return reply.code(404).send({
        error: 'cliente_invalido',
        message: 'Cliente não encontrado ou inativo',
      });
    }

    // 3. Artigo existe, ativo e com status='ativo'
    const artigo = await prisma.artigo.findUnique({
      where: { id: data.artigoId },
      include: {
        operacoes: {
          orderBy: { ordem: 'asc' },
        },
      },
    });
    if (!artigo || !artigo.ativo) {
      return reply.code(404).send({
        error: 'artigo_invalido',
        message: 'Artigo não encontrado ou inativo',
      });
    }
    if (artigo.status !== 'ativo') {
      return reply.code(400).send({
        error: 'artigo_nao_ativo',
        message: `Artigo está com status "${artigo.status}". Só Artigos com status "ativo" podem ser usados em uma OS.`,
      });
    }
    if (artigo.operacoes.length === 0) {
      return reply.code(400).send({
        error: 'artigo_sem_operacoes',
        message: 'Artigo não tem operações cadastradas',
      });
    }

    // 4. Prazo de entrega no futuro
    const prazo = new Date(data.prazoEntrega);
    if (prazo.getTime() <= Date.now()) {
      return reply.code(400).send({
        error: 'prazo_invalido',
        message: 'Prazo de entrega deve ser futuro',
      });
    }

    // 5. Calcula a divisão de lotes
    const divisaoLotes = calcularDivisaoLotes(
      data.quantidadeTotal,
      data.divisao
    );

    // Transação: cria OS, lotes, OPLotes e evento
    try {
      const osCriada = await prisma.$transaction(async (tx) => {
        // Cria a OS
        const os = await tx.oS.create({
          data: {
            codigoGrv: data.codigoGrv,
            clienteId: data.clienteId,
            artigoId: data.artigoId,
            quantidadeTotal: data.quantidadeTotal,
            prazoEntrega: prazo,
            prioridade: data.prioridade,
            observacoes: data.observacoes ?? null,
            precoUnitario: data.precoUnitario ?? null,
            valorTotal: data.valorTotal ?? null,
            numeroFiscal: data.numeroFiscal ?? null,
            poCliente: data.poCliente ?? null,
            statusFiscal: data.statusFiscal ?? null,
            valorRecebido: data.valorRecebido ?? null,
            dataNf: data.dataNf ? new Date(data.dataNf) : null,
            dataPagamento: data.dataPagamento
              ? new Date(data.dataPagamento)
              : null,
            criadoPorId: autorId,
          },
        });

        // Evento principal: OS criada
        await criarEvento(tx, {
          osId: os.id,
          tipo: 'os_criada',
          autorId,
          payload: {
            codigoGrv: os.codigoGrv,
            clienteId: os.clienteId,
            artigoId: os.artigoId,
            quantidadeTotal: os.quantidadeTotal,
            quantidadeLotes: divisaoLotes.length,
            divisaoLotes,
          },
        });

        // Cria os lotes (e OPLotes para cada um)
        for (let i = 0; i < divisaoLotes.length; i++) {
          const quantidadeLote = divisaoLotes[i];
          const lote = await tx.lote.create({
            data: {
              osId: os.id,
              numeroLote: i + 1,
              quantidadePecas: quantidadeLote,
            },
          });

          // Cria OPLotes (snapshot das OPs do Artigo) pra esse lote
          for (const op of artigo.operacoes) {
            await tx.oPLote.create({
              data: {
                loteId: lote.id,
                operacaoArtigoId: op.id,
                etapaId: op.etapaId,
                ordem: op.ordem,
                tempoUnitPlanejado: op.tempoUnitMin,
                tempoTotalPlanejado: op.tempoUnitMin * quantidadeLote,
                codigoOp: op.codigoOp,
                tipoServico: op.tipoServico,
                exigeInspecao: op.exigeInspecao,
                gatilhoAlertaPecas: op.gatilhoAlertaPecas,
                avisaAoIniciar: op.avisaAoIniciar,
                etapaAvisadaId: op.etapaAvisadaId,
                terceirizada: op.terceirizada,
                fornecedor: op.fornecedor,
                prazoPrevistoDias: op.prazoPrevistoDias,
                custoPrevisto: op.custoPrevisto,
                esperaHoras: op.esperaHoras,
                exigeLoteCompleto: op.exigeLoteCompleto,
                observacoes: op.observacoes ?? null,
              },
            });
          }

          await criarEvento(tx, {
            osId: os.id,
            loteId: lote.id,
            tipo: 'lote_criado',
            autorId,
            payload: {
              numeroLote: lote.numeroLote,
              quantidadePecas: lote.quantidadePecas,
              totalOps: artigo.operacoes.length,
            },
          });
        }


        return os;
      });

      // Re-fetch com tudo incluído (mais simples que fazer dentro da transação)
      const completo = await prisma.oS.findUnique({
        where: { id: osCriada.id },
        include: {
          cliente: { select: { id: true, nome: true } },
          artigo: { select: { id: true, codigo: true, descricao: true } },
          lotes: {
            orderBy: { numeroLote: 'asc' },
            include: {
              opsLote: {
                orderBy: { ordem: 'asc' },
                include: { etapa: { select: { id: true, nome: true } } },
              },
            },
          },
        },
      });

      return reply.code(201).send({ data: completo });
    } catch (err: any) {
      app.log.error({ err }, 'Erro ao criar OS');
      return reply.code(500).send({
        error: 'erro_interno',
        message: 'Erro ao criar OS. Tente novamente.',
      });
    }
  });

  // ---------------- ATUALIZAR ----------------
  app.patch(
    '/os/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const bodyParsed = atualizarOSSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: bodyParsed.error.flatten(),
        });
      }

      const os = await prisma.oS.findUnique({
        where: { id: paramsParsed.data.id },
      });
      if (!os) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OS não encontrada' });
      }
      if (os.status === 'finalizada' || os.status === 'cancelada') {
        return reply.code(400).send({
          error: 'os_imutavel',
          message: `OS está com status "${os.status}" e não pode mais ser editada`,
        });
      }

      const data = bodyParsed.data;
      const autorId = (request.user as any).pessoaId;

      const atualizada = await prisma.$transaction(async (tx) => {
        const updated = await tx.oS.update({
          where: { id: os.id },
          data: {
            prazoEntrega: data.prazoEntrega
              ? new Date(data.prazoEntrega)
              : undefined,
            prioridade: data.prioridade,
            observacoes:
              data.observacoes === undefined ? undefined : data.observacoes,
            precoUnitario:
              data.precoUnitario === undefined ? undefined : data.precoUnitario,
            valorTotal:
              data.valorTotal === undefined ? undefined : data.valorTotal,
            numeroFiscal:
              data.numeroFiscal === undefined ? undefined : data.numeroFiscal,
            poCliente:
              data.poCliente === undefined ? undefined : data.poCliente,
            statusFiscal:
              data.statusFiscal === undefined ? undefined : data.statusFiscal,
            valorRecebido:
              data.valorRecebido === undefined ? undefined : data.valorRecebido,
            dataNf:
              data.dataNf === undefined
                ? undefined
                : data.dataNf
                ? new Date(data.dataNf)
                : null,
            dataPagamento:
              data.dataPagamento === undefined
                ? undefined
                : data.dataPagamento
                ? new Date(data.dataPagamento)
                : null,
          },
        });

        // Evento específico se prazo ou prioridade mudou
        if (data.prazoEntrega && data.prazoEntrega !== os.prazoEntrega.toISOString()) {
          await criarEvento(tx, {
            osId: os.id,
            tipo: 'prazo_alterado',
            autorId,
            payload: {
              prazoAnterior: os.prazoEntrega.toISOString(),
              prazoNovo: data.prazoEntrega,
            },
          });
        }
        if (data.prioridade && data.prioridade !== os.prioridade) {
          await criarEvento(tx, {
            osId: os.id,
            tipo: 'prioridade_alterada',
            autorId,
            payload: {
              prioridadeAnterior: os.prioridade,
              prioridadeNova: data.prioridade,
            },
          });
        }

        // Evento genérico de alteração (financeiros, observações)
        await criarEvento(tx, {
          osId: os.id,
          tipo: 'os_alterada',
          autorId,
          payload: { camposAtualizados: Object.keys(data) },
          visivelDashboard: false,
        });

        return updated;
      });

      return { data: atualizada };
    }
  );

  // ---------------- CANCELAR (soft) ----------------
  app.delete(
    '/os/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const os = await prisma.oS.findUnique({
        where: { id: parsed.data.id },
      });
      if (!os) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OS não encontrada' });
      }
      if (os.status === 'cancelada') {
        return reply.code(400).send({
          error: 'ja_cancelada',
          message: 'OS já está cancelada',
        });
      }
      if (os.status === 'finalizada') {
        return reply.code(400).send({
          error: 'os_finalizada',
          message: 'OS já está finalizada e não pode ser cancelada',
        });
      }

      const autorId = (request.user as any).pessoaId;

      await prisma.$transaction(async (tx) => {
        await tx.oS.update({
          where: { id: os.id },
          data: { status: 'cancelada' },
        });
        await criarEvento(tx, {
          osId: os.id,
          tipo: 'os_alterada',
          autorId,
          payload: { acao: 'cancelada', statusAnterior: os.status },
        });
      });

      return { data: { id: os.id, cancelada: true } };
    }
  );

  // ---------------- TIMELINE ----------------
  app.get(
    '/os/:id/timeline',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const os = await prisma.oS.findUnique({
        where: { id: parsed.data.id },
        select: { id: true },
      });
      if (!os) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OS não encontrada' });
      }

      const eventos = await prisma.eventoOS.findMany({
        where: { osId: parsed.data.id },
        orderBy: { timestamp: 'asc' },
        include: {
          autor: { select: { id: true, nome: true } },
          lote: { select: { id: true, numeroLote: true } },
        },
      });

      return { data: eventos };
    }
  );

  // ---------------- GERAR OPS TESTE FUNDIÇÃO (LINHA COMPLETA 13 ETAPAS) ----------------
  app.post(
    '/os/gerar-teste-fundicao',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const autorId = (request.user as any)?.pessoaId;
      const { buscarRoteiroPadrao, PASSO_SEQUENCIA } = await import('../data/roteiros-padrao.js');

      // 1. Cliente teste
      let cliente = await prisma.cliente.findFirst({
        where: { nome: 'CLIENTE TESTE FUNDIÇÃO' },
      });
      if (!cliente) {
        cliente = await prisma.cliente.create({
          data: { nome: 'CLIENTE TESTE FUNDIÇÃO', ativo: true },
        });
      }

      // 2. Roteiro fundicao-grv (13 operações completas)
      const roteiro = buscarRoteiroPadrao('fundicao-grv');
      if (!roteiro) {
        return reply.code(404).send({ error: 'roteiro_nao_encontrado', message: 'Roteiro fundicao-grv não encontrado' });
      }

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

      const listaNovasOS = [
        {
          codigoGrv: 'OS-TEST-FUND-02',
          artigoCodigo: 'ART-TEST-FUND-02',
          artigoDescricao: 'FORMA BL 600ML FOFO 96A',
          tipoProduto: 'forma' as const,
          quantidadePecas: 2,
          prioridade: 'normal' as const,
        },
        {
          codigoGrv: 'OS-TEST-FUND-03',
          artigoCodigo: 'ART-TEST-FUND-03',
          artigoDescricao: 'FUNDO FORMA CERVEJA 350ML',
          tipoProduto: 'fundo_forma' as const,
          quantidadePecas: 4,
          prioridade: 'urgente' as const,
        },
        {
          codigoGrv: 'OS-TEST-FUND-04',
          artigoCodigo: 'ART-TEST-FUND-04',
          artigoDescricao: 'BLOCO MOLDE REFRIGERANTE 500ML',
          tipoProduto: 'bloco' as const,
          quantidadePecas: 5,
          prioridade: 'normal' as const,
        },
      ];

      const prazoEntrega = new Date();
      prazoEntrega.setDate(prazoEntrega.getDate() + 10);

      const ossCriadas = [];

      for (const def of listaNovasOS) {
        // Limpa teste anterior se existir
        const osExistente = await prisma.oS.findUnique({
          where: { codigoGrv: def.codigoGrv },
          include: {
            lotes: {
              include: {
                opsLote: { select: { id: true } },
              },
            },
          },
        });

        if (osExistente) {
          const opIds = osExistente.lotes.flatMap((l) => l.opsLote.map((o) => o.id));
          const loteIds = osExistente.lotes.map((l) => l.id);

          await prisma.apontamentoPeca.deleteMany({ where: { opLoteId: { in: opIds } } });
          await prisma.paradaMaquina.deleteMany({ where: { carimbo: { opLoteId: { in: opIds } } } });
          await prisma.processamentoMaquina.deleteMany({ where: { carimbo: { opLoteId: { in: opIds } } } });
          await prisma.carimbo.deleteMany({ where: { opLoteId: { in: opIds } } });
          await prisma.alerta.deleteMany({
            where: {
              OR: [
                { entidadeTipo: 'OPLote', entidadeId: { in: opIds } },
                { entidadeTipo: 'OS', entidadeId: osExistente.id },
              ],
            },
          });
          await prisma.oPLote.deleteMany({ where: { id: { in: opIds } } });
          await prisma.eventoOS.deleteMany({ where: { osId: osExistente.id } });
          await prisma.lote.deleteMany({ where: { id: { in: loteIds } } });
          await prisma.oS.delete({ where: { id: osExistente.id } });
        }

        // Artigo
        let artigo = await prisma.artigo.findFirst({
          where: { codigo: def.artigoCodigo, clienteId: cliente.id },
        });

        if (!artigo) {
          artigo = await prisma.artigo.create({
            data: {
              codigo: def.artigoCodigo,
              descricao: def.artigoDescricao,
              clienteId: cliente.id,
              tipoProduto: def.tipoProduto,
              status: 'ativo',
              criadoPorId: autorId,
            },
          });
        }

        // Garante as 13 operações no artigo
        await prisma.operacaoArtigo.deleteMany({ where: { artigoId: artigo.id } });

        for (let i = 0; i < roteiro.operacoes.length; i++) {
          const op = roteiro.operacoes[i];
          const tipo = porCodigo.get(op.codigoTipoServico);
          if (!tipo) continue;

          const etapaAvisada = op.avisaEtapaDoCodigoTipoServico
            ? porCodigo.get(op.avisaEtapaDoCodigoTipoServico)?.etapaId ?? null
            : null;

          await prisma.operacaoArtigo.create({
            data: {
              artigoId: artigo.id,
              etapaId: tipo.etapaId,
              tipoServicoId: tipo.id,
              codigoOp: String((i + 1) * PASSO_SEQUENCIA),
              ordem: i,
              tipoServico: tipo.nome,
              tempoUnitMin: op.tempoUnitMin,
              tempoSetupMin: op.tempoSetupMin,
              exigeInspecao: op.exigeInspecao,
              avisaAoIniciar: op.avisaAoIniciar ?? false,
              etapaAvisadaId: etapaAvisada,
              exigeLoteCompleto: op.exigeLoteCompleto ?? false,
              observacoes: op.observacoes,
            },
          });
        }

        const operacoesArtigo = await prisma.operacaoArtigo.findMany({
          where: { artigoId: artigo.id },
          orderBy: { ordem: 'asc' },
        });

        // Cria OS, Lote e 13 OPs
        const osNova = await prisma.$transaction(async (tx) => {
          const osCriada = await tx.oS.create({
            data: {
              codigoGrv: def.codigoGrv,
              clienteId: cliente!.id,
              artigoId: artigo!.id,
              quantidadeTotal: def.quantidadePecas,
              prazoEntrega,
              prioridade: def.prioridade,
              status: 'aberta',
              observacoes: `OS Teste ${def.codigoGrv} - Linha Completa 13 Operações`,
              criadoPorId: autorId,
            },
          });

          const lote = await tx.lote.create({
            data: {
              osId: osCriada.id,
              numeroLote: 1,
              quantidadePecas: def.quantidadePecas,
              status: 'na_fila',
            },
          });

          for (const op of operacoesArtigo) {
            await tx.oPLote.create({
              data: {
                loteId: lote.id,
                operacaoArtigoId: op.id,
                etapaId: op.etapaId,
                ordem: op.ordem,
                tempoUnitPlanejado: op.tempoUnitMin,
                tempoTotalPlanejado: op.tempoUnitMin * def.quantidadePecas,
                codigoOp: op.codigoOp,
                tipoServico: op.tipoServico,
                exigeInspecao: op.exigeInspecao,
                avisaAoIniciar: op.avisaAoIniciar,
                etapaAvisadaId: op.etapaAvisadaId,
                exigeLoteCompleto: op.exigeLoteCompleto,
                status: 'na_fila',
                quantidadeConcluida: 0,
                observacoes: op.observacoes,
              },
            });
          }

          await tx.eventoOS.create({
            data: {
              osId: osCriada.id,
              loteId: lote.id,
              tipo: 'os_criada',
              autorId,
              payload: { codigoGrv: def.codigoGrv, quantidadePecas: def.quantidadePecas },
            },
          });

          return osCriada;
        });

        ossCriadas.push(osNova);
      }

      return reply.code(201).send({
        data: {
          mensagem: '3 novas OPs com linha de produção completa (13 etapas) criadas na Fundição!',
          oses: ossCriadas.map((os) => ({ id: os.id, codigoGrv: os.codigoGrv, status: os.status })),
        },
      });
    },
  );
}
