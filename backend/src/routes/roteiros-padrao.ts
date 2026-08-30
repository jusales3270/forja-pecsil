// ============================================================
// Forja - Rotas de Roteiro Padrão
// ============================================================
//   GET /api/roteiros-padrao — lista os modelos disponíveis,
//   já resolvidos contra o catálogo de Tipos de Serviço.
// ============================================================

import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';
import { ROTEIROS_PADRAO, PASSO_SEQUENCIA } from '../data/roteiros-padrao.js';

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
}
