// ============================================================
// Forja - Integração com o Business OS
// ============================================================
// Endpoints (só a conta marcada com integracao = true):
//   POST /api/integracao/os-rascunho               — orçamento ganho vira OS em rascunho
//   POST /api/integracao/os-rascunho/:ref/cancelar — orçamento reaberto: cancela o rascunho
//   GET  /api/integracao/os-rascunho/:ref          — situação da OS e materiais (espelho)
//   PUT  /api/integracao/materiais                 — catálogo de materiais do Almoxarifado
//   GET  /api/integracao/desenhos                  — todos os desenhos com arquivo (Biblioteca da Fundição)
//   GET  /api/integracao/desenhos/:id/arquivo      — o arquivo do desenho (stream)
//
// O rascunho NÃO cria lote nem OP e não avisa estação: fica fora do Tótem e do
// Painel até o PCP completar o Artigo e liberar (POST /os/:id/liberar).
// Idempotente pela referência (item do orçamento): reenviar devolve o mesmo.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { buscaDoMaterial } from '../lib/materiais-busca.js';
import { listarDesenhosParaBiblioteca } from '../lib/desenhos-integracao.js';
import { obterArquivoStream } from '../lib/storage.js';
import { ORIGEM_TREINO, PREFIXO_PROVISORIO, PREFIXO_TREINO, criarEvento } from '../lib/os-producao.js';

const TIPOS = ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde', 'arruela', 'cabeca_sopro', 'forminha', 'puncao', 'funil'] as const;

const rascunhoSchema = z.object({
  /** Id do item do orçamento no Business OS. */
  refExterna: z.string().trim().min(1).max(100),
  /** Orçamento de treino: o rascunho serve para praticar e não pode ser liberado. */
  treino: z.boolean().default(false),
  /** Código provisório até o PCP informar o número da OS (ex.: ORC-212/1). */
  codigoProvisorio: z.string().trim().min(1).max(40),
  cliente: z.object({ forjaId: z.string().uuid().nullable().optional(), nome: z.string().trim().min(1).max(200) }),
  artigo: z.object({
    forjaId: z.string().uuid().nullable().optional(),
    codigo: z.string().trim().min(1).max(100),
    descricao: z.string().trim().min(1).max(500),
    tipoProduto: z.string().nullable().optional(),
    material: z.string().trim().max(200).nullable().optional(),
  }),
  quantidadeTotal: z.number().int().min(1),
  prazoEntrega: z.string().datetime({ offset: true }).nullable().optional(),
  prioridade: z.enum(['normal', 'urgente']).default('normal'),
  precoUnitario: z.number().nonnegative().nullable().optional(),
  valorTotal: z.number().nonnegative().nullable().optional(),
  poCliente: z.string().trim().max(100).nullable().optional(),
  pedidoClienteItem: z.string().trim().max(200).nullable().optional(),
  desenhoInformado: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

const materiaisSchema = z.object({
  itens: z.array(z.object({
    codigo: z.string().trim().min(1).max(30),
    descricao: z.string().trim().min(1).max(200),
    unidade: z.string().trim().min(1).max(8),
    familia: z.string().trim().max(40).nullable().optional(),
    grupo: z.string().trim().max(60).nullable().optional(),
    ativo: z.boolean().default(true),
  })).max(1000),
});

/** onRequest: login válido e pessoa ativa marcada como integração (lido do banco). */
async function exigirIntegracao(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
  }
  const p = await prisma.pessoa.findUnique({ where: { id: request.user?.pessoaId }, select: { ativo: true, integracao: true } });
  if (!p?.ativo || !p.integracao) return reply.code(403).send({ error: 'forbidden', message: 'Só a conta de integração usa esta rota.' });
}

const resumo = (os: { id: string; codigoGrv: string; status: string; artigoId: string; liberadaEm: Date | null }) => ({
  id: os.id, codigoGrv: os.codigoGrv, status: os.status, artigoId: os.artigoId, liberadaEm: os.liberadaEm,
});

export async function integracaoRoutes(app: FastifyInstance) {
  // ---------------- RASCUNHO DE OS ----------------
  app.post('/integracao/os-rascunho', { onRequest: [exigirIntegracao] }, async (request, reply) => {
    const parsed = rascunhoSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'Dados inválidos', details: parsed.error.flatten() });
    const d = parsed.data;
    const autorId = (request.user as any).pessoaId;

    const ja = await prisma.oS.findUnique({ where: { refExterna: d.refExterna } });
    if (ja) return { data: { ...resumo(ja), criado: false } };

    const prefixo = d.treino ? PREFIXO_TREINO : PREFIXO_PROVISORIO;
    const codigo = d.codigoProvisorio.toUpperCase().startsWith(prefixo) ? d.codigoProvisorio : `${prefixo}${d.codigoProvisorio}`;
    if (await prisma.oS.findUnique({ where: { codigoGrv: codigo } })) {
      return reply.code(409).send({ error: 'duplicate_codigo_grv', message: `Já existe uma OS com o código "${codigo}".` });
    }

    // Cliente: pelo id da Forja (o Business OS espelha os clientes) ou pelo nome.
    let cliente = d.cliente.forjaId ? await prisma.cliente.findUnique({ where: { id: d.cliente.forjaId } }) : null;
    if (!cliente) cliente = await prisma.cliente.findFirst({ where: { nome: { equals: d.cliente.nome, mode: 'insensitive' } } });
    if (cliente && !cliente.ativo) return reply.code(400).send({ error: 'cliente_invalido', message: `O cliente ${cliente.nome} está inativo na Forja.` });

    // Artigo: pelo id da Forja, ou pelo código + cliente; senão nasce em rascunho.
    let artigo = d.artigo.forjaId ? await prisma.artigo.findUnique({ where: { id: d.artigo.forjaId } }) : null;
    if (!artigo && cliente) artigo = await prisma.artigo.findUnique({ where: { codigo_clienteId: { codigo: d.artigo.codigo, clienteId: cliente.id } } });
    if (!artigo) {
      const tipo = TIPOS.find((t) => t === d.artigo.tipoProduto);
      if (!tipo) return reply.code(400).send({ error: 'tipo_produto_invalido', message: `O produto ${d.artigo.codigo} não existe na Forja e está sem tipo de peça válido: preencha o tipo no cadastro do produto.` });
    }

    const prazo = d.prazoEntrega ? new Date(d.prazoEntrega) : new Date(Date.now() + 30 * 86400000);
    const os = await prisma.$transaction(async (tx) => {
      const cli = cliente ?? (await tx.cliente.create({ data: { nome: d.cliente.nome } }));
      const art = artigo ?? (await tx.artigo.create({
        data: {
          codigo: d.artigo.codigo, descricao: d.artigo.descricao, tipoProduto: d.artigo.tipoProduto as (typeof TIPOS)[number],
          clienteId: cli.id, material: d.artigo.material || null, status: 'rascunho', criadoPorId: autorId,
          observacoes: 'Criado pelo orçamento ganho no Business OS: complete o roteiro, os desenhos e os materiais.',
        },
      }));
      const criada = await tx.oS.create({
        data: {
          codigoGrv: codigo, clienteId: cli.id, artigoId: art.id, quantidadeTotal: d.quantidadeTotal, prazoEntrega: prazo,
          prioridade: d.prioridade, status: 'rascunho', origem: d.treino ? ORIGEM_TREINO : 'business_os', refExterna: d.refExterna,
          observacoes: d.observacoes || null, precoUnitario: d.precoUnitario ?? null, valorTotal: d.valorTotal ?? null,
          poCliente: d.poCliente || null, pedidoClienteItem: d.pedidoClienteItem || null, desenhoInformado: d.desenhoInformado || null,
          criadoPorId: autorId,
        },
      });
      await criarEvento(tx, {
        osId: criada.id, tipo: 'os_criada', autorId, visivelDashboard: false,
        payload: { origem: 'business_os', rascunho: true, treino: d.treino, codigoGrv: codigo, artigoId: art.id, artigoNovo: !artigo, quantidadeTotal: d.quantidadeTotal },
      });
      return criada;
    });
    return reply.code(201).send({ data: { ...resumo(os), criado: true } });
  });

  app.post('/integracao/os-rascunho/:ref/cancelar', { onRequest: [exigirIntegracao] }, async (request, reply) => {
    const { ref } = z.object({ ref: z.string().min(1).max(100) }).parse(request.params);
    const os = await prisma.oS.findUnique({ where: { refExterna: ref } });
    if (!os) return { data: { cancelado: false, motivo: 'inexistente' } };
    if (os.status === 'cancelada') return { data: { ...resumo(os), cancelado: true } };
    if (os.status !== 'rascunho') {
      return reply.code(409).send({ error: 'os_liberada', message: `A OS ${os.codigoGrv} já foi liberada para produção: cancele na Forja primeiro.`, details: resumo(os) });
    }
    const autorId = (request.user as any).pessoaId;
    // Treino: o rascunho some de vez (não tem lote nem OP; materiais e eventos vão junto).
    if (os.origem === ORIGEM_TREINO) {
      const apagada = await prisma.oS.deleteMany({ where: { id: os.id, status: 'rascunho' } });
      if (apagada.count !== 1) return reply.code(409).send({ error: 'os_liberada', message: 'A OS mudou de situação: confira na Forja.' });
      return { data: { ...resumo(os), status: 'cancelada', cancelado: true, excluido: true } };
    }
    const cancelada = await prisma.$transaction(async (tx) => {
      const r = await tx.oS.updateMany({ where: { id: os.id, status: 'rascunho' }, data: { status: 'cancelada' } });
      if (r.count !== 1) return null;
      await criarEvento(tx, { osId: os.id, tipo: 'os_cancelada', autorId, visivelDashboard: false, payload: { origem: 'business_os', motivo: 'orçamento reaberto ou cancelado' } });
      return tx.oS.findUnique({ where: { id: os.id } });
    });
    if (!cancelada) return reply.code(409).send({ error: 'os_liberada', message: 'A OS acabou de ser liberada: cancele na Forja primeiro.' });
    return { data: { ...resumo(cancelada), cancelado: true } };
  });

  app.get('/integracao/os-rascunho/:ref', { onRequest: [exigirIntegracao] }, async (request, reply) => {
    const { ref } = z.object({ ref: z.string().min(1).max(100) }).parse(request.params);
    const os = await prisma.oS.findUnique({ where: { refExterna: ref }, include: { materiais: { orderBy: { ordem: 'asc' } } } });
    if (!os) return reply.code(404).send({ error: 'not_found', message: 'Sem OS para esta referência.' });
    return { data: { ...resumo(os), materiais: os.materiais } };
  });

  // ---------------- CATÁLOGO DE MATERIAIS ----------------
  app.put('/integracao/materiais', { onRequest: [exigirIntegracao] }, async (request, reply) => {
    const parsed = materiaisSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    const itens = parsed.data.itens;
    await prisma.$transaction(itens.map((m) => {
      const dados = {
        descricao: m.descricao, unidade: m.unidade.toUpperCase(), familia: m.familia || null, grupo: m.grupo || null,
        ativo: m.ativo, busca: buscaDoMaterial(m.codigo, m.descricao),
      };
      return prisma.materialCatalogo.upsert({ where: { codigo: m.codigo.toUpperCase() }, create: { codigo: m.codigo.toUpperCase(), ...dados }, update: dados });
    }));
    return { data: { recebidos: itens.length } };
  });

  // ---------------- DESENHOS (BIBLIOTECA DA FUNDIÇÃO) ----------------
  // A plataforma lê a lista inteira a cada sincronização e só baixa o arquivo
  // quando o desenho é novo ou a chave do arquivo mudou (a Forja apaga o antigo).
  app.get('/integracao/desenhos', { onRequest: [exigirIntegracao] }, async () => {
    return { data: await listarDesenhosParaBiblioteca() };
  });

  app.get('/integracao/desenhos/:id/arquivo', { onRequest: [exigirIntegracao] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const d = await prisma.desenho.findUnique({ where: { id }, select: { arquivoBucket: true, arquivoKey: true, arquivoTipo: true } });
    if (!d?.arquivoBucket || !d.arquivoKey) return reply.code(404).send({ error: 'arquivo_nao_anexado', message: 'Desenho sem arquivo.' });
    try {
      const s3 = await obterArquivoStream(d.arquivoBucket, d.arquivoKey);
      if (!s3.Body) return reply.code(404).send({ error: 'arquivo_nao_encontrado_storage', message: 'Arquivo não encontrado no armazenamento.' });
      reply.header('Content-Type', d.arquivoTipo || 'application/octet-stream').header('X-Arquivo-Key', d.arquivoKey);
      if (s3.ContentLength != null) reply.header('Content-Length', String(s3.ContentLength));
      return reply.send(s3.Body);
    } catch (err) {
      app.log.error({ err, key: d.arquivoKey }, 'Erro ao ler o desenho no MinIO (integração)');
      return reply.code(502).send({ error: 'storage_error', message: 'Erro ao buscar o arquivo no armazenamento.' });
    }
  });
}
