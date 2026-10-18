// ============================================================
// Forja - Proteções do servidor (P-07)
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuth } from '../src/lib/auth.js';
import { registrarSeguranca, LIMITE_LOGIN, registrarFalhaLogin, loginBloqueadoPor } from '../src/lib/seguranca.js';
import { authRoutes } from '../src/routes/auth.js';
import { ensurePessoa } from './helpers.js';
import { prisma } from '../src/db/prisma.js';

describe('Hardening', () => {
  let app: FastifyInstance;
  before(async () => {
    app = Fastify({ logger: false });
    await registrarSeguranca(app);
    await registerAuth(app);
    app.get('/health', async () => ({ status: 'ok' }));
    await app.register(authRoutes, { prefix: '/api' });
    await app.ready();
    await ensurePessoa({ codigoPessoal: '9971', pin: '1234', nome: 'Hardening' });
  });
  after(async () => {
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: '9971' } });
    await app.close();
  });

  const login = (codigo: string, pin: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { codigo_pessoal: codigo, pin } });

  test('login certo nunca é barrado, mesmo muitas vezes seguidas (tótem, conta do posto)', async () => {
    for (let i = 0; i < LIMITE_LOGIN.max + 5; i++) assert.equal((await login('9971', '1234')).statusCode, 200);
  });

  test('acertar o PIN zera as tentativas erradas', async () => {
    for (let i = 0; i < LIMITE_LOGIN.max - 1; i++) assert.equal((await login('9971', '0000')).statusCode, 401);
    assert.equal((await login('9971', '1234')).statusCode, 200);
    for (let i = 0; i < LIMITE_LOGIN.max - 1; i++) assert.equal((await login('9971', '0000')).statusCode, 401);
    assert.equal((await login('9971', '1234')).statusCode, 200);
  });

  test('10 PINs errados bloqueiam aquele código; outro código segue normal', async () => {
    for (let i = 0; i < LIMITE_LOGIN.max; i++) assert.equal((await login('9971', '0000')).statusCode, 401);
    const bloqueado = await login('9971', '1234');
    assert.equal(bloqueado.statusCode, 429, 'nem a senha certa passa durante o bloqueio');
    assert.match(bloqueado.json().message, /Tente de novo em \d+ min/);
    assert.equal((await login('9972', '0000')).statusCode, 401, 'o limite é por código, não trava a fábrica');
  });

  test('o bloqueio acaba sozinho depois da janela', () => {
    const chave = 'teste|janela';
    const t0 = 1_000_000;
    for (let i = 0; i < LIMITE_LOGIN.max; i++) registrarFalhaLogin(chave, t0);
    assert.ok(loginBloqueadoPor(chave, t0 + 1000) > 0);
    assert.equal(loginBloqueadoPor(chave, t0 + LIMITE_LOGIN.janelaMs + 1), 0);
  });

  test('cabeçalhos de segurança', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.ok(r.headers['x-frame-options']);
    assert.equal(r.headers['x-powered-by'], undefined);
  });
});

test('em produção, a Forja não sobe com a chave de desenvolvimento do JWT', () => {
  const rodar = (jwt: string | undefined) =>
    spawnSync(process.execPath, ['--import', 'tsx', '-e', "import('./src/lib/env.ts').then(() => console.log('SUBIU'))"], {
      env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: jwt ?? '' },
      encoding: 'utf8',
    });
  const sem = rodar(undefined);
  assert.notEqual(sem.status, 0);
  assert.match(sem.stderr, /JWT_SECRET ausente ou curto/);
  const com = rodar('uma-chave-de-producao-bem-longa-123');
  assert.equal(com.status, 0, com.stderr);
  assert.match(com.stdout, /SUBIU/);
});
