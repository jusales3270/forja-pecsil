// ============================================================
// Forja - Testes de Operações do Artigo
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  closeTestApp,
  ensurePessoa,
  ensureCliente,
  ensureArtigo,
  loginAsAdmin,
} from './helpers.js';
import { prisma } from '../src/db/prisma.js';

// Helpers locais: reutilizam etapa/tipo de serviço do seed
async function pegarPrimeiraEtapa(): Promise<{ id: string }> {
  const e = await prisma.etapa.findFirst({
    where: { ativa: true },
    orderBy: { ordemPadrao: 'asc' },
  });
  if (!e) throw new Error('Seed não tem nenhuma etapa ativa — rode o seed');
  return { id: e.id };
}

async function pegarPrimeiroTipoServico(): Promise<{ id: string } | null> {
  const ts = await prisma.tipoServico.findFirst({ where: { ativo: true } });
  return ts ? { id: ts.id } : null;
}

describe('Operações do Artigo — CRUD', () => {
  let app: FastifyInstance;
  let token: string;
  let artigoId: string;
  let segundoArtigoId: string;
  let etapaId: string;
  let tipoServicoId: string | null;
  const TEST_CODIGO = '9991';
  const TEST_PIN = '1234';
  const TEST_CLIENTE = '__TEST_CLIENTE_OPS';
  const TEST_ARTIGO_1 = '__TEST_ART_OPS_001';
  const TEST_ARTIGO_2 = '__TEST_ART_OPS_002';

  before(async () => {
    app = await buildTestApp();
    const pessoa = await ensurePessoa({
      codigoPessoal: TEST_CODIGO,
      pin: TEST_PIN,
      nome: 'Usuário Ops Test',
    });
    const cliente = await ensureCliente(TEST_CLIENTE);
    const a1 = await ensureArtigo({
      codigo: TEST_ARTIGO_1,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    const a2 = await ensureArtigo({
      codigo: TEST_ARTIGO_2,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    artigoId = a1.id;
    segundoArtigoId = a2.id;

    const etapa = await pegarPrimeiraEtapa();
    etapaId = etapa.id;
    const ts = await pegarPrimeiroTipoServico();
    tipoServicoId = ts?.id ?? null;

    token = await loginAsAdmin(app, TEST_CODIGO, TEST_PIN);
  });

  after(async () => {
    await prisma.operacaoArtigo.deleteMany({
      where: { artigoId: { in: [artigoId, segundoArtigoId] } },
    });
    await prisma.artigo.deleteMany({
      where: { id: { in: [artigoId, segundoArtigoId] } },
    });
    await prisma.cliente.deleteMany({ where: { nome: TEST_CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('cria operação com dados válidos retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        ...(tipoServicoId ? { tipoServicoId } : {}),
        codigoOp: '10',
        ordem: 10,
        tipoServico: 'TESTE DE CRIAÇÃO',
        tempoUnitMin: 60,
        tempoSetupMin: 15,
        exigeInspecao: false,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.codigoOp, '10');
    assert.equal(body.data.artigoId, artigoId);
    assert.equal(body.data.tempoUnitMin, 60);
    assert.ok(body.data.etapa?.id, 'deve retornar etapa via include');
  });

  test('bloqueia duplicidade de codigoOp no mesmo artigo retorna 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        codigoOp: '10',
        ordem: 11,
        tipoServico: 'OUTRA COISA',
        tempoUnitMin: 30,
      },
    });

    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'duplicate_codigo_op');
  });

  test('permite mesmo codigoOp em artigo diferente retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${segundoArtigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        codigoOp: '10',
        ordem: 10,
        tipoServico: 'TESTE OUTRO ARTIGO',
        tempoUnitMin: 90,
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.json().data.codigoOp, '10');
    assert.equal(res.json().data.artigoId, segundoArtigoId);
  });

  test('etapa inexistente retorna 404 etapa_nao_encontrada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId: '00000000-0000-0000-0000-000000000000',
        codigoOp: '99',
        ordem: 99,
        tipoServico: 'X',
        tempoUnitMin: 10,
      },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'etapa_nao_encontrada');
  });

  test('lista operações ordenadas por ordem', async () => {
    // Cria mais duas pra ter o que ordenar
    await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        codigoOp: '20',
        ordem: 20,
        tipoServico: 'SEGUNDA OP',
        tempoUnitMin: 30,
      },
    });
    await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        codigoOp: '30',
        ordem: 30,
        tipoServico: 'TERCEIRA OP',
        tempoUnitMin: 30,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const ordens = res.json().data.map((o: any) => o.ordem);
    assert.deepEqual(ordens, [...ordens].sort((a, b) => a - b));
    assert.ok(ordens.length >= 3);
  });

  test('atualiza tempoUnitMin via PATCH retorna 200', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
    });
    const id = list.json().data[0].id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/artigos/${artigoId}/operacoes/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { tempoUnitMin: 999 },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.tempoUnitMin, 999);
  });

  test('reordenar troca as ordens corretamente', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
    });
    const ops = list.json().data;
    assert.ok(ops.length >= 3, 'precisa ter pelo menos 3 ops pro teste');

    const novasOrdens = [
      { id: ops[0].id, ordem: 300 },
      { id: ops[1].id, ordem: 200 },
      { id: ops[2].id, ordem: 100 },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/reordenar`,
      headers: { authorization: `Bearer ${token}` },
      payload: { ordens: novasOrdens },
    });

    assert.equal(res.statusCode, 200);
    const retornadas = res.json().data.slice(0, 3);
    assert.equal(retornadas[0].id, ops[2].id);
    assert.equal(retornadas[0].ordem, 100);
    assert.equal(retornadas[2].id, ops[0].id);
    assert.equal(retornadas[2].ordem, 300);
  });

  test('deleta operação retorna 204 e some na consulta', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        etapaId,
        codigoOp: '999',
        ordem: 9999,
        tipoServico: 'PARA DELETAR',
        tempoUnitMin: 1,
      },
    });
    const id = create.json().data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/artigos/${artigoId}/operacoes/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(get.statusCode, 404);
  });
});
