// ============================================================
// Forja - Rotas de Roteiro Padrão
// ============================================================
//   GET /api/roteiros-padrao — lista os modelos disponíveis,
//   já resolvidos contra o catálogo de Tipos de Serviço.
//   GET /api/roteiros-padrao/sem-roteiro — por tipo de peça, quantos
//   artigos ativos ainda estão sem roteiro.
//   POST /api/roteiros-padrao/:id/aplicar-em-massa — aplica o modelo em
//   todos os artigos sem roteiro de um tipo (e, se quiser, de um cliente).
//   Nunca substitui roteiro existente: a exceção o PCP ajusta no artigo.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TipoProduto } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ROTEIROS_PADRAO, PASSO_SEQUENCIA, buscarRoteiroPadrao } from '../data/roteiros-padrao.js';
import { filtroSemRoteiro, operacoesDoRoteiro, resolverTipos } from '../lib/aplicar-roteiro.js';
import { exigirModulo } from '../lib/acessos.js';

const emMassaSchema = z.object({
  tipoProduto: z.nativeEnum(TipoProduto),
  clienteId: z.string().uuid().optional().nullable(),
  /** true = só conta e mostra uma amostra, sem gravar */
  simular: z.boolean().default(false),
});

/** Artigos gravados por transação: um tipo inteiro (~760) não vira uma transação gigante. */
const POR_VEZ = 100;

export async function roteirosPadraoRoutes(app: FastifyInstance) {
  app.get(
    '/roteiros-padrao',
    { onRequest: [app.authenticate] },
    async () => {
      // Resolve os códigos contra o catálogo real, pra devolver o nome do
      // serviço e sinalizar se algum código não está cadastrado.
      const codigos = [
        ...new Set(
          ROTEIROS_PADRAO.flatMap((r) =>
            r.operacoes.flatMap((o) =>
              [o.codigoTipoServico, o.avisaEtapaDoCodigoTipoServico].filter(
                (c): c is number => c != null,
              ),
            ),
          ),
        ),
      ];

      const tipos = await prisma.tipoServico.findMany({
        where: { codigo: { in: codigos }, ativo: true },
        include: { etapa: { select: { id: true, nome: true } } },
      });
      const porCodigo = new Map(tipos.map((t) => [t.codigo!, t]));

      const data = ROTEIROS_PADRAO.map((roteiro) => {
        const operacoes = roteiro.operacoes.map((op, idx) => {
          const tipo = porCodigo.get(op.codigoTipoServico);
          return {
            codigoOp: String((idx + 1) * PASSO_SEQUENCIA),
            ordem: idx,
            codigoTipoServico: op.codigoTipoServico,
            tipoServico: tipo?.nome ?? null,
            etapa: tipo?.etapa.nome ?? null,
            observacoes: op.observacoes,
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
            avisaEtapa:
              op.avisaEtapaDoCodigoTipoServico != null
                ? (porCodigo.get(op.avisaEtapaDoCodigoTipoServico)?.etapa.nome ?? null)
                : null,
            /** true = o código não existe no catálogo de Tipos de Serviço */
            naoEncontrado: !tipo,
          };
        });

        return {
          id: roteiro.id,
          nome: roteiro.nome,
          descricao: roteiro.descricao,
          origem: roteiro.origem,
          revisaoPendente: roteiro.revisaoPendente,
          totalOperacoes: operacoes.length,
          tempoTotalUnitMin: operacoes.reduce(
            (acc, o) => acc + o.tempoUnitMin + o.tempoSetupMin,
            0,
          ),
          /** true = algum código do roteiro não existe no catálogo */
          temPendencia: operacoes.some((o) => o.naoEncontrado),
          operacoes,
        };
      });

      return { data };
    },
  );

  app.get('/roteiros-padrao/sem-roteiro', { onRequest: [exigirModulo('artigos')] }, async () => {
    const [todos, sem] = await Promise.all([
      prisma.artigo.groupBy({ by: ['tipoProduto'], where: { ativo: true, status: { not: 'arquivado' } }, _count: { _all: true } }),
      prisma.artigo.groupBy({ by: ['tipoProduto'], where: { ativo: true, status: { not: 'arquivado' }, operacoes: { none: {} } }, _count: { _all: true } }),
    ]);
    const semPor = new Map(sem.map((g) => [g.tipoProduto, g._count._all]));
    const data = todos
      .map((g) => ({ tipoProduto: g.tipoProduto, total: g._count._all, semRoteiro: semPor.get(g.tipoProduto) ?? 0 }))
      .sort((a, b) => b.semRoteiro - a.semRoteiro);
    return { data };
  });

  app.post('/roteiros-padrao/:id/aplicar-em-massa', { onRequest: [exigirModulo('artigos')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const roteiro = buscarRoteiroPadrao(id);
    if (!roteiro) return reply.code(404).send({ error: 'roteiro_nao_encontrado', message: 'Roteiro padrão não encontrado' });
    const parsed = emMassaSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation_error', message: 'Dados inválidos', issues: parsed.error.issues });
    const { porCodigo, faltando } = await resolverTipos(roteiro);
    if (faltando.length > 0) {
      return reply.code(409).send({
        error: 'tipos_servico_faltando',
        message: `Este roteiro usa Tipos de Serviço que não estão no catálogo (códigos: ${faltando.join(', ')}). Cadastre-os antes de aplicar.`,
        codigosFaltando: faltando,
      });
    }
    const where = filtroSemRoteiro(parsed.data);
    const alvos = await prisma.artigo.findMany({ where, select: { id: true, codigo: true, descricao: true }, orderBy: { codigo: 'asc' } });
    if (parsed.data.simular || alvos.length === 0) {
      return { data: { roteiro: roteiro.nome, simulado: true, total: alvos.length, amostra: alvos.slice(0, 8).map((a) => ({ codigo: a.codigo, descricao: a.descricao })) } };
    }
    let aplicados = 0;
    for (let i = 0; i < alvos.length; i += POR_VEZ) {
      const ids = alvos.slice(i, i + POR_VEZ).map((a) => a.id);
      aplicados += await prisma.$transaction(async (tx) => {
        // Confere de novo dentro da transação: alguém pode ter cadastrado o roteiro de um deles nesse meio-tempo.
        const livres = await tx.artigo.findMany({ where: { id: { in: ids }, operacoes: { none: {} } }, select: { id: true } });
        if (!livres.length) return 0;
        await tx.operacaoArtigo.createMany({ data: livres.flatMap((a) => operacoesDoRoteiro(a.id, roteiro, porCodigo)) });
        return livres.length;
      });
    }
    request.log.info({ roteiro: roteiro.id, tipoProduto: parsed.data.tipoProduto, clienteId: parsed.data.clienteId ?? null, aplicados, pessoaId: request.user?.pessoaId }, 'Roteiro padrão aplicado em massa');
    return reply.code(201).send({ data: { roteiro: roteiro.nome, simulado: false, total: alvos.length, aplicados, operacoesPorArtigo: roteiro.operacoes.length } });
  });
}
