// Estação PCP nas mensagens: o chão de fábrica escreve para o PCP, e as contas
// com papel pcp respondem por ela. Banco descartável, nunca a base da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

test('operários enviam mensagens ao PCP e o papel pcp responde pela estação', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async (t) => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use banco administrativo descartável terminado em _test.');
  const name = `forja_msg_pcp_${Date.now()}_${process.pid}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  let db: any;
  let app: any;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema',
      new URL('../prisma/schema.prisma', import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'mensagens_pcp_integration_secret';
    db = (await import('../src/db/prisma.js')).prisma;
    const { buildTestApp } = await import('./helpers.js');
    app = await buildTestApp();
    await app.register((await import('../src/routes/mensagens.js')).mensagensRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/dashboard.js')).dashboardRoutes, { prefix: '/api' });
    await app.ready();

    const desbaste = await db.etapa.create({ data: { nome: 'Desbaste', ordemPadrao: 1, slaHoras: 24, aplicaParaTipos: [] } });
    const pcpEt = await db.etapa.create({ data: { nome: 'PCP', ordemPadrao: 2, slaHoras: 24, aplicaParaTipos: [] } });
    const conta = (nome: string, papel: string, etapaId: string | null = null) =>
      db.pessoa.create({ data: { nome, codigoPessoal: nome.toUpperCase(), papel, etapaId, pinHash: 'fixture' } });
    const operario = await conta('Operario', 'estacao', desbaste.id);
    const colega = await conta('Colega', 'estacao', desbaste.id);
    const rafael = await conta('Rafael', 'pcp');
    const chefe = await conta('Chefe', 'chefe');
    const tokens = new Map([operario, colega, rafael, chefe].map((p: any) =>
      [p.id, app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: p.nome, etapaId: p.etapaId })]));
    const req = (p: any, method: string, reqUrl: string, payload?: any) => app.inject({
      method, url: reqUrl, payload, headers: { authorization: `Bearer ${tokens.get(p.id)}` },
    });

    let recado: any;
    await t.test('PCP aparece primeiro, com o Rafael como responsável, e o recado chega só para ele', async () => {
      const contatos = (await req(operario, 'GET', '/api/mensagens/contatos')).json().data;
      assert.equal(contatos.estacoes[0].nome, 'PCP');
      assert.deepEqual(contatos.estacoes[0].pessoas.map((p: any) => p.nome), ['Rafael']);
      assert.ok(!contatos.estacoes[1].pessoas.some((p: any) => p.id === rafael.id), 'O PCP não aparece como responsável de outras estações.');

      const r = await req(operario, 'POST', '/api/mensagens', {
        id: randomUUID(), corpo: 'Rafael, faltou material para o lote 2.', etapaDestinoId: pcpEt.id, destinatarioId: rafael.id,
      });
      assert.equal(r.statusCode, 201, r.body);
      recado = r.json().data;
      assert.equal(recado.etapaOrigem.nome, 'Desbaste');
      assert.equal(recado.etapaDestino.nome, 'PCP');

      const caixa = (await req(rafael, 'GET', '/api/mensagens')).json();
      assert.deepEqual(caixa.data.map((m: any) => m.id), [recado.id]);
      assert.equal(caixa.meta.naoLidas, 1);
      assert.equal((await req(colega, 'GET', `/api/mensagens/${recado.id}`)).statusCode, 404);
      assert.equal((await req(chefe, 'GET', `/api/mensagens/${recado.id}`)).statusCode, 404);
    });

    await t.test('PCP sem estação no cadastro lê, responde como PCP e recebe a tréplica', async () => {
      assert.equal((await req(rafael, 'GET', '/api/mensagens/contatos')).json().data.podeEnviar, true);
      assert.equal((await req(rafael, 'PATCH', `/api/mensagens/${recado.id}/lida`)).statusCode, 200);
      let r = await req(rafael, 'POST', `/api/mensagens/${recado.id}/responder`, { id: randomUUID(), corpo: 'Chega amanhã cedo.' });
      assert.equal(r.statusCode, 201, r.body);
      const resposta = r.json().data;
      assert.equal(resposta.destinatarioId, operario.id);
      assert.equal(resposta.etapaOrigem.nome, 'PCP');

      r = await req(operario, 'POST', `/api/mensagens/${resposta.id}/responder`, { id: randomUUID(), corpo: 'Obrigado.' });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().data.destinatarioId, rafael.id);
      assert.equal(r.json().data.etapaDestino.nome, 'PCP');
    });

    await t.test('na estação PCP só o papel pcp recebe; outras contas não', async () => {
      const r = await req(rafael, 'POST', '/api/mensagens', {
        id: randomUUID(), corpo: 'teste', etapaDestinoId: pcpEt.id, destinatarioId: colega.id,
      });
      assert.equal(r.statusCode, 400, r.body);
    });

    await t.test('PCP fica fora das listas de produção', async () => {
      const etapas = (await req(operario, 'GET', '/api/etapas')).json().data;
      assert.deepEqual(etapas.map((e: any) => e.nome), ['Desbaste']);
      const cadastro = (await req(operario, 'GET', '/api/etapas?incluirInativas=true')).json().data;
      assert.ok(cadastro.some((e: any) => e.nome === 'PCP'));
      const d = (await req(chefe, 'GET', '/api/dashboard')).json().data;
      assert.ok(!d.kanban.some((k: any) => k.nome === 'PCP'));
    });

    await t.test('estação PCP desativada suspende a caixa do papel pcp', async () => {
      await db.etapa.update({ where: { id: pcpEt.id }, data: { ativa: false } });
      assert.equal((await req(rafael, 'GET', '/api/mensagens')).json().data.length, 0);
      assert.equal((await req(rafael, 'GET', '/api/mensagens/contatos')).json().data.podeEnviar, false);
    });
  } finally {
    if (app) await app.close();
    if (db) await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
    await admin.$disconnect();
  }
});
