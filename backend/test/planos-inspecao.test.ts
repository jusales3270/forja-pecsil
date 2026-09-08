// ============================================================
// Forja - Testes de Plano de Inspeção
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  closeTestApp,
  ensurePessoa,
  ensureCliente,
  ensureArtigo,
  loginAsAdmin,
} from './helpers.js';
import { prisma } from '../src/db/prisma.js';

async function pegarPrimeiraEtapa(): Promise<{ id: string }> {
  const e = await prisma.etapa.findFirst({
    where: { ativa: true },
    orderBy: { ordemPadrao: 'asc' },
  });
  if (!e) throw new Error('Seed sem etapa ativa');
  return { id: e.id };
}

describe('Plano de Inspeção — CRUD', () => {
  let app: FastifyInstance;
  let token: string;
  let artigoId: string;
  let opId: string;
  let opSemPlanoId: string;
  const TEST_CODIGO = '9993';
  const TEST_PIN = '1234';
  const TEST_CLIENTE = '__TEST_CLIENTE_PLANOS';
  const TEST_ARTIGO = '__TEST_ART_PLANOS_001';

  before(async () => {
    app = await buildTestApp();
    const pessoa = await ensurePessoa({
      codigoPessoal: TEST_CODIGO,
      pin: TEST_PIN,
      nome: 'Usuário Planos Test',
    });
    const cliente = await ensureCliente(TEST_CLIENTE);
    const artigo = await ensureArtigo({
      codigo: TEST_ARTIGO,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    artigoId = artigo.id;
    const { id: etapaId } = await pegarPrimeiraEtapa();

    // Cria 2 operações: uma vai ter plano, a outra não
    const op1 = await prisma.operacaoArtigo.create({
      data: {
        artigoId,
        etapaId,
        codigoOp: 'PLN-10',
        ordem: 10,
        tipoServico: 'TESTE PARA PLANO',
        tempoUnitMin: 60,
      },
    });
    opId = op1.id;

    const op2 = await prisma.operacaoArtigo.create({
      data: {
        artigoId,
        etapaId,
        codigoOp: 'PLN-20',
        ordem: 20,
        tipoServico: 'SEM PLANO',
        tempoUnitMin: 30,
      },
    });
    opSemPlanoId = op2.id;

    token = await loginAsAdmin(app, TEST_CODIGO, TEST_PIN);
  });

  after(async () => {
    await prisma.planoInspecao.deleteMany({
      where: { operacaoArtigoId: { in: [opId, opSemPlanoId] } },
    });
    await prisma.operacaoArtigo.deleteMany({
      where: { id: { in: [opId, opSemPlanoId] } },
    });
    await prisma.artigo.deleteMany({ where: { criadoPor: { codigoPessoal: TEST_CODIGO } } });
    await prisma.artigo.deleteMany({ where: { id: artigoId } });
    await prisma.cliente.deleteMany({ where: { nome: TEST_CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('GET retorna 404 quando plano não existe', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opSemPlanoId}/plano`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'plano_nao_encontrado');
  });

  test('POST cria plano com observacoesGerais retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
      payload: { observacoesGerais: 'Plano de teste inicial' },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.operacaoArtigoId, opId);
    assert.equal(body.data.observacoesGerais, 'Plano de teste inicial');
  });

  test('POST idempotente retorna 200 com o plano existente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    assert.equal(res.statusCode, 200);
    // observacoesGerais preservado do create original
    assert.equal(res.json().data.observacoesGerais, 'Plano de teste inicial');
  });

  test('GET retorna plano com cotas: []', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.data.cotas));
    assert.equal(body.data.cotas.length, 0);
  });

  test('PATCH atualiza observacoesGerais retorna 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
      payload: { observacoesGerais: 'Atualizado via PATCH' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.observacoesGerais, 'Atualizado via PATCH');
  });

  test('GET retorna 404 operacao_nao_encontrada quando opId não existe naquele artigo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/00000000-0000-0000-0000-000000000000/plano`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'operacao_nao_encontrada');
  });

  test('DELETE remove plano retorna 204', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(get.statusCode, 404);
  });
});
