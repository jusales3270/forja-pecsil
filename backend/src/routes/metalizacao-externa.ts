import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isMetalizacao } from '@forja/shared';
import { prisma } from '../db/prisma.js';
import { podeOperarEtapa, type UsuarioToken } from '../lib/permissoes-estacao.js';
import { avisarProximaSeLoteCompleto } from '../lib/aviso-chegada.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const envioSchema = z.object({
  fornecedor: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
const recebimentoSchema = z.object({ confirmarRecebimento: z.literal(true) }).strict();
const falhar = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};

export async function metalizacaoExternaRoutes(app: FastifyInstance) {
  app.get('/op-lote/envios-externos', { onRequest: [app.authenticate] }, async (request) => {
    const { etapaId } = z.object({ etapaId: z.string().uuid() }).parse(request.query);
    const data = await prisma.oPLote.findMany({
      where: { etapaId, envioExternoEm: { not: null }, recebimentoExternoEm: null },
      include: {
        etapa: { select: { id: true, nome: true } },
        lote: { include: { os: { include: { artigo: true, cliente: true } } } },
      },
      orderBy: { envioExternoEm: 'asc' },
    });
    return { data };
  });

  for (const acao of ['enviar-externo', 'receber-externo'] as const) {
    app.post(`/op-lote/:id/${acao}`, { onRequest: [app.authenticate] }, async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const envio = acao === 'enviar-externo';
      const body = (envio ? envioSchema : recebimentoSchema).safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: 'invalid_input', message: 'Confirme os dados da operação.' });
      }
      const user = request.user as UsuarioToken;
      try {
        const op = await prisma.$transaction(async (tx) => {
          // Serializa envio, recebimento e início interno sobre a mesma OP.
          await tx.$queryRaw`SELECT id FROM ops_lote WHERE id = ${params.data.id} FOR UPDATE`;
          const atual = await tx.oPLote.findUnique({
            where: { id: params.data.id },
            include: { etapa: true, lote: { include: { os: true } } },
          });
          if (!atual) return falhar(404, 'OP não encontrada.');
          if (!podeOperarEtapa(user, atual.etapaId)) return falhar(403, 'Entre com a conta da Metalização para registrar envio ou recebimento.');
          if (!isMetalizacao(atual.etapa.nome)) return falhar(400, 'Envio externo disponível somente na Metalização.');
          if (!['aberta', 'em_producao'].includes(atual.lote.os.status)) return falhar(409, 'A OS não está ativa.');
          const agora = new Date();
          let quantidade: number;
          if (envio) {
            if (atual.status !== 'na_fila' || atual.envioExternoEm || atual.quantidadeConcluida !== 0) {
              return falhar(409, 'Escolha o envio externo antes de iniciar a metalização deste lote.');
            }
            // Envio por lote inteiro: não presume que peças ainda na etapa anterior saíram da fábrica.
            const anteriores = await tx.oPLote.findMany({
              where: { loteId: atual.loteId },
              orderBy: [{ ordem: 'asc' }, { codigoOp: 'asc' }, { id: 'asc' }],
            });
            const anterioresAoEnvio = anteriores.slice(0, anteriores.findIndex(o => o.id === atual.id));
            if (anterioresAoEnvio.some(o => o.quantidadeConcluida < atual.lote.quantidadePecas || (o.exigeLoteCompleto && o.status !== 'concluida'))) {
              return falhar(409, 'Aguarde todas as peças do lote chegarem à Metalização para registrar o envio externo.');
            }
            if (await tx.apontamentoPeca.count({ where: { opLoteId: atual.id } })) return falhar(409, 'Este lote já possui contagem interna de peças.');
            quantidade = atual.lote.quantidadePecas;
            const dados = envioSchema.parse(body.data);
            await tx.oPLote.update({
              where: { id: atual.id },
              data: { status: 'bloqueada', envioExternoEm: agora, quantidadeEnvioExterno: quantidade, fornecedor: dados.fornecedor || atual.fornecedor },
            });
            await tx.carimbo.create({ data: {
              opLoteId: atual.id, loteId: atual.loteId, etapaId: atual.etapaId,
              programadorId: user.pessoaId, timestampEntrada: agora, observacoes: dados.observacoes || null,
            } });
            await tx.lote.update({ where: { id: atual.loteId }, data: { status: 'em_processo' } });
            await tx.oS.update({ where: { id: atual.lote.osId }, data: { status: 'em_producao' } });
          } else {
            if (atual.status !== 'bloqueada' || !atual.envioExternoEm || atual.recebimentoExternoEm || !atual.quantidadeEnvioExterno) {
              return falhar(409, 'Não há envio externo aguardando recebimento nesta OP.');
            }
            quantidade = atual.quantidadeEnvioExterno;
            await tx.oPLote.update({ where: { id: atual.id }, data: {
              recebimentoExternoEm: agora, quantidadeConcluida: quantidade,
              status: atual.exigeInspecao ? 'aguardando_qualidade' : 'concluida',
            } });
            await tx.carimbo.updateMany({ where: { opLoteId: atual.id, timestampSaida: null }, data: { timestampSaida: agora, quantidadeConcluida: quantidade } });
            // Lote voltou inteiro do fornecedor: avisa a estação da próxima operação
            await avisarProximaSeLoteCompleto(tx, atual.id);
            const restantes = await tx.oPLote.count({ where: { loteId: atual.loteId, status: { not: 'concluida' } } });
            if (restantes === 0) {
              await tx.lote.update({ where: { id: atual.loteId }, data: { status: 'concluido' } });
              if (await tx.lote.count({ where: { osId: atual.lote.osId, status: { not: 'concluido' } } }) === 0) {
                await tx.oS.update({ where: { id: atual.lote.osId }, data: { status: 'finalizada' } });
                await tx.eventoOS.create({ data: { osId: atual.lote.osId, tipo: 'os_finalizada', autorId: user.pessoaId, payload: { acao: 'finalizada_automaticamente' } } });
              }
            }
          }
          await tx.eventoOS.create({ data: {
            osId: atual.lote.osId, loteId: atual.loteId, autorId: user.pessoaId,
            tipo: envio ? 'op_lote_iniciada' : 'op_lote_concluida',
            payload: {
              acao: envio ? 'metalizacao_envio_externo' : 'metalizacao_recebimento_externo',
              opLoteId: atual.id, codigoOp: atual.codigoOp, tipoServico: atual.tipoServico,
              quantidadeConcluida: envio ? 0 : quantidade, quantidadeEnviada: quantidade, quantidadeTotal: atual.lote.quantidadePecas, exigeInspecao: atual.exigeInspecao,
              fornecedor: envio ? envioSchema.parse(body.data).fornecedor || atual.fornecedor : atual.fornecedor,
              observacoes: envio ? envioSchema.parse(body.data).observacoes : undefined,
            },
          } });
          return tx.oPLote.findUniqueOrThrow({ where: { id: atual.id } });
        });
        app.io.to(`estacao:${op.etapaId}`).emit(envio ? 'op:iniciada' : 'op:encerrada', { opLoteId: op.id, etapaId: op.etapaId, loteId: op.loteId });
        if (!envio) {
          const proximas = await prisma.oPLote.findMany({ where: { loteId: op.loteId, ordem: { gt: op.ordem } }, select: { etapaId: true } });
          for (const etapaId of new Set(proximas.map(o => o.etapaId))) app.io.to(`estacao:${etapaId}`).emit('op:nova-na-fila', { loteId: op.loteId, etapaId });
        }
        return { data: op };
      } catch (err: any) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: 'envio_externo_invalido', message: err.message });
        throw err;
      }
    });
  }
}
