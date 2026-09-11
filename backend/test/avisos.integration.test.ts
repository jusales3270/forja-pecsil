// Testa as rotas reais em um banco descartável, nunca na base da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { psql, targetUrl } from '../ops/recover-database.mjs';

const require = createRequire(import.meta.url);

test('avisos privados por vínculo atual com a estação', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async (t) => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use banco administrativo descartável terminado em _test.');
  const name = `forja_recuperado_avisos_${Date.now()}_${process.pid}`;
  const databaseUrl = targetUrl(adminUrl, name);
  let prisma: any;
  let app: any;
  try {
    psql(adminUrl, `CREATE DATABASE "${name}" TEMPLATE template0;`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema',
      new URL('../prisma/schema.prisma', import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe',
    });
    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'avisos_integration_test_secret';
    prisma = (await import('../src/db/prisma.js')).prisma;
    const { buildTestApp } = await import('./helpers.js');
    app = await buildTestApp();
    await app.register((await import('../src/routes/avisos.js')).avisosRoutes, { prefix: '/api' });
    await app.ready();

    const engenharia = await prisma.etapa.create({ data: { nome: 'Engenharia', ordemPadrao: 1, slaHoras: 24, aplicaParaTipos: ['forma'] } });
    const desbaste = await prisma.etapa.create({ data: { nome: 'Desbaste', ordemPadrao: 2, slaHoras: 24, aplicaParaTipos: ['forma'] } });
    const conta = (codigo: string, etapaId: string | null, papel = 'estacao') => prisma.pessoa.create({ data: {
      nome: codigo, codigoPessoal: codigo, pinHash: 'fixture-sem-login', papel, etapaId,
    } });
    const eng = await conta('ENG', engenharia.id);
    const eng2 = await conta('ENG2', engenharia.id, 'engenharia');
    const desb = await conta('DESB', desbaste.id);
    const admin = await conta('ADMIN', null, 'admin');
    const pcp = await conta('PCP', null, 'pcp');
    const semEstacao = await conta('SEM-ESTACAO', null, 'programador');
    const token = (p: any, etapaId = p.etapaId) => app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: p.nome, etapaId });
    const tokens = new Map([eng, eng2, desb, admin, pcp, semEstacao].map(p => [p.id, token(p)]));
    const req = (p: any, method: string, url: string, payload?: any) => app.inject({
      method, url, payload, headers: { authorization: `Bearer ${tokens.get(p.id)}` },
    });
    const aviso = (mensagem: string, etapaDestinoId: string | null, destinatarioId: string | null = null, canal = 'dashboard') =>
      prisma.alerta.create({ data: { tipo: 'os_em_risco', severidade: 'info', entidadeTipo: 'OS',
        entidadeId: 'fixture', mensagem, etapaDestinoId, destinatarioId, canal } });
    const aEng = await aviso('SEGREDO ENGENHARIA', engenharia.id);
    const aDesb = await aviso('SEGREDO DESBASTE', desbaste.id);
    const pessoal = await aviso('PESSOAL DESBASTE', null, desb.id);
    const misto = await aviso('ESTACAO PREVALECE', engenharia.id, desb.id);
    const outroCanal = await aviso('OUTRO CANAL', engenharia.id, null, 'whatsapp');
    const ids = (r: any) => r.json().data.map((a: any) => a.id).sort();
    const leitura = (id: string) => prisma.alerta.findUniqueOrThrow({ where: { id } });

    await t.test('listar e observar outra estação não expõe seus avisos', async () => {
      let r = await req(desb, 'GET', '/api/avisos');
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(ids(r), [aDesb.id, pessoal.id].sort());
      for (const incluirLidos of ['false', 'true']) {
        r = await req(desb, 'GET', `/api/avisos?etapaId=${engenharia.id}&incluirLidos=${incluirLidos}`);
        assert.equal(r.statusCode, 403, r.body);
        assert.ok(!r.body.includes('SEGREDO'));
      }
      r = await req(desb, 'GET', `/api/op-lote/pendentes?etapaId=${engenharia.id}`);
      assert.equal(r.statusCode, 200, 'A observação das demandas de outra estação permanece disponível: ' + r.body);
    });

    await t.test('ID conhecido não permite leitura nem confirmação cruzada', async () => {
      for (const alvo of [aEng, misto, outroCanal]) {
        const r = await req(desb, 'PATCH', `/api/avisos/${alvo.id}/lido`);
        assert.equal(r.statusCode, 404, r.body);
        assert.ok(!r.body.includes(alvo.mensagem));
        assert.equal((await leitura(alvo.id)).visualizadoEm, null);
      }
      assert.equal((await req(eng, 'PATCH', `/api/avisos/${pessoal.id}/lido`)).statusCode, 404);
      assert.equal((await req(eng, 'PATCH', `/api/avisos/${outroCanal.id}/lido`)).statusCode, 404);
    });

    await t.test('marcar todos não pode escolher outra estação', async () => {
      let r = await req(desb, 'POST', '/api/avisos/marcar-lidos', { etapaId: engenharia.id });
      assert.equal(r.statusCode, 403, r.body);
      assert.equal((await leitura(aDesb.id)).visualizadoEm, null);
      r = await req(desb, 'POST', '/api/avisos/marcar-lidos', {});
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().data.marcados, 2);
      assert.ok((await leitura(aDesb.id)).visualizadoEm);
      assert.ok((await leitura(pessoal.id)).visualizadoEm);
      assert.equal((await leitura(aEng.id)).visualizadoEm, null);
      assert.equal((await leitura(misto.id)).visualizadoEm, null);
    });

    await t.test('admin, PCP e conta sem vínculo não recebem exceção', async () => {
      for (const p of [admin, pcp, semEstacao]) {
        let r = await req(p, 'GET', '/api/avisos?incluirLidos=true');
        assert.equal(r.statusCode, 200, r.body);
        assert.deepEqual(ids(r), []);
        assert.equal((await req(p, 'GET', `/api/avisos?etapaId=${engenharia.id}`)).statusCode, 403);
        assert.equal((await req(p, 'PATCH', `/api/avisos/${aEng.id}/lido`)).statusCode, 404);
        assert.equal((await req(p, 'POST', '/api/avisos/marcar-lidos', { etapaId: engenharia.id })).statusCode, 403);
        r = await req(p, 'POST', '/api/avisos/marcar-lidos', {});
        assert.equal(r.json().data.marcados, 0);
      }
    });

    await t.test('vínculo atual prevalece sobre claims de JWT antigos', async () => {
      await prisma.pessoa.update({ where: { id: eng2.id }, data: { etapaId: desbaste.id } });
      assert.equal((await req(eng2, 'GET', `/api/avisos?etapaId=${engenharia.id}`)).statusCode, 403);
      assert.equal((await req(eng2, 'PATCH', `/api/avisos/${aEng.id}/lido`)).statusCode, 404);
      let r = await req(eng2, 'GET', '/api/avisos?incluirLidos=true');
      assert.deepEqual(ids(r), [aDesb.id]);
      await prisma.pessoa.update({ where: { id: eng2.id }, data: { etapaId: engenharia.id } });
      await prisma.pessoa.update({ where: { id: desb.id }, data: { ativo: false } });
      assert.equal((await req(desb, 'GET', '/api/avisos')).statusCode, 401);
      assert.equal((await req(desb, 'PATCH', `/api/avisos/${aDesb.id}/lido`)).statusCode, 401);
      assert.equal((await req(desb, 'POST', '/api/avisos/marcar-lidos', {})).statusCode, 401);
      await prisma.pessoa.update({ where: { id: desb.id }, data: { ativo: true } });
      const removida = await conta('REMOVIDA', engenharia.id);
      tokens.set(removida.id, token(removida));
      await prisma.pessoa.delete({ where: { id: removida.id } });
      assert.equal((await req(removida, 'GET', '/api/avisos')).statusCode, 401);
    });

    await t.test('destinatários da mesma estação leem e confirmam sem duplicar o horário', async () => {
      for (const p of [eng, eng2]) {
        const r = await req(p, 'GET', `/api/avisos?etapaId=${engenharia.id}`);
        assert.equal(r.statusCode, 200, r.body);
        assert.deepEqual(ids(r), [aEng.id, misto.id].sort());
      }
      let r = await req(eng2, 'PATCH', `/api/avisos/${aEng.id}/lido`);
      assert.equal(r.statusCode, 200, r.body);
      const timestamp = r.json().data.visualizadoEm;
      assert.ok(timestamp);
      r = await req(eng, 'PATCH', `/api/avisos/${aEng.id}/lido`);
      assert.equal(r.json().data.visualizadoEm, timestamp);
      assert.deepEqual(ids(await req(eng, 'GET', '/api/avisos')), [misto.id]);
      assert.deepEqual(ids(await req(eng, 'GET', '/api/avisos?incluirLidos=true')), [aEng.id, misto.id].sort());
      r = await req(eng, 'POST', '/api/avisos/marcar-lidos', { etapaId: engenharia.id });
      assert.equal(r.json().data.marcados, 1);
      assert.equal((await leitura(outroCanal.id)).visualizadoEm, null);
    });

    await t.test('requisições anônimas e parâmetros inválidos são rejeitados', async () => {
      assert.equal((await app.inject({ method: 'GET', url: '/api/avisos' })).statusCode, 401);
      assert.equal((await req(eng, 'GET', '/api/avisos?etapaId=invalido')).statusCode, 400);
      assert.equal((await req(eng, 'POST', '/api/avisos/marcar-lidos', { etapaId: 'invalido' })).statusCode, 400);
      assert.equal((await req(eng, 'PATCH', '/api/avisos/invalido/lido')).statusCode, 400);
    });
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    psql(adminUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
    process.env.DATABASE_URL = adminUrl;
  }
});
