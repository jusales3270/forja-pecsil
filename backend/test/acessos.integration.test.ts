// Acessos por usuário: o admin libera/retira módulos e o backend respeita.
// Banco descartável, nunca a base da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

test('acessos por usuário na área administrativa', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async (t) => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use banco administrativo descartável terminado em _test.');
  const name = `forja_acessos_${Date.now()}_${process.pid}`;
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
    process.env.JWT_SECRET = 'acessos_integration_test_secret';
    db = (await import('../src/db/prisma.js')).prisma;
    const { buildTestApp } = await import('./helpers.js');
    app = await buildTestApp();
    await app.register((await import('../src/routes/pessoas.js')).pessoasRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/maquinas.js')).maquinasRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/dashboard.js')).dashboardRoutes, { prefix: '/api' });
    await app.ready();

    const bcrypt = (await import('bcryptjs')).default;
    const conta = async (codigo: string, papel: string) => db.pessoa.create({ data: {
      nome: codigo, codigoPessoal: codigo, papel, pinHash: await bcrypt.hash('1234', 4),
    } });
    const adm = await conta('adm', 'admin');
    const pcp = await conta('pcp2', 'pcp');
    const token = (p: any) => app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: p.nome, etapaId: null });
    const req = (p: any, method: string, reqUrl: string, payload?: any) => app.inject({
      method, url: reqUrl, payload, headers: { authorization: `Bearer ${token(p)}` },
    });

    await t.test('sem personalização o PCP não abre o Painel; o admin libera e o backend passa a aceitar', async () => {
      assert.equal((await req(pcp, 'GET', '/api/dashboard')).statusCode, 403);
      let r = await req(adm, 'PUT', `/api/pessoas/${pcp.id}`, { acessos: ['ordens_servico', 'painel_producao'] });
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json().data.acessos, ['ordens_servico', 'painel_producao']);
      assert.equal((await req(pcp, 'GET', '/api/dashboard')).statusCode, 200, 'JWT antigo, acesso lido do banco.');

      r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { codigo_pessoal: 'pcp2', pin: '1234' } });
      assert.deepEqual(r.json().data.pessoa.acessos, ['ordens_servico', 'painel_producao']);
      r = await req(pcp, 'GET', '/api/auth/me');
      assert.deepEqual(r.json().data.acessos, ['ordens_servico', 'painel_producao']);
      assert.equal(r.json().data.acessosPersonalizados, undefined);

      r = await req(adm, 'PUT', `/api/pessoas/${pcp.id}`, { acessos: null });
      assert.equal(r.json().data.acessos, null, 'Restaurar padrão.');
      assert.equal((await req(pcp, 'GET', '/api/dashboard')).statusCode, 403);
    });

    await t.test('módulo Estações libera o cadastro de máquinas no backend', async () => {
      const etapa = await db.etapa.create({ data: { nome: 'Serra', ordemPadrao: 1, slaHoras: 24, aplicaParaTipos: [] } });
      const maquina = { nome: 'Serra 1', codigoInterno: 'S1', tipo: 'outros', etapaId: etapa.id };
      assert.equal((await req(pcp, 'POST', '/api/maquinas', maquina)).statusCode, 403);
      await req(adm, 'PUT', `/api/pessoas/${pcp.id}`, { acessos: ['estacoes'] });
      assert.equal((await req(pcp, 'POST', '/api/maquinas', maquina)).statusCode, 201);
    });

    await t.test('quem tem o módulo Usuários não cria admin nem altera acessos', async () => {
      await req(adm, 'PUT', `/api/pessoas/${pcp.id}`, { acessos: ['usuarios'] });
      let r = await req(pcp, 'POST', '/api/pessoas', { nome: 'Novo', codigoPessoal: 'novo', pin: 'x', papel: 'pcp' });
      assert.equal(r.statusCode, 201, r.body);
      const novo = r.json().data;
      assert.equal((await req(pcp, 'POST', '/api/pessoas', { nome: 'Adm2', codigoPessoal: 'adm2', pin: 'x', papel: 'admin' })).statusCode, 403);
      assert.equal((await req(pcp, 'PUT', `/api/pessoas/${novo.id}`, { acessos: ['painel_producao'] })).statusCode, 403);
      assert.equal((await req(pcp, 'PUT', `/api/pessoas/${pcp.id}`, { acessos: ['painel_producao', 'usuarios'] })).statusCode, 403, 'Não aumenta o próprio acesso.');
      assert.equal((await req(pcp, 'PUT', `/api/pessoas/${adm.id}`, { nome: 'Xavier' })).statusCode, 403);
      assert.equal((await req(pcp, 'PUT', `/api/pessoas/${novo.id}`, { nome: 'Novo PCP' })).statusCode, 200);
    });

    await t.test('admin não tranca o cadastro de usuários e papel fora da área administrativa ignora acessos', async () => {
      let r = await req(adm, 'PUT', `/api/pessoas/${adm.id}`, { acessos: ['painel_producao'] });
      assert.deepEqual(r.json().data.acessos, ['painel_producao', 'usuarios']);
      r = await req(adm, 'POST', '/api/pessoas', { nome: 'Op', codigoPessoal: 'op', pin: 'x', papel: 'operador', acessos: ['painel_producao'] });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().data.acessos, null);
      r = await req(adm, 'PUT', `/api/pessoas/${pcp.id}`, { papel: 'operador' });
      assert.equal(r.json().data.acessos, null, 'Trocar para papel sem acesso configurável limpa a personalização.');
    });
    await t.test('PCP exclui dados como o admin; chefe não; papel é lido do banco', async () => {
      const chefe = await conta('chefe1', 'chefe');
      const pcpNovo = await conta('pcp3', 'pcp');
      const etapa = await db.etapa.create({ data: { nome: 'Desbaste', ordemPadrao: 2, slaHoras: 24, aplicaParaTipos: [] } });
      const tipo = () => db.tipoServico.create({ data: { nome: `SERV ${Math.random()}`, etapaId: etapa.id } });
      const t1 = await tipo();
      assert.equal((await req(chefe, 'DELETE', `/api/tipos-servico/${t1.id}`)).statusCode, 403);
      assert.equal((await req(pcpNovo, 'DELETE', `/api/tipos-servico/${t1.id}`)).statusCode, 200);
      assert.equal((await db.tipoServico.findUnique({ where: { id: t1.id } })).ativo, false);

      const t2 = await tipo();
      await db.pessoa.update({ where: { id: pcpNovo.id }, data: { papel: 'chefe' } });
      assert.equal((await req({ ...pcpNovo, papel: 'pcp' }, 'DELETE', `/api/tipos-servico/${t2.id}`)).statusCode, 403, 'JWT antigo de PCP não exclui.');
      assert.equal((await req(pcpNovo, 'DELETE', `/api/pessoas/${chefe.id}`)).statusCode, 403, 'Usuários continuam só com o admin.');
    });
  } finally {
    if (app) await app.close();
    if (db) await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
    await admin.$disconnect();
  }
});
