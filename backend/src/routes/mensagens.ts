import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const fail = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};
const contaSelect = { id: true, nome: true, ativo: true, etapaId: true,
  etapa: { select: { id: true, nome: true, ativa: true } } } as const;
async function contaAtual(id: string) {
  const conta = await prisma.pessoa.findUnique({ where: { id }, select: contaSelect });
  if (!conta?.ativo) return fail(401, 'Conta indisponível. Entre novamente.');
  return conta;
}
type Conta = Awaited<ReturnType<typeof contaAtual>>;
const recebidas = (p: Conta): Prisma.MensagemInternaWhereInput => ({
  destinatarioId: p.id,
  // Uma conta sem estação nunca ganha acesso por omissão do filtro.
  etapaDestinoId: p.etapa?.ativa ? p.etapa.id : { in: [] },
});
const include = {
  etapaOrigem: { select: { id: true, nome: true } },
  etapaDestino: { select: { id: true, nome: true } },
} as const;
const texto = z.object({ id: z.string().uuid(), corpo: z.string().trim().min(1).max(4000) }).strict();
const nova = texto.extend({ etapaDestinoId: z.string().uuid(), destinatarioId: z.string().uuid() }).strict();
const parametro = z.object({ id: z.string().uuid() });

export async function mensagensRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  app.get('/mensagens/contatos', auth, async (req) => {
    const conta = await contaAtual(req.user.pessoaId);
    const estacoes = await prisma.etapa.findMany({
      where: { ativa: true }, orderBy: { ordemPadrao: 'asc' },
      select: { id: true, nome: true, pessoas: {
        where: { ativo: true, id: { not: conta.id } }, orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        select: { id: true, nome: true, codigoPessoal: true },
      } },
    });
    return { data: { conta: { id: conta.id, nome: conta.nome, etapa: conta.etapa },
      podeEnviar: !!conta.etapa?.ativa, estacoes } };
  });

  app.get('/mensagens', auth, async (req, reply) => {
    const parsed = z.object({ caixa: z.enum(['recebidas', 'enviadas']).default('recebidas'),
      pagina: z.coerce.number().int().min(1).max(10000).default(1) }).strict().safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Caixa ou página inválida.' });
    const p = await contaAtual(req.user.pessoaId);
    const { caixa, pagina } = parsed.data;
    const where = caixa === 'enviadas' ? { remetenteId: p.id } : recebidas(p);
    const [data, total, naoLidas] = await prisma.$transaction([
      prisma.mensagemInterna.findMany({ where, include, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 30, skip: (pagina - 1) * 30 }),
      prisma.mensagemInterna.count({ where }),
      prisma.mensagemInterna.count({ where: { ...recebidas(p), lidoEm: null } }),
    ]);
    return { data, meta: { total, naoLidas, pagina, paginas: Math.max(1, Math.ceil(total / 30)) } };
  });

  app.get('/mensagens/:id', auth, async (req, reply) => {
    const parsed = parametro.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ message: 'ID inválido.' });
    const p = await contaAtual(req.user.pessoaId);
    const data = await prisma.mensagemInterna.findFirst({
      where: { id: parsed.data.id, OR: [{ remetenteId: p.id }, recebidas(p)] }, include,
    });
    if (!data) return fail(404, 'Mensagem não encontrada.');
    return { data };
  });

  // ID gerado no formulário permite repetir uma tentativa sem duplicar o recado.
  async function enviar(p: Conta, input: z.infer<typeof nova>, respostaAId: string | null = null) {
    if (!p.etapa?.ativa) return fail(403, 'Vincule sua conta a uma estação ativa para enviar mensagens.');
    const destinatario = await prisma.pessoa.findFirst({
      where: { id: input.destinatarioId, ativo: true, etapaId: input.etapaDestinoId, etapa: { ativa: true } },
      select: { id: true, nome: true },
    });
    if (!destinatario || destinatario.id === p.id) return fail(400, 'Selecione outro usuário ativo da estação de destino.');
    try {
      return await prisma.mensagemInterna.create({ data: {
        ...input, remetenteId: p.id, remetenteNome: p.nome, destinatarioNome: destinatario.nome,
        etapaOrigemId: p.etapa.id, respostaAId,
      }, include });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      const existing = await prisma.mensagemInterna.findFirst({ where: {
        ...input, remetenteId: p.id, etapaOrigemId: p.etapa.id, respostaAId,
      }, include });
      if (!existing) return fail(409, 'Identificador já utilizado. Abra uma nova mensagem.');
      return existing;
    }
  }

  app.post('/mensagens', auth, async (req, reply) => {
    const parsed = nova.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Selecione estação, responsável e escreva de 1 a 4.000 caracteres.' });
    const data = await enviar(await contaAtual(req.user.pessoaId), parsed.data);
    return reply.code(201).send({ data });
  });

  app.patch('/mensagens/:id/lida', auth, async (req, reply) => {
    const parsed = parametro.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ message: 'ID inválido.' });
    const p = await contaAtual(req.user.pessoaId);
    const where = { ...recebidas(p), id: parsed.data.id };
    await prisma.mensagemInterna.updateMany({ where: { ...where, lidoEm: null }, data: { lidoEm: new Date() } });
    const data = await prisma.mensagemInterna.findFirst({ where, include });
    if (!data) return fail(404, 'Mensagem não encontrada.');
    return { data };
  });

  app.post('/mensagens/:id/responder', auth, async (req, reply) => {
    const params = parametro.safeParse(req.params);
    const body = texto.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: 'Resposta inválida. Use de 1 a 4.000 caracteres.' });
    const p = await contaAtual(req.user.pessoaId);
    const original = await prisma.mensagemInterna.findFirst({ where: { ...recebidas(p), id: params.data.id } });
    if (!original) return fail(404, 'Mensagem não encontrada.');
    const autor = await prisma.pessoa.findFirst({ where: {
      id: original.remetenteId, ativo: true, etapaId: original.etapaOrigemId, etapa: { ativa: true },
    } });
    if (!autor) return fail(409, 'O remetente mudou de estação ou está inativo. Crie uma nova mensagem escolhendo o destino atual.');
    const data = await enviar(p, { ...body.data, destinatarioId: autor.id, etapaDestinoId: original.etapaOrigemId }, original.id);
    return reply.code(201).send({ data });
  });
}
