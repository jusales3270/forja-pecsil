// ============================================================
// Forja - Área administrativa: só admin, PCP e chefe gravam
// ============================================================
// As telas já escondiam os cadastros; aqui o servidor também recusa.
// Corpo vazio de propósito: quem passa da trava toma 400 (validação), quem
// não passa toma 403 — nada é gravado.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp, ensurePessoa, loginAs } from './helpers.js';
import { pessoasRoutes } from '../src/routes/pessoas.js';
import { motivosParadaRoutes } from '../src/routes/motivos-parada.js';

let app: FastifyInstance;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

before(async () => {
  app = await buildTestApp();
  await app.register(pessoasRoutes, { prefix: '/api' });
  await app.register(motivosParadaRoutes, { prefix: '/api' });
  for (const papel of ['admin', 'pcp', 'chefe', 'engenharia', 'operador', 'estacao', 'programador'] as const) {
    const codigo = `TEST-AREA-${papel.toUpperCase()}`;
    const p = await ensurePessoa({ codigoPessoal: codigo, pin: '5555', papel });
    ids[papel] = p.id;
    tokens[papel] = await loginAs(app, codigo, '5555');
  }
});

after(async () => {
  await closeTestApp(app);
});

const req = (papel: string, method: 'POST' | 'PUT', url: string, payload: any = {}) =>
  app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens[papel]}` } });

describe('área administrativa', () => {
  for (const papel of ['engenharia', 'operador', 'estacao', 'programador']) {
    test(`${papel} não grava cadastros nem usuários`, async () => {
      assert.equal((await req(papel, 'POST', '/api/tipos-servico')).statusCode, 403);
      assert.equal((await req(papel, 'POST', '/api/motivos-parada')).statusCode, 403);
      assert.equal((await req(papel, 'POST', '/api/pessoas')).statusCode, 403);
      // nem se promover
      assert.equal((await req(papel, 'PUT', `/api/pessoas/${ids[papel]}`, { papel: 'pcp' })).statusCode, 403);
    });
  }

  for (const papel of ['admin', 'pcp', 'chefe']) {
    test(`${papel} passa da trava dos cadastros`, async () => {
      assert.equal((await req(papel, 'POST', '/api/tipos-servico')).statusCode, 400);
      assert.equal((await req(papel, 'POST', '/api/motivos-parada')).statusCode, 400);
    });
  }

  test('só o admin cadastra usuários', async () => {
    assert.equal((await req('admin', 'POST', '/api/pessoas')).statusCode, 400);
    assert.equal((await req('pcp', 'POST', '/api/pessoas')).statusCode, 403);
    assert.equal((await req('chefe', 'POST', '/api/pessoas')).statusCode, 403);
  });
});
