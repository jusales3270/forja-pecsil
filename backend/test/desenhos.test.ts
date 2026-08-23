// ============================================================
// Forja - Testes de Desenhos (CRUD de metadados, sem upload real)
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

describe('Desenhos — CRUD de metadados', () => {
  let app: FastifyInstance;
  let token: string;
  let artigoId: string;
  const TEST_CODIGO = '9990';
  const TEST_PIN = '1234';
  const TEST_CLIENTE = '__TEST_CLIENTE_DESENHOS';
  const TEST_ARTIGO = '__TEST_ART_DES_001';

  before(async () => {
    app = await buildTestApp();
    const pessoa = await ensurePessoa({
      codigoPessoal: TEST_CODIGO,
      pin: TEST_PIN,
      nome: 'Usuário Desenhos Test',
    });
    const cliente = await ensureCliente(TEST_CLIENTE);
    const artigo = await ensureArtigo({
      codigo: TEST_ARTIGO,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    artigoId = artigo.id;
    token = await loginAsAdmin(app, TEST_CODIGO, TEST_PIN);
  });

  after(async () => {
    await prisma.desenho.deleteMany({ where: { artigoId } });
    await prisma.artigo.deleteMany({ where: { id: artigoId } });
    await prisma.cliente.deleteMany({ where: { nome: TEST_CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('cria desenho com dados válidos retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        tipo: 'cliente',
        codigoDesenho: 'DES-001',
        revisao: 'A',
        observacoes: 'teste',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.tipo, 'cliente');
    assert.equal(body.data.codigoDesenho, 'DES-001');
    assert.equal(body.data.revisao, 'A');
    assert.equal(body.data.artigoId, artigoId);
    assert.equal(body.data.arquivoKey, null);
  });

  test('bloqueia duplicidade exata retorna 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tipo: 'cliente', codigoDesenho: 'DES-001', revisao: 'A' },
    });

    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'duplicate_desenho');
  });

  test('permite mesmo código com revisão diferente retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tipo: 'cliente', codigoDesenho: 'DES-001', revisao: 'B' },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.json().data.revisao, 'B');
  });

  test('lista desenhos do artigo retorna 200 com array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2, 'deve ter pelo menos os 2 criados antes');
  });

  test('atualiza desenho retorna 200 com novos valores', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
    });
    const id = list.json().data[0].id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/artigos/${artigoId}/desenhos/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { observacoes: 'observacao atualizada' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.observacoes, 'observacao atualizada');
  });

  test('deleta desenho retorna 204 e some na consulta', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tipo: 'forma', codigoDesenho: 'TO-DELETE', revisao: 'A' },
    });
    const id = create.json().data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/artigos/${artigoId}/desenhos/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(get.statusCode, 404);
  });

  test('retorna 404 para artigo inexistente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/00000000-0000-0000-0000-000000000000/desenhos`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'artigo_nao_encontrado');
  });

  test('retorna 404 para desenho inexistente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'desenho_nao_encontrado');
  });

  test('GET /arquivo retorna 404 quando desenho não tem arquivo anexado', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/desenhos`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tipo: 'cliente', codigoDesenho: 'DES-STREAM-TEST', revisao: '01' },
    });
    const id = create.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos/${id}/arquivo`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'arquivo_nao_anexado');

    // Testa também com token via query parameter
    const resQuery = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos/${id}/arquivo?token=${token}`,
    });

    assert.equal(resQuery.statusCode, 404);
    assert.equal(resQuery.json().error, 'arquivo_nao_anexado');
  });

  test('GET /arquivo retorna 401 quando sem token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/desenhos/00000000-0000-0000-0000-000000000000/arquivo`,
    });

    assert.equal(res.statusCode, 401);
  });
});

