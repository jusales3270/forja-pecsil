// ============================================================
// Forja - Testes da rota /os (débito #8 do Sprint 2)
// Cobre: criar, listar, detalhar, atualizar, cancelar, timeline
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  closeTestApp,
  ensurePessoa,
  ensureCliente,
  ensureArtigoAtivoComOperacoes,
  loginAs,
} from './helpers.js';
import { prisma } from '../src/db/prisma.js';

let app: FastifyInstance;
let tokenPcp: string;
let tokenAdmin: string;
let pcpId: string;
let clienteId: string;
let clienteInativoId: string;
let etapaId: string;
let artigoId: string;
let artigoRascunhoId: string;

const osCriadasIds: string[] = [];

before(async () => {
  app = await buildTestApp();

  const pcp = await ensurePessoa({
    codigoPessoal: 'TEST-PCP-OS',
    pin: '1234',
    nome: 'PCP Teste OS',
    papel: 'pcp',
  });
  pcpId = pcp.id;
  tokenPcp = await loginAs(app, 'TEST-PCP-OS', '1234');

  await ensurePessoa({
    codigoPessoal: 'TEST-ADMIN-OS',
    pin: '1234',
    nome: 'Admin Teste OS',
    papel: 'admin',
  });
  tokenAdmin = await loginAs(app, 'TEST-ADMIN-OS', '1234');

  const cliente = await ensureCliente('Cliente Teste OS');
  clienteId = cliente.id;

  // Cliente inativo
  const ci = await prisma.cliente.upsert({
    where: { id: '00000000-0000-0000-0000-000000000099' }, // não existe; falha → cria pelo nome
    create: { nome: 'Cliente Inativo Teste', ativo: false },
    update: { ativo: false },
  }).catch(async () => {
    const existente = await prisma.cliente.findFirst({
      where: { nome: 'Cliente Inativo Teste' },
    });
    if (existente) {
      return prisma.cliente.update({
        where: { id: existente.id },
        data: { ativo: false },
      });
    }
    return prisma.cliente.create({
      data: { nome: 'Cliente Inativo Teste', ativo: false },
    });
  });
  clienteInativoId = ci.id;

  const etapas = await prisma.etapa.findMany({ orderBy: { ordemPadrao: 'asc' }, take: 1 });
  if (etapas.length === 0) {
    throw new Error('Seed não rodou. Execute pnpm db:seed antes dos testes.');
  }
  etapaId = etapas[0].id;

  const artigo = await ensureArtigoAtivoComOperacoes({
    codigo: 'TEST-ART-OS',
    clienteId,
    criadoPorId: pcpId,
    etapaId,
  });
  artigoId = artigo.id;

  // Artigo em rascunho (sem operações)
  const ar = await prisma.artigo.upsert({
    where: {
      codigo_clienteId: { codigo: 'TEST-ART-OS-RASCUNHO', clienteId },
    },
    create: {
      codigo: 'TEST-ART-OS-RASCUNHO',
      descricao: 'Rascunho',
      tipoProduto: 'forma',
      clienteId,
      status: 'rascunho',
      criadoPorId: pcpId,
    },
    update: { status: 'rascunho' },
  });
  artigoRascunhoId = ar.id;
});

after(async () => {
  for (const osId of osCriadasIds) {
    await prisma.eventoOS.deleteMany({ where: { osId } });
    const lotes = await prisma.lote.findMany({ where: { osId }, select: { id: true } });
    for (const l of lotes) {
      const ops = await prisma.oPLote.findMany({
        where: { loteId: l.id },
        select: { id: true },
      });
      for (const o of ops) {
        await prisma.processamentoMaquina.deleteMany({ where: { opLoteId: o.id } });
        await prisma.carimbo.deleteMany({ where: { opLoteId: o.id } });
      }
      await prisma.oPLote.deleteMany({ where: { loteId: l.id } });
    }
    await prisma.lote.deleteMany({ where: { osId } });
    await prisma.oS.delete({ where: { id: osId } }).catch(() => {});
  }

  await prisma.operacaoArtigo
    .deleteMany({ where: { artigoId: { in: [artigoId, artigoRascunhoId] } } })
    .catch(() => {});
  await prisma.artigo
    .deleteMany({ where: { id: { in: [artigoId, artigoRascunhoId] } } })
    .catch(() => {});

  await prisma.cliente.delete({ where: { id: clienteInativoId } }).catch(() => {});

  await prisma.pessoa
    .deleteMany({ where: { codigoPessoal: 'TEST-PCP-OS' } })
    .catch(() => {});

  await closeTestApp(app);
});

// ============================================================
// Helpers
// ============================================================

function payloadValido(overrides: any = {}) {
  return {
    codigoGrv: `TEST-OS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clienteId,
    artigoId,
    quantidadeTotal: 6,
    prazoEntrega: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

async function criarOS(overrides: any = {}): Promise<any> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/os',
    headers: { authorization: `Bearer ${tokenPcp}` },
    payload: payloadValido(overrides),
  });
  if (res.statusCode === 201) {
    osCriadasIds.push(res.json().data.id);
  }
  return res;
}

// ============================================================
// POST /os — criação
// ============================================================
describe('POST /os', () => {
  test('cria OS com payload mínimo retorna 201', async () => {
    const res = await criarOS();
    assert.equal(res.statusCode, 201, res.body);
    const data = res.json().data;
    assert.ok(data.id);
    assert.equal(data.status, 'aberta');
    assert.equal(data.lotes.length, 1, 'sem divisão, deve ter 1 lote');
    assert.equal(data.lotes[0].quantidadePecas, 6);
    assert.equal(data.lotes[0].opsLote.length, 2, '2 OPs do artigo');
  });

  test('divisão quantidade_lotes=3 cria 3 lotes balanceados', async () => {
    const res = await criarOS({
      quantidadeTotal: 10,
      divisao: { tipoDivisao: 'quantidade_lotes', quantidadeLotes: 3 },
    });
    assert.equal(res.statusCode, 201);
    const lotes = res.json().data.lotes;
    assert.equal(lotes.length, 3);
    const soma = lotes.reduce((s: number, l: any) => s + l.quantidadePecas, 0);
    assert.equal(soma, 10);
    // [4, 3, 3] esperado
    assert.equal(lotes[0].quantidadePecas, 4);
    assert.equal(lotes[1].quantidadePecas, 3);
    assert.equal(lotes[2].quantidadePecas, 3);
  });

  test('divisão tamanho_lote=4 com total=10 cria 3 lotes [4,4,2]', async () => {
    const res = await criarOS({
      quantidadeTotal: 10,
      divisao: { tipoDivisao: 'tamanho_lote', tamanhoLote: 4 },
    });
    assert.equal(res.statusCode, 201);
    const lotes = res.json().data.lotes;
    assert.equal(lotes.length, 3);
    assert.equal(lotes[0].quantidadePecas, 4);
    assert.equal(lotes[1].quantidadePecas, 4);
    assert.equal(lotes[2].quantidadePecas, 2);
  });

  test('código GRV duplicado retorna 409', async () => {
    const r1 = await criarOS({ codigoGrv: 'TEST-OS-DUP-001' });
    assert.equal(r1.statusCode, 201);

    const r2 = await criarOS({ codigoGrv: 'TEST-OS-DUP-001' });
    assert.equal(r2.statusCode, 409);
    assert.equal(r2.json().error, 'duplicate_codigo_grv');
  });

  test('artigo em rascunho retorna 400', async () => {
    const res = await criarOS({ artigoId: artigoRascunhoId });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'artigo_nao_ativo');
  });

  test('cliente inativo retorna 404', async () => {
    const res = await criarOS({ clienteId: clienteInativoId });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'cliente_invalido');
  });

  test('prazo no passado retorna 400', async () => {
    const res = await criarOS({
      prazoEntrega: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'prazo_invalido');
  });

  test('quantidadeTotal=0 retorna 400', async () => {
    const res = await criarOS({ quantidadeTotal: 0 });
    assert.equal(res.statusCode, 400);
  });

  test('sem token retorna 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/os',
      payload: payloadValido(),
    });
    assert.equal(res.statusCode, 401);
  });

  test('campos financeiros são persistidos', async () => {
    const res = await criarOS({
      precoUnitario: 100,
      valorTotal: 600,
      poCliente: 'PO-TEST-1',
      statusFiscal: 'FERRO',
    });
    assert.equal(res.statusCode, 201);
    const data = res.json().data;
    // O detalhe (re-fetch) retorna decimal como string
    const detalhe = await app.inject({
      method: 'GET',
      url: `/api/os/${data.id}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    const os = detalhe.json().data;
    assert.equal(os.precoUnitario, '100');
    assert.equal(os.valorTotal, '600');
    assert.equal(os.poCliente, 'PO-TEST-1');
    assert.equal(os.statusFiscal, 'FERRO');
  });
});

// ============================================================
// GET /os
// ============================================================
describe('GET /os', () => {
  test('lista retorna 200 com array', async () => {
    await criarOS();
    const res = await app.inject({
      method: 'GET',
      url: '/api/os',
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.data));
  });

  test('filtro por status=aberta retorna apenas OS abertas', async () => {
    await criarOS();
    const res = await app.inject({
      method: 'GET',
      url: '/api/os?status=aberta',
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    const body = res.json();
    for (const os of body.data) {
      assert.equal(os.status, 'aberta');
    }
  });

  test('busca por código GRV encontra a OS', async () => {
    const codigo = `TEST-OS-BUSCA-${Date.now()}`;
    await criarOS({ codigoGrv: codigo });
    const res = await app.inject({
      method: 'GET',
      url: `/api/os?busca=${encodeURIComponent(codigo)}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    const body = res.json();
    assert.ok(body.data.some((o: any) => o.codigoGrv === codigo));
  });
});

// ============================================================
// GET /os/:id
// ============================================================
describe('GET /os/:id', () => {
  test('retorna OS com lotes e OPs', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 200);
    const data = res.json().data;
    assert.equal(data.id, osId);
    assert.ok(data.lotes);
    assert.ok(data.lotes[0].opsLote);
    assert.ok(data.cliente);
    assert.ok(data.artigo);
  });

  test('id inexistente retorna 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/os/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 404);
  });

  test('id inválido retorna 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/os/nao-eh-uuid',
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 400);
  });
});

// ============================================================
// PATCH /os/:id
// ============================================================
describe('PATCH /os/:id', () => {
  test('atualiza prazo cria evento prazo_alterado', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;
    const novoPrazo = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
      payload: { prazoEntrega: novoPrazo },
    });
    assert.equal(res.statusCode, 200);

    const eventos = await prisma.eventoOS.findMany({ where: { osId } });
    assert.ok(eventos.some((e) => e.tipo === 'prazo_alterado'));
  });

  test('atualiza prioridade cria evento prioridade_alterada', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
      payload: { prioridade: 'urgente' },
    });
    assert.equal(res.statusCode, 200);

    const eventos = await prisma.eventoOS.findMany({ where: { osId } });
    assert.ok(eventos.some((e) => e.tipo === 'prioridade_alterada'));
  });

  test('atualiza campos financeiros persiste', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
      payload: { numeroFiscal: 'NF-123', valorRecebido: 500 },
    });
    assert.equal(res.statusCode, 200);

    const detalhe = await app.inject({
      method: 'GET',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    const os = detalhe.json().data;
    assert.equal(os.numeroFiscal, 'NF-123');
    assert.equal(os.valorRecebido, '500');
  });

  test('atualizar OS cancelada retorna 400', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
      payload: { prioridade: 'urgente' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'os_imutavel');
  });
});

// ============================================================
// DELETE /os/:id (cancelamento soft - somente admin)
// ============================================================
describe('DELETE /os/:id', () => {
  test('bloqueia não-admin (PCP) com 403', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'forbidden');
  });

  test('cancela OS quando admin retorna cancelada: true', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.cancelada, true);

    const os = await prisma.oS.findUnique({ where: { id: osId } });
    assert.equal(os!.status, 'cancelada');
  });

  test('cancelar OS já cancelada retorna 400', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'ja_cancelada');
  });
});

// ============================================================
// GET /os/:id/timeline
// ============================================================
describe('GET /os/:id/timeline', () => {
  test('retorna eventos em ordem cronológica crescente', async () => {
    const criada = await criarOS();
    const osId = criada.json().data.id;

    // Gera mais eventos
    await app.inject({
      method: 'PATCH',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenPcp}` },
      payload: { prioridade: 'urgente' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/os/${osId}/timeline`,
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 200);
    const eventos = res.json().data;
    assert.ok(eventos.length >= 2);

    // Primeiro evento deve ser os_criada
    assert.equal(eventos[0].tipo, 'os_criada');

    // Ordem cronológica crescente
    for (let i = 1; i < eventos.length; i++) {
      const ant = new Date(eventos[i - 1].timestamp).getTime();
      const cur = new Date(eventos[i].timestamp).getTime();
      assert.ok(cur >= ant, 'eventos fora de ordem cronológica');
    }
  });

  test('timeline de OS inexistente retorna 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/os/00000000-0000-0000-0000-000000000000/timeline',
      headers: { authorization: `Bearer ${tokenPcp}` },
    });
    assert.equal(res.statusCode, 404);
  });
});
