// ============================================================
// Forja - Testes do endpoint /health
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp } from './helpers.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildTestApp();
  });

  after(async () => {
    await closeTestApp(app);
  });

  test('retorna 200 com status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
    assert.ok(body.env);
  });

  test('retorna timestamp em formato ISO', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = res.json();
    const timestamp = new Date(body.timestamp);
    assert.ok(!isNaN(timestamp.getTime()), 'timestamp deve ser data válida');
  });
});
