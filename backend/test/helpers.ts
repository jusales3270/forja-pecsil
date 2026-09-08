// ============================================================
// Forja - Helper de testes
// Build do app Fastify isolado pra cada teste + utilitários de dados
// ============================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import bcrypt from 'bcryptjs';
import { registerAuth } from '../src/lib/auth.js';
import { decorateSocketPlaceholder } from '../src/lib/socket.js';
import { authRoutes } from '../src/routes/auth.js';
import { tiposServicoRoutes } from '../src/routes/tipos-servico.js';
import { toleranciasGeraisRoutes } from '../src/routes/tolerancias-gerais.js';
import { artigosRoutes } from '../src/routes/artigos.js';
import { desenhosRoutes } from '../src/routes/desenhos.js';
import { operacoesArtigoRoutes } from '../src/routes/operacoes-artigo.js';
import { planosInspecaoRoutes } from '../src/routes/planos-inspecao.js';
import { cotasInspecaoRoutes } from '../src/routes/cotas-inspecao.js';
import { etapasRoutes } from '../src/routes/etapas.js';
import { clientesRoutes } from '../src/routes/clientes.js';
import { osRoutes } from '../src/routes/os.js';
import { opLoteRoutes } from '../src/routes/op-lote.js';
import { roteirosPadraoRoutes } from '../src/routes/roteiros-padrao.js';
import { prisma } from '../src/db/prisma.js';
import type { TipoProduto, PapelPessoa, TipoMaquina } from '@prisma/client';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Decora `io` como stub pra rotas que usam app.io.emit não quebrarem em teste
  decorateSocketPlaceholder(app);
  // Substitui o placeholder por um stub que aceita .to().emit() sem fazer nada
  (app as any).io = {
    to: () => ({ emit: () => {} }),
    emit: () => {},
  };

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await registerAuth(app);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'test',
  }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(tiposServicoRoutes, { prefix: '/api' });
  await app.register(toleranciasGeraisRoutes, { prefix: '/api' });
  await app.register(artigosRoutes, { prefix: '/api' });
  await app.register(desenhosRoutes, { prefix: '/api' });
  await app.register(operacoesArtigoRoutes, { prefix: '/api' });
  await app.register(roteirosPadraoRoutes, { prefix: '/api' });
  await app.register(planosInspecaoRoutes, { prefix: '/api' });
  await app.register(cotasInspecaoRoutes, { prefix: '/api' });
  await app.register(etapasRoutes, { prefix: '/api' });
  await app.register(clientesRoutes, { prefix: '/api' });
  await app.register(osRoutes, { prefix: '/api' });
  await app.register(opLoteRoutes, { prefix: '/api' });

  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
  await prisma.$disconnect();
}

// ============================================================
// Utilitários de dados de teste (idempotentes)
// ============================================================

export async function ensurePessoa(params: {
  codigoPessoal: string;
  pin: string;
  nome?: string;
  papel?: PapelPessoa;
}): Promise<{ id: string }> {
  const pinHash = await bcrypt.hash(params.pin, 10);
  const p = await prisma.pessoa.upsert({
    where: { codigoPessoal: params.codigoPessoal },
    create: {
      nome: params.nome ?? `Teste ${params.codigoPessoal}`,
      codigoPessoal: params.codigoPessoal,
      pinHash,
      papel: params.papel ?? 'admin',
      ativo: true,
    },
    update: { pinHash, ativo: true, papel: params.papel ?? 'admin' },
  });
  return { id: p.id };
}

export async function ensureCliente(nome: string): Promise<{ id: string }> {
  const existente = await prisma.cliente.findFirst({ where: { nome } });
  if (existente) return { id: existente.id };
  const novo = await prisma.cliente.create({ data: { nome, ativo: true } });
  return { id: novo.id };
}

export async function ensureArtigo(params: {
  codigo: string;
  clienteId: string;
  criadoPorId: string;
  descricao?: string;
  tipoProduto?: TipoProduto;
}): Promise<{ id: string }> {
  const existente = await prisma.artigo.findUnique({
    where: {
      codigo_clienteId: {
        codigo: params.codigo,
        clienteId: params.clienteId,
      },
    },
  });
  if (existente) return { id: existente.id };
  const novo = await prisma.artigo.create({
    data: {
      codigo: params.codigo,
      descricao: params.descricao ?? `Artigo de teste ${params.codigo}`,
      tipoProduto: params.tipoProduto ?? 'forma',
      clienteId: params.clienteId,
      status: 'rascunho',
      criadoPorId: params.criadoPorId,
    },
  });
  return { id: novo.id };
}

export async function ensureMaquina(params: {
  codigoInterno: string;
  etapaId: string;
  nome?: string;
  tipo?: TipoMaquina;
}): Promise<{ id: string }> {
  const m = await prisma.maquina.upsert({
    where: { codigoInterno: params.codigoInterno },
    create: {
      nome: params.nome ?? `Máquina ${params.codigoInterno}`,
      codigoInterno: params.codigoInterno,
      tipo: params.tipo ?? 'torno',
      etapaId: params.etapaId,
      ativa: true,
    },
    update: { ativa: true, etapaId: params.etapaId },
  });
  return { id: m.id };
}

/**
 * Cria Artigo com 2 operações (ambas na etapa fornecida) e ativa,
 * pronto pra ser usado numa OS.
 */
export async function ensureArtigoAtivoComOperacoes(params: {
  codigo: string;
  clienteId: string;
  criadoPorId: string;
  etapaId: string;
  exigeInspecao?: boolean;
}): Promise<{ id: string }> {
  const artigo = await ensureArtigo({
    codigo: params.codigo,
    clienteId: params.clienteId,
    criadoPorId: params.criadoPorId,
  });

  // Garante 2 operações (idempotente — só cria se não tiver)
  const ops = await prisma.operacaoArtigo.findMany({
    where: { artigoId: artigo.id },
    orderBy: { ordem: 'asc' },
  });
  if (ops.length === 0) {
    await prisma.operacaoArtigo.createMany({
      data: [
        {
          artigoId: artigo.id,
          etapaId: params.etapaId,
          codigoOp: '10',
          ordem: 0,
          tipoServico: 'Operação teste 1',
          tempoUnitMin: 10,
          exigeInspecao: params.exigeInspecao ?? false,
        },
        {
          artigoId: artigo.id,
          etapaId: params.etapaId,
          codigoOp: '20',
          ordem: 1,
          tipoServico: 'Operação teste 2',
          tempoUnitMin: 5,
          exigeInspecao: false,
        },
      ],
    });
  }

  // Garante status=ativo
  await prisma.artigo.update({
    where: { id: artigo.id },
    data: { status: 'ativo' },
  });

  return artigo;
}

export async function loginAs(
  app: FastifyInstance,
  codigoPessoal: string,
  pin: string
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { codigo_pessoal: codigoPessoal, pin },
  });
  return res.json().data.token;
}

// Alias mantido pra compatibilidade com testes antigos
export const loginAsAdmin = loginAs;
