// Cadastro e exclusão de clientes pela Nova OS. Banco descartável.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

test('PCP cadastra e exclui clientes sem perder histórico', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async (t) => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use banco administrativo descartável terminado em _test.');
  const name = `forja_clientes_${Date.now()}_${process.pid}`;
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
    process.env.JWT_SECRET = 'clientes_integration_test_secret';
    db = (await import('../src/db/prisma.js')).prisma;
    const { buildTestApp } = await import('./helpers.js');
    app = await buildTestApp();
    await app.ready();

    const etapa = await db.etapa.create({ data: { nome: 'Torno', ordemPadrao: 1, slaHoras: 24, aplicaParaTipos: [] } });
    const conta = (codigo: string, papel: string, etapaId: string | null = null) =>
      db.pessoa.create({ data: { nome: codigo, codigoPessoal: codigo, papel, etapaId, pinHash: 'fixture' } });
    const pcp = await conta('pcp', 'pcp');
    const posto = await conta('torno', 'estacao', etapa.id);
    const req = (p: any, method: string, reqUrl: string, payload?: any) => app.inject({
      method, url: reqUrl, payload,
      headers: { authorization: `Bearer ${app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: p.nome, etapaId: p.etapaId })}` },
    });
    const lista = async () => (await req(pcp, 'GET', '/api/clientes')).json().data.map((c: any) => c.nome);

    await t.test('cadastra, recusa nome repetido e conta de estação não mexe na lista', async () => {
      let r = await req(pcp, 'POST', '/api/clientes', { nome: '  Nadir Figueiredo  ' });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().data.nome, 'Nadir Figueiredo');
      r = await req(pcp, 'POST', '/api/clientes', { nome: 'nadir figueiredo' });
      assert.equal(r.statusCode, 409);
      assert.equal((await req(pcp, 'POST', '/api/clientes', { nome: 'X' })).statusCode, 400);
      assert.equal((await req(posto, 'POST', '/api/clientes', { nome: 'Outro' })).statusCode, 403);
      assert.deepEqual(await lista(), ['Nadir Figueiredo']);
    });

    await t.test('sem histórico exclui de vez; com artigo só sai da lista e pode voltar', async () => {
      const semUso = (await req(pcp, 'POST', '/api/clientes', { nome: 'Cliente Errado' })).json().data;
      let r = await req(pcp, 'DELETE', `/api/clientes/${semUso.id}`);
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().data.excluido, true);
      assert.equal(await db.cliente.count({ where: { id: semUso.id } }), 0);

      const comArtigo = (await req(pcp, 'POST', '/api/clientes', { nome: 'Verallia' })).json().data;
      await db.artigo.create({ data: { codigo: 'A1', descricao: 'Forma', tipoProduto: 'forma', clienteId: comArtigo.id, criadoPorId: pcp.id } });
      assert.equal((await req(posto, 'DELETE', `/api/clientes/${comArtigo.id}`)).statusCode, 403);
      r = await req(pcp, 'DELETE', `/api/clientes/${comArtigo.id}`);
      assert.equal(r.json().data.desativado, true);
      assert.match(r.json().message, /histórico foi mantido/);
      assert.ok(!(await lista()).includes('Verallia'));
      assert.equal(await db.artigo.count({ where: { clienteId: comArtigo.id } }), 1, 'Artigo continua ligado ao cliente.');

      r = await req(pcp, 'POST', '/api/clientes', { nome: 'VERALLIA' });
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().meta.reativado, true);
      assert.equal(r.json().data.id, comArtigo.id, 'Reativa o mesmo cliente, com o histórico.');
      assert.ok((await lista()).includes('VERALLIA'));
    });
  } finally {
    if (app) await app.close();
    if (db) await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
    await admin.$disconnect();
  }
});
