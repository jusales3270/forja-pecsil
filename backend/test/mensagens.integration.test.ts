import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { psql, targetUrl } from '../ops/recover-database.mjs';
const require = createRequire(import.meta.url);

test('recados pessoais: envio, resposta, assinatura e autorização por conta e estação', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async t => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'));
  const name = `forja_recuperado_chat_${Date.now()}_${process.pid}`;
  const url = targetUrl(adminUrl, name);
  let app: any; let db: any;
  try {
    psql(adminUrl, `CREATE DATABASE "${name}" TEMPLATE template0;`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
    });
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'test';
    db = (await import('../src/db/prisma.js')).prisma;
    app = await (await import('./helpers.js')).buildTestApp();
    await app.register((await import('../src/routes/mensagens.js')).mensagensRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/avisos.js')).avisosRoutes, { prefix: '/api' });
    await app.ready();
    const etapa = (nome: string, ordemPadrao: number) => db.etapa.create({ data: { nome, ordemPadrao, slaHoras: 24, aplicaParaTipos: ['forma'] } });
    const eng = await etapa('Engenharia', 1); const desb = await etapa('Desbaste', 2);
    const conta = (nome: string, etapaId: string | null, papel = 'programador') => db.pessoa.create({ data: {
      nome, codigoPessoal: nome, etapaId, papel, pinHash: 'fixture',
    } });
    const guilherme = await conta('Guilherme', eng.id);
    const pedro = await conta('Pedro', desb.id);
    const colega = await conta('Colega', desb.id);
    const admin = await conta('Admin', null, 'admin');
    const token = (p: any) => app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: 'NOME ANTIGO NO JWT', etapaId: p.etapaId });
    const tokens = new Map([guilherme, pedro, colega, admin].map(p => [p.id, token(p)]));
    const req = (p: any, method: string, url: string, payload?: any) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens.get(p.id)}` } });
    const input = { id: randomUUID(), corpo: '  Pedro, prioridade na OS solicitada pelo Domingo.  ', etapaDestinoId: desb.id, destinatarioId: pedro.id };
    let mensagem: any;

    await t.test('diretório só expõe contas ativas e campos necessários', async () => {
      const r = await req(guilherme, 'GET', '/api/mensagens/contatos');
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().data.podeEnviar, true);
      assert.equal(r.json().data.conta.nome, 'Guilherme');
      assert.deepEqual(Object.keys(r.json().data.estacoes[1].pessoas[0]).sort(), ['codigoPessoal', 'id', 'nome']);
      assert.ok(!r.body.includes('pinHash'));
      assert.equal((await req(admin, 'GET', '/api/mensagens/contatos')).json().data.podeEnviar, false);
    });
    await t.test('servidor valida destinatário e rejeita falsificação de assinatura', async () => {
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, remetenteNome: 'Domingo' })).statusCode, 400);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, remetenteId: admin.id })).statusCode, 400);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, criadoEm: '2000-01-01' })).statusCode, 400);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, etapaDestinoId: eng.id })).statusCode, 400);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, corpo: '  ' })).statusCode, 400);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, corpo: 'a'.repeat(4001) })).statusCode, 400);
      assert.equal((await req(admin, 'POST', '/api/mensagens', input)).statusCode, 403);
      const r = await req(guilherme, 'POST', '/api/mensagens', input);
      assert.equal(r.statusCode, 201, r.body); mensagem = r.json().data;
      assert.equal(mensagem.remetenteNome, 'Guilherme');
      assert.equal(mensagem.destinatarioNome, 'Pedro');
      assert.equal(mensagem.corpo, input.corpo.trim());
      assert.ok(Math.abs(Date.now() - Date.parse(mensagem.criadoEm)) < 10000);
      assert.equal(mensagem.lidoEm, null);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', input)).json().data.id, mensagem.id);
      assert.equal(await db.mensagemInterna.count(), 1, 'Repetição da tentativa não duplica a mensagem');
      assert.equal((await req(colega, 'POST', '/api/mensagens', input)).statusCode, 409);
    });
    await t.test('somente remetente e destinatário leem; colega e admin não acessam por ID', async () => {
      for (const p of [colega, admin]) {
        assert.deepEqual((await req(p, 'GET', '/api/mensagens')).json().data, []);
        assert.deepEqual((await req(p, 'GET', '/api/mensagens?caixa=enviadas')).json().data, []);
        assert.equal((await req(p, 'GET', `/api/mensagens/${mensagem.id}`)).statusCode, 404);
        assert.equal((await req(p, 'PATCH', `/api/mensagens/${mensagem.id}/lida`)).statusCode, 404);
        assert.equal((await req(p, 'POST', `/api/mensagens/${mensagem.id}/responder`, { id: randomUUID(), corpo: 'intruso' })).statusCode, 404);
      }
      assert.equal((await req(guilherme, 'GET', '/api/mensagens?caixa=enviadas')).json().data[0].id, mensagem.id);
      assert.equal((await req(pedro, 'GET', '/api/mensagens')).json().meta.naoLidas, 1);
      assert.equal((await req(guilherme, 'PATCH', `/api/mensagens/${mensagem.id}/lida`)).statusCode, 404);
      assert.equal((await req(guilherme, 'POST', `/api/mensagens/${mensagem.id}/responder`, { id: randomUUID(), corpo: 'Não sou destinatário' })).statusCode, 404);
      assert.deepEqual((await req(colega, 'GET', '/api/avisos')).json().data, [], 'Recados pessoais não entram no canal compartilhado da estação');
    });
    await t.test('leitura preserva primeira data e resposta volta ao autor autenticada', async () => {
      const r = await req(pedro, 'PATCH', `/api/mensagens/${mensagem.id}/lida`);
      assert.equal(r.statusCode, 200, r.body);
      const lidoEm = r.json().data.lidoEm;
      assert.ok(lidoEm);
      assert.equal((await req(pedro, 'PATCH', `/api/mensagens/${mensagem.id}/lida`)).json().data.lidoEm, lidoEm);
      assert.equal((await req(pedro, 'GET', '/api/mensagens')).json().meta.naoLidas, 0);
      const resposta = await req(pedro, 'POST', `/api/mensagens/${mensagem.id}/responder`, { id: randomUUID(), corpo: 'Vou priorizar agora.' });
      assert.equal(resposta.statusCode, 201, resposta.body);
      const m = resposta.json().data;
      assert.equal(m.remetenteNome, 'Pedro'); assert.equal(m.destinatarioId, guilherme.id);
      assert.equal(m.etapaDestino.id, eng.id); assert.equal(m.respostaAId, mensagem.id);
      assert.equal((await req(guilherme, 'GET', '/api/mensagens')).json().data[0].id, m.id);
      assert.equal((await req(pedro, 'GET', '/api/mensagens?caixa=enviadas')).json().data[0].id, m.id);
    });
    await t.test('paginação preserva histórico e contagem de não lidas sem incluir terceiros', async () => {
      await db.mensagemInterna.createMany({ data: Array.from({ length: 31 }, (_, i) => ({
        id: randomUUID(), corpo: `Histórico ${i}`, remetenteId: guilherme.id, destinatarioId: pedro.id,
        etapaOrigemId: eng.id, etapaDestinoId: desb.id, remetenteNome: 'Guilherme', destinatarioNome: 'Pedro',
      })) });
      const primeira = (await req(pedro, 'GET', '/api/mensagens')).json();
      const segunda = (await req(pedro, 'GET', '/api/mensagens?pagina=2')).json();
      assert.equal(primeira.meta.total, 32); assert.equal(primeira.meta.naoLidas, 31);
      assert.equal(primeira.data.length, 30); assert.equal(segunda.data.length, 2);
      assert.equal(new Set([...primeira.data, ...segunda.data].map((m: any) => m.id)).size, 32);
      assert.equal((await req(colega, 'GET', '/api/mensagens')).json().meta.naoLidas, 0);
    });
    await t.test('mudança de estação, inativação e JWT antigo não contornam a regra', async () => {
      await db.pessoa.update({ where: { id: pedro.id }, data: { etapaId: eng.id } });
      assert.deepEqual((await req(pedro, 'GET', '/api/mensagens')).json().data, []);
      assert.equal((await req(pedro, 'GET', `/api/mensagens/${mensagem.id}`)).statusCode, 404);
      assert.equal((await req(pedro, 'PATCH', `/api/mensagens/${mensagem.id}/lida`)).statusCode, 404);
      assert.equal((await req(pedro, 'POST', `/api/mensagens/${mensagem.id}/responder`, { id: randomUUID(), corpo: 'antiga estação' })).statusCode, 404);
      await db.pessoa.update({ where: { id: pedro.id }, data: { etapaId: desb.id, ativo: false } });
      assert.equal((await req(pedro, 'GET', '/api/mensagens')).statusCode, 401);
      assert.equal((await req(guilherme, 'POST', '/api/mensagens', { ...input, id: randomUUID() })).statusCode, 400);
      await db.pessoa.update({ where: { id: pedro.id }, data: { ativo: true } });
      await db.pessoa.update({ where: { id: guilherme.id }, data: { etapaId: desb.id, nome: 'Nome alterado' } });
      assert.equal((await req(pedro, 'POST', `/api/mensagens/${mensagem.id}/responder`, { id: randomUUID(), corpo: 'destino mudou' })).statusCode, 409);
      assert.equal((await req(guilherme, 'GET', '/api/mensagens?caixa=enviadas')).json().data[0].remetenteNome, 'Guilherme', 'Assinatura histórica preservada');
      await db.etapa.update({ where: { id: desb.id }, data: { ativa: false } });
      assert.deepEqual((await req(pedro, 'GET', '/api/mensagens')).json().data, []);
      assert.equal((await req(pedro, 'POST', '/api/mensagens', { ...input, id: randomUUID(), destinatarioId: guilherme.id })).statusCode, 403);
    });
    await t.test('anônimos e filtros adulterados são rejeitados', async () => {
      for (const path of ['/api/mensagens', '/api/mensagens/contatos', `/api/mensagens/${mensagem.id}`]) {
        assert.equal((await app.inject({ method: 'GET', url: path })).statusCode, 401);
      }
      assert.equal((await req(pedro, 'GET', `/api/mensagens?destinatarioId=${colega.id}`)).statusCode, 400);
      assert.equal((await req(pedro, 'GET', '/api/mensagens?pagina=1.5')).statusCode, 400);
      assert.equal((await req(pedro, 'GET', '/api/mensagens/invalido')).statusCode, 400);
    });
  } finally {
    await app?.close(); await db?.$disconnect();
    psql(adminUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
    process.env.DATABASE_URL = adminUrl;
  }
});
