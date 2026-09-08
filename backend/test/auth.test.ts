// ============================================================
// Forja - Testes de autenticação
// Cobre: /api/auth/login, /api/auth/me
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { buildTestApp, closeTestApp } from './helpers.js';
import { prisma } from '../src/db/prisma.js';

describe('POST /api/auth/login', () => {
  let app: FastifyInstance;
  const TEST_CODIGO = '9999';
  const TEST_PIN = '1234';

  before(async () => {
    app = await buildTestApp();

    // Cria usuário de teste idempotentemente
    const pinHash = await bcrypt.hash(TEST_PIN, 10);
    await prisma.pessoa.upsert({
      where: { codigoPessoal: TEST_CODIGO },
      create: {
        nome: 'Usuário de Teste',
        codigoPessoal: TEST_CODIGO,
        pinHash,
        papel: 'admin',
        ativo: true,
      },
      update: {
        pinHash,
        ativo: true,
      },
    });
  });

  after(async () => {
    // Limpa usuário de teste
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('login com credenciais válidas retorna token + pessoa', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: TEST_CODIGO, pin: TEST_PIN },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.data.token, 'deve retornar token');
    assert.equal(body.data.pessoa.codigoPessoal ?? TEST_CODIGO, TEST_CODIGO);
    assert.equal(body.data.pessoa.papel, 'admin');
    assert.equal(body.data.pessoa.ativo, true);
  });

  test('login com PIN errado retorna 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: TEST_CODIGO, pin: '0000' },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.error, 'invalid_credentials');
  });

  test('login com código inexistente retorna 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: '0000', pin: '1234' },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.error, 'invalid_credentials');
  });

  test('login sem PIN retorna 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: TEST_CODIGO },
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.error, 'invalid_input');
  });

  test('login com senha vazia retorna 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: TEST_CODIGO, pin: '' },
    });

    assert.equal(res.statusCode, 400);
  });
});

describe('GET /api/auth/me', () => {
  let app: FastifyInstance;
  let token: string;
  const TEST_CODIGO = '9998';
  const TEST_PIN = '4321';

  before(async () => {
    app = await buildTestApp();

    const pinHash = await bcrypt.hash(TEST_PIN, 10);
    await prisma.pessoa.upsert({
      where: { codigoPessoal: TEST_CODIGO },
      create: {
        nome: 'Usuário Me',
        codigoPessoal: TEST_CODIGO,
        pinHash,
        papel: 'pcp',
        ativo: true,
      },
      update: { pinHash, ativo: true },
    });

    // Faz login pra obter token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { codigo_pessoal: TEST_CODIGO, pin: TEST_PIN },
    });
    token = loginRes.json().data.token;
  });

  after(async () => {
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('retorna dados da pessoa logada com token válido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.data.codigoPessoal, TEST_CODIGO);
    assert.equal(body.data.papel, 'pcp');
    assert.equal(body.data.ativo, true);
  });

  test('retorna 401 sem token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    assert.equal(res.statusCode, 401);
  });

  test('retorna 401 com token inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer token_invalido_xxxxxxxxxxxx' },
    });

    assert.equal(res.statusCode, 401);
  });
});
