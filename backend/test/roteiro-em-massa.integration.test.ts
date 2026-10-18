// ============================================================
// Forja - Roteiro padrão aplicado em massa (P-01)
// ============================================================
// Sempre filtrado pelo cliente de teste: a aplicação em massa nunca toca
// artigo de verdade da base local.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp, ensurePessoa, ensureCliente, ensureArtigo, loginAs } from './helpers.js';
import { prisma } from '../src/db/prisma.js';
import { buscarRoteiroPadrao } from '../src/data/roteiros-padrao.js';

describe('Roteiro padrão em massa', () => {
  let app: FastifyInstance;
  let token: string;
  let tokenOperador: string;
  let clienteId: string;
  const artigos: string[] = [];
  const CLIENTE = '__TEST_CLIENTE_EM_MASSA';
  const ROTEIRO = 'arruela-grv';
  const N_OPS = buscarRoteiroPadrao(ROTEIRO)!.operacoes.length;

  before(async () => {
    app = await buildTestApp();
    const pcp = await ensurePessoa({ codigoPessoal: '9981', pin: '1234', nome: 'PCP em massa', papel: 'pcp' });
    await ensurePessoa({ codigoPessoal: '9982', pin: '1234', nome: 'Operador em massa', papel: 'operador' });
    clienteId = (await ensureCliente(CLIENTE)).id;
    for (const codigo of ['__MASSA_1', '__MASSA_2', '__MASSA_3', '__MASSA_COM', '__MASSA_ARQ']) {
      const a = await ensureArtigo({ codigo, clienteId, criadoPorId: pcp.id, tipoProduto: 'funil' });
      artigos.push(a.id);
    }
    await prisma.artigo.update({ where: { id: artigos[4] }, data: { status: 'arquivado' } });
    token = await loginAs(app, '9981', '1234');
    tokenOperador = await loginAs(app, '9982', '1234');
    // Um deles já tem roteiro próprio: a aplicação em massa não pode mexer nele.
    const r = await app.inject({ method: 'POST', url: `/api/artigos/${artigos[3]}/operacoes/aplicar-roteiro`, headers: { authorization: `Bearer ${token}` }, payload: { roteiroId: 'fundicao-grv' } });
    assert.equal(r.statusCode, 201);
  });

  after(async () => {
    await prisma.planoInspecao.deleteMany({ where: { operacaoArtigo: { artigoId: { in: artigos } } } });
    await prisma.operacaoArtigo.deleteMany({ where: { artigoId: { in: artigos } } });
    await prisma.artigo.deleteMany({ where: { id: { in: artigos } } });
    await prisma.cliente.deleteMany({ where: { nome: CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: { in: ['9981', '9982'] } } });
    await closeTestApp(app);
  });

  const emMassa = (payload: object, t = token) =>
    app.inject({ method: 'POST', url: `/api/roteiros-padrao/${ROTEIRO}/aplicar-em-massa`, headers: { authorization: `Bearer ${t}` }, payload });

  test('simular conta só os artigos sem roteiro (fora o arquivado e o que já tem) e não grava nada', async () => {
    const r = await emMassa({ tipoProduto: 'funil', clienteId, simular: true });
    assert.equal(r.statusCode, 200);
    const d = r.json().data;
    assert.equal(d.simulado, true);
    assert.equal(d.total, 3);
    assert.deepEqual(d.amostra.map((a: any) => a.codigo), ['__MASSA_1', '__MASSA_2', '__MASSA_3']);
    assert.equal(await prisma.operacaoArtigo.count({ where: { artigoId: { in: artigos.slice(0, 3) } } }), 0);
  });

  test('aplica nos 3, na sequência do modelo, e não toca no que já tinha roteiro', async () => {
    const antes = await prisma.operacaoArtigo.count({ where: { artigoId: artigos[3] } });
    const r = await emMassa({ tipoProduto: 'funil', clienteId, simular: false });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().data.aplicados, 3);
    for (const id of artigos.slice(0, 3)) {
      const ops = await prisma.operacaoArtigo.findMany({ where: { artigoId: id }, orderBy: { ordem: 'asc' } });
      assert.equal(ops.length, N_OPS);
      assert.deepEqual(ops.map((o) => o.codigoOp), ops.map((_, i) => String((i + 1) * 10)));
    }
    assert.equal(await prisma.operacaoArtigo.count({ where: { artigoId: artigos[3] } }), antes);
    assert.equal(await prisma.operacaoArtigo.count({ where: { artigoId: artigos[4] } }), 0, 'arquivado fica de fora');
  });

  test('de novo: nada a fazer', async () => {
    const r = await emMassa({ tipoProduto: 'funil', clienteId, simular: false });
    assert.equal(r.json().data.total, 0);
  });

  test('quem não tem o módulo Artigos não aplica (nem em massa, nem num artigo)', async () => {
    assert.equal((await emMassa({ tipoProduto: 'funil', clienteId, simular: true }, tokenOperador)).statusCode, 403);
    const r = await app.inject({ method: 'POST', url: `/api/artigos/${artigos[0]}/operacoes/aplicar-roteiro`, headers: { authorization: `Bearer ${tokenOperador}` }, payload: { roteiroId: ROTEIRO, substituir: true } });
    assert.equal(r.statusCode, 403);
  });

  test('sem-roteiro devolve a contagem por tipo', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/roteiros-padrao/sem-roteiro', headers: { authorization: `Bearer ${token}` } });
    assert.equal(r.statusCode, 200);
    const funil = r.json().data.find((x: any) => x.tipoProduto === 'funil');
    assert.ok(funil && funil.total >= 4 && funil.semRoteiro <= funil.total);
  });

  test('tipo inválido é recusado', async () => {
    assert.equal((await emMassa({ tipoProduto: 'xpto', simular: true })).statusCode, 400);
  });
});
