// ============================================================
// Forja - Rotas de Ordens de Serviço (OS)
// Sprint 2b: criação, listagem, edição, cancelamento e timeline
// Geração automática de Lotes e OPLotes a partir do Artigo
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { exigirModulo } from '../lib/acessos.js';
import { compararPrevistoRealizado } from '../lib/previsto-realizado.js';
import {
  type AvisoChegada,
  calcularDivisaoLotes,
  copiarMateriais,
  criarEvento,
  ehCodigoProvisorio,
  gerarLotesEOps,
  ORIGEM_TREINO,
} from '../lib/os-producao.js';

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

// Liberar o rascunho (orçamento ganho no Business OS) para produção.
const liberarOSSchema = z.object({
  codigoGrv: z.string().trim().min(1, 'Informe o número da OS').max(50, 'Número da OS muito longo'),
  quantidadeTotal: z.number().int().min(1).optional(),
  prazoEntrega: z.string().datetime({ offset: true }).optional(),
  artigoId: z.string().uuid().optional(),
  divisao: divisaoLotesSchema,
  /** O PCP confirmou liberar sem desenho / sem lista de materiais. */
  semDesenho: z.boolean().optional(),
  semMateriais: z.boolean().optional(),
});

const listaQuerySchema = z.object({
  clienteId: z.string().uuid().optional(),
  artigoId: z.string().uuid().optional(),
  status: z
    .enum(['rascunho', 'aberta', 'em_producao', 'finalizada', 'atrasada', 'cancelada'])
    .optional(),
  prioridade: z.enum(['normal', 'urgente']).optional(),
  busca: z.string().optional(),
});

// ============================================================
// Helpers
// ============================================================

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
          artigo: {
            select: {
              id: true, codigo: true, descricao: true, tipoProduto: true, status: true,
              // O que o rascunho precisa para ser liberado (checklist na tela da OS)
              _count: { select: { operacoes: true, desenhos: true, materiais: true } },
            },
          },
          materiais: { orderBy: { ordem: 'asc' } },
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
  // Criar e editar OS exige o módulo Ordens de Serviço também no backend (antes
  // só o frontend conferia): conta de estação ou de integração não abre OS.
  app.post('/os', { onRequest: [exigirModulo('ordens_servico')] }, async (request, reply) => {
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
    const avisos: AvisoChegada[] = [];
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

        // Lotes, OPs (cópia do roteiro), aviso à 1ª estação e materiais
        avisos.push(...(await gerarLotesEOps(tx, { osId: os.id, operacoes: artigo.operacoes, divisaoLotes, autorId })));
        await copiarMateriais(tx, { osId: os.id, artigoId: artigo.id, quantidadeTotal: os.quantidadeTotal });

        return os;
      });

      for (const a of avisos) {
        app.io.to(`estacao:${a.etapaId}`).emit('op:nova-na-fila', a);
      }

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
    { onRequest: [exigirModulo('ordens_servico')] },
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

  // ---------------- LIBERAR RASCUNHO ----------------
  // O rascunho vem do orçamento ganho (sem lotes nem OPs, fora do Tótem). O PCP
  // completa o Artigo (roteiro, desenhos, materiais), informa o número da OS e
  // libera: aqui nascem os lotes e as OPs, e a 1ª estação é avisada.
  app.post(
    '/os/:id/liberar',
    { onRequest: [exigirModulo('ordens_servico')] },
    async (request, reply) => {
      const paramsParsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!paramsParsed.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
      const parsed = liberarOSSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'Dados inválidos', details: parsed.error.flatten() });
      }
      const data = parsed.data;
      const autorId = (request.user as any).pessoaId;

      const os = await prisma.oS.findUnique({ where: { id: paramsParsed.data.id } });
      if (!os) return reply.code(404).send({ error: 'not_found', message: 'OS não encontrada' });
      if (os.status !== 'rascunho') {
        return reply.code(409).send({ error: 'nao_e_rascunho', message: `A OS já está "${os.status}": só rascunho é liberado.` });
      }
      if (os.origem === ORIGEM_TREINO) {
        return reply.code(409).send({ error: 'treino', message: 'Rascunho de TREINO: serve para praticar e não vai para produção.' });
      }

      const codigoGrv = data.codigoGrv.trim();
      if (ehCodigoProvisorio(codigoGrv)) {
        return reply.code(400).send({ error: 'codigo_provisorio', message: 'Troque o código provisório pelo número da OS.' });
      }
      const outra = await prisma.oS.findUnique({ where: { codigoGrv } });
      if (outra && outra.id !== os.id) {
        return reply.code(409).send({ error: 'duplicate_codigo_grv', message: `Já existe uma OS com o código GRV "${codigoGrv}"` });
      }

      const artigo = await prisma.artigo.findUnique({
        where: { id: data.artigoId ?? os.artigoId },
        include: { operacoes: { orderBy: { ordem: 'asc' } }, _count: { select: { desenhos: true, materiais: true } } },
      });
      if (!artigo || !artigo.ativo) return reply.code(404).send({ error: 'artigo_invalido', message: 'Artigo não encontrado ou inativo' });
      if (artigo.status === 'arquivado') return reply.code(400).send({ error: 'artigo_nao_ativo', message: 'Artigo arquivado não abre OS.' });
      if (artigo.operacoes.length === 0) {
        return reply.code(400).send({ error: 'artigo_sem_operacoes', message: 'Complete o roteiro do artigo (operações) antes de liberar.' });
      }
      const faltam = {
        semDesenho: artigo._count.desenhos === 0 && !data.semDesenho,
        semMateriais: artigo._count.materiais === 0 && !data.semMateriais,
      };
      if (faltam.semDesenho || faltam.semMateriais) {
        return reply.code(409).send({
          error: 'confirmar_pendencias',
          message: [faltam.semDesenho && 'o artigo não tem desenho', faltam.semMateriais && 'o artigo não tem lista de materiais'].filter(Boolean).join(' e ') + '. Confirme para liberar assim mesmo.',
          details: faltam,
        });
      }

      const prazo = data.prazoEntrega ? new Date(data.prazoEntrega) : os.prazoEntrega;
      if (prazo.getTime() <= Date.now()) {
        return reply.code(400).send({ error: 'prazo_invalido', message: 'Prazo de entrega deve ser futuro' });
      }
      const quantidadeTotal = data.quantidadeTotal ?? os.quantidadeTotal;
      const divisaoLotes = calcularDivisaoLotes(quantidadeTotal, data.divisao);

      const avisos: AvisoChegada[] = [];
      try {
        await prisma.$transaction(async (tx) => {
          // Artigo novo do orçamento nasce em rascunho: com roteiro, vira ativo aqui.
          if (artigo.status === 'rascunho') await tx.artigo.update({ where: { id: artigo.id }, data: { status: 'ativo' } });
          // Guarda: dois cliques ao mesmo tempo não liberam duas vezes.
          const virou = await tx.oS.updateMany({
            where: { id: os.id, status: 'rascunho' },
            data: {
              codigoGrv, artigoId: artigo.id, quantidadeTotal, prazoEntrega: prazo,
              status: 'aberta', liberadaEm: new Date(), dataAbertura: new Date(),
            },
          });
          if (virou.count !== 1) throw Object.assign(new Error('já liberada'), { code: 'JA_LIBERADA' });
          await criarEvento(tx, {
            osId: os.id,
            tipo: 'os_liberada',
            autorId,
            payload: { codigoGrv, codigoProvisorio: os.codigoGrv, artigoId: artigo.id, quantidadeTotal, quantidadeLotes: divisaoLotes.length, divisaoLotes },
          });
          avisos.push(...(await gerarLotesEOps(tx, { osId: os.id, operacoes: artigo.operacoes, divisaoLotes, autorId })));
          await copiarMateriais(tx, { osId: os.id, artigoId: artigo.id, quantidadeTotal });
        });
      } catch (err: any) {
        if (err?.code === 'JA_LIBERADA') return reply.code(409).send({ error: 'nao_e_rascunho', message: 'Esta OS acabou de ser liberada por outra pessoa.' });
        if (err?.code === 'P2002') return reply.code(409).send({ error: 'duplicate_codigo_grv', message: `Já existe uma OS com o código GRV "${codigoGrv}"` });
        app.log.error({ err }, 'Erro ao liberar OS');
        return reply.code(500).send({ error: 'erro_interno', message: 'Erro ao liberar a OS. Tente novamente.' });
      }

      for (const a of avisos) app.io.to(`estacao:${a.etapaId}`).emit('op:nova-na-fila', a);
      const completa = await prisma.oS.findUnique({
        where: { id: os.id },
        include: { lotes: { orderBy: { numeroLote: 'asc' }, include: { opsLote: { orderBy: { ordem: 'asc' } } } }, materiais: { orderBy: { ordem: 'asc' } } },
      });
      return { data: completa };
    }
  );

  // ---------------- CANCELAR (soft) / EXCLUIR (force) ----------------
  app.delete(
    '/os/:id',
    { onRequest: [app.requireExcluir] },
    async (request, reply) => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      const querySchema = z.object({ force: z.string().optional() });
      const parsed = paramsSchema.safeParse(request.params);
      const parsedQuery = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'invalid_input', message: 'ID inválido' });
      }

      const os = await prisma.oS.findUnique({
        where: { id: parsed.data.id },
        include: {
          lotes: {
            include: {
              opsLote: { select: { id: true } },
            },
          },
        },
      });
      if (!os) {
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'OS não encontrada' });
      }

      const forceDelete =
        parsedQuery.success &&
        (parsedQuery.data.force === 'true' || parsedQuery.data.force === '1');

      if (forceDelete) {
        const opIds = os.lotes.flatMap((l) => l.opsLote.map((o) => o.id));
        const loteIds = os.lotes.map((l) => l.id);

        // Tudo o que aponta para a OS, os lotes e as OPs, dos filhos para os
        // pais, numa transação: ou apaga tudo, ou nada (antes, uma falha no
        // meio deixava a OS pela metade). Inclui inspeções de qualidade (as
        // medições vão junto, em cascata), controle de volume do lote e
        // carimbos/processamentos ligados só ao lote — sem eles o banco
        // recusava a exclusão (inspecoes_op_op_lote_id_fkey).
        const carimbos = await prisma.carimbo.findMany({
          where: { OR: [{ opLoteId: { in: opIds } }, { loteId: { in: loteIds } }] },
          select: { id: true },
        });
        const carimboIds = carimbos.map((c) => c.id);

        await prisma.$transaction([
          prisma.apontamentoPeca.deleteMany({ where: { opLoteId: { in: opIds } } }),
          prisma.paradaMaquina.deleteMany({ where: { carimboId: { in: carimboIds } } }),
          prisma.processamentoMaquina.deleteMany({
            where: { OR: [{ opLoteId: { in: opIds } }, { carimboId: { in: carimboIds } }] },
          }),
          prisma.inspecaoOP.deleteMany({ where: { opLoteId: { in: opIds } } }),
          prisma.carimbo.deleteMany({ where: { id: { in: carimboIds } } }),
          prisma.controleVolume.deleteMany({ where: { loteId: { in: loteIds } } }),
          prisma.alerta.deleteMany({
            where: {
              OR: [
                { entidadeTipo: 'OPLote', entidadeId: { in: opIds } },
                { entidadeTipo: 'OS', entidadeId: os.id },
              ],
            },
          }),
          prisma.eventoOS.deleteMany({ where: { OR: [{ osId: os.id }, { loteId: { in: loteIds } }] } }),
          prisma.oPLote.deleteMany({ where: { id: { in: opIds } } }),
          prisma.lote.deleteMany({ where: { id: { in: loteIds } } }),
          prisma.oS.delete({ where: { id: os.id } }),
        ]);

        return { data: { id: os.id, excluida: true } };
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

  // ---------------- HORAS PREVISTAS × REALIZADAS ----------------
  app.get('/os/:id/horas', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    const os = await prisma.oS.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        lotes: {
          select: {
            numeroLote: true,
            quantidadePecas: true,
            opsLote: {
              select: {
                id: true, ordem: true, codigoOp: true, tipoServico: true, status: true, tempoTotalPlanejado: true,
                terceirizada: true, esperaHoras: true,
                etapa: { select: { nome: true } },
                operacaoArtigo: { select: { tempoSetupMin: true } },
                carimbos: { select: { timestampEntrada: true, timestampSaida: true } },
              },
            },
          },
        },
      },
    });
    if (!os) return reply.code(404).send({ error: 'not_found', message: 'OS não encontrada' });
    const ops = os.lotes.flatMap((l) =>
      l.opsLote.map((op) => ({
        id: op.id, loteNumero: l.numeroLote, quantidade: l.quantidadePecas, ordem: op.ordem, codigoOp: op.codigoOp,
        tipoServico: op.tipoServico, etapa: op.etapa.nome, status: op.status, tempoTotalPlanejado: op.tempoTotalPlanejado,
        tempoSetupMin: op.operacaoArtigo.tempoSetupMin, terceirizada: op.terceirizada, esperaHoras: op.esperaHoras,
        carimbos: op.carimbos.map((c) => ({ entrada: c.timestampEntrada, saida: c.timestampSaida })),
      })),
    );
    return { data: compararPrevistoRealizado(ops) };
  });
}
