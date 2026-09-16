import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { isPcp } from '@forja/shared';
import { prisma } from '../db/prisma.js';

const fail = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};
const contaSelect = { id: true, nome: true, ativo: true, papel: true, etapaId: true,
  etapa: { select: { id: true, nome: true, ativa: true } } } as const;
// Estação PCP: administrativa, reconhecida pelo nome (como a Metalização).
// Quem tem papel pcp responde por ela sem precisar de vínculo no cadastro.
async function estacoesPcpAtivas(): Promise<string[]> {
  const etapas = await prisma.etapa.findMany({ where: { ativa: true }, select: { id: true, nome: true } });
  return etapas.filter(e => isPcp(e.nome)).map(e => e.id);
}
async function contaAtual(id: string) {
  const conta = await prisma.pessoa.findUnique({ where: { id }, select: contaSelect });
  if (!conta?.ativo) return fail(401, 'Conta indisponível. Entre novamente.');
  const pcpEtapaIds = conta.papel === 'pcp' ? await estacoesPcpAtivas() : [];
  return { ...conta, pcpEtapaIds };
}
type Conta = Awaited<ReturnType<typeof contaAtual>>;
// Administrador e PCP falam com qualquer estação sem vínculo no cadastro.
const PAPEIS_TODAS_ESTACOES = ['admin', 'pcp'] as const;
const atuaEmTodas = (papel: string) => (PAPEIS_TODAS_ESTACOES as readonly string[]).includes(papel);
const podeEnviar = (p: Conta) => atuaEmTodas(p.papel) || !!p.etapa?.ativa;
const recebidas = (p: Conta): Prisma.MensagemInternaWhereInput => ({
  destinatarioId: p.id,
  // Administrador e PCP atuam em todas as estações, mas só recebem recados próprios.
  ...(atuaEmTodas(p.papel) ? { etapaDestino: { ativa: true } }
    : { etapaDestinoId: p.etapa?.ativa ? p.etapa.id : { in: [] } }),
});
const destinatarioNaEstacao = (id: string, etapaId: string, estacaoPcp: boolean): Prisma.PessoaWhereInput => ({
  id, ativo: true,
  // Na estação PCP, só o papel pcp responde (além do administrador).
  OR: estacaoPcp
    ? [{ papel: 'admin' }, { papel: 'pcp' }]
    : [{ papel: { in: [...PAPEIS_TODAS_ESTACOES] } }, { etapaId, etapa: { ativa: true } }],
});
async function ehEstacaoPcp(etapaId: string) {
  const etapa = await prisma.etapa.findUnique({ where: { id: etapaId }, select: { nome: true, ativa: true } });
  return !!etapa?.ativa && isPcp(etapa.nome);
}
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
      select: { id: true, nome: true },
    });
    const pessoas = await prisma.pessoa.findMany({
      where: { ativo: true, id: { not: conta.id },
        OR: [{ papel: 'admin' }, { papel: 'pcp' }, { etapa: { ativa: true } }] },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: { id: true, nome: true, codigoPessoal: true, papel: true, etapaId: true, etapa: { select: { ativa: true } } },
    });
    // PCP primeiro: é para onde o chão de fábrica mais escreve.
    const ordenadas = [...estacoes.filter(e => isPcp(e.nome)), ...estacoes.filter(e => !isPcp(e.nome))];
    return { data: { conta: { id: conta.id, nome: conta.nome, etapa: conta.etapa },
      podeEnviar: podeEnviar(conta), estacoes: ordenadas.map(e => ({ ...e,
        pessoas: pessoas.filter(p => atuaEmTodas(p.papel) || (!isPcp(e.nome) && p.etapaId === e.id && p.etapa?.ativa))
          .map(({ id, nome, codigoPessoal }) => ({ id, nome, codigoPessoal })),
      })) } };
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
    if (!podeEnviar(p)) return fail(403, 'Vincule sua conta a uma estação ativa para enviar mensagens.');
    const destino = await prisma.etapa.findFirst({ where: { id: input.etapaDestinoId, ativa: true } });
    if (!destino) return fail(400, 'Selecione uma estação ativa.');
    const destinatario = await prisma.pessoa.findFirst({
      where: destinatarioNaEstacao(input.destinatarioId, input.etapaDestinoId, isPcp(destino.nome)),
      select: { id: true, nome: true },
    });
    if (!destinatario || destinatario.id === p.id) return fail(400, 'Selecione outro usuário ativo da estação de destino.');
    // Sem estação fixa, o PCP escreve como PCP e o administrador atua no
    // contexto da estação escolhida.
    const etapaOrigemId = p.etapa?.ativa ? p.etapa.id : p.pcpEtapaIds[0] ?? destino.id;
    try {
      return await prisma.mensagemInterna.create({ data: {
        ...input, remetenteId: p.id, remetenteNome: p.nome, destinatarioNome: destinatario.nome,
        etapaOrigemId, respostaAId,
      }, include });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      const existing = await prisma.mensagemInterna.findFirst({ where: {
        ...input, remetenteId: p.id, etapaOrigemId, respostaAId,
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
    const autor = await prisma.pessoa.findFirst({
      where: destinatarioNaEstacao(original.remetenteId, original.etapaOrigemId, await ehEstacaoPcp(original.etapaOrigemId)),
    });
    if (!autor) return fail(409, 'O remetente mudou de estação ou está inativo. Crie uma nova mensagem escolhendo o destino atual.');
    const data = await enviar(p, { ...body.data, destinatarioId: autor.id, etapaDestinoId: original.etapaOrigemId }, original.id);
    return reply.code(201).send({ data });
  });
}
