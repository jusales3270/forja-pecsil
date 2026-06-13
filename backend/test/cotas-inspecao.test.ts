// ============================================================
// Forja - Testes de Cotas de Inspeção
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

async function pegarPrimeiraEtapa(): Promise<{ id: string }> {
  const e = await prisma.etapa.findFirst({
    where: { ativa: true },
    orderBy: { ordemPadrao: 'asc' },
  });
  if (!e) throw new Error('Seed sem etapa ativa');
  return { id: e.id };
}

describe('Cotas de Inspeção — CRUD', () => {
  let app: FastifyInstance;
  let token: string;
  let artigoId: string;
  let opId: string;
  let opSegundaId: string;
  const TEST_CODIGO = '9993';
  const TEST_PIN = '1234';
  const TEST_CLIENTE = '__TEST_CLIENTE_COTAS';
  const TEST_ARTIGO = '__TEST_ART_COTAS_001';

  before(async () => {
    app = await buildTestApp();
    const pessoa = await ensurePessoa({
      codigoPessoal: TEST_CODIGO,
      pin: TEST_PIN,
      nome: 'Usuário Cotas Test',
    });
    const cliente = await ensureCliente(TEST_CLIENTE);
    const artigo = await ensureArtigo({
      codigo: TEST_ARTIGO,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    artigoId = artigo.id;
    const { id: etapaId } = await pegarPrimeiraEtapa();

    // Operação 1 + plano
    const op1 = await prisma.operacaoArtigo.create({
      data: {
        artigoId,
        etapaId,
        codigoOp: 'COT-10',
        ordem: 10,
        tipoServico: 'OP PRINCIPAL DAS COTAS',
        tempoUnitMin: 60,
      },
    });
    opId = op1.id;
    await prisma.planoInspecao.create({
      data: { operacaoArtigoId: op1.id },
    });

    // Operação 2 + plano (pra testar isolamento entre planos)
    const op2 = await prisma.operacaoArtigo.create({
      data: {
        artigoId,
        etapaId,
        codigoOp: 'COT-20',
        ordem: 20,
        tipoServico: 'OP SECUNDÁRIA',
        tempoUnitMin: 30,
      },
    });
    opSegundaId = op2.id;
    await prisma.planoInspecao.create({
      data: { operacaoArtigoId: op2.id },
    });

    token = await loginAsAdmin(app, TEST_CODIGO, TEST_PIN);
  });

  after(async () => {
    // Ordem: cotas → planos → operações → artigo → cliente → pessoa
    const planos = await prisma.planoInspecao.findMany({
      where: { operacaoArtigoId: { in: [opId, opSegundaId] } },
      select: { id: true },
    });
    const planoIds = planos.map((p) => p.id);
    await prisma.cotaInspecao.deleteMany({
      where: { planoInspecaoId: { in: planoIds } },
    });
    await prisma.planoInspecao.deleteMany({
      where: { id: { in: planoIds } },
    });
    await prisma.operacaoArtigo.deleteMany({
      where: { id: { in: [opId, opSegundaId] } },
    });
    await prisma.artigo.deleteMany({ where: { id: artigoId } });
    await prisma.cliente.deleteMany({ where: { nome: TEST_CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('lista cotas vazia retorna 200 com array vazio', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, []);
  });

  test('cria cota válida retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'A',
        valorNominal: 130.0,
        toleranciaMais: 0.05,
        toleranciaMenos: 0.05,
        caracteristica: 'critica',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'primeira',
        instrumento: 'paq_digital',
        ordem: 10,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.codigoCota, 'A');
    assert.equal(body.data.valorNominal, 130);
    assert.equal(body.data.toleranciaMais, 0.05);
    assert.equal(body.data.caracteristica, 'critica');
    assert.equal(body.data.instrumento, 'paq_digital');
  });

  test('bloqueia duplicidade de codigoCota no mesmo plano retorna 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'A',
        valorNominal: 50,
        caracteristica: 'funcional',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'todas',
        instrumento: 'micrometro',
        ordem: 99,
      },
    });

    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'duplicate_codigo_cota');
  });

  test('permite mesma codigoCota em plano diferente retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opSegundaId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'A',
        valorNominal: 50,
        caracteristica: 'funcional',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'todas',
        instrumento: 'micrometro',
        ordem: 10,
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.json().data.codigoCota, 'A');
  });

  test('valida tolerância 0/0 quando ambas vêm retorna 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'Z',
        valorNominal: 50,
        toleranciaMais: 0,
        toleranciaMenos: 0,
        caracteristica: 'processo',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'todas',
        instrumento: 'visual',
        ordem: 99,
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'validation_error');
  });

  test('cria cota sem tolerâncias retorna 201 com nulls', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'P',
        valorNominal: 75.5,
        caracteristica: 'funcional',
        frequenciaMonitorar: 'primeira',
        frequenciaRegistrar: 'primeira',
        instrumento: 'comparador',
        ordem: 20,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.toleranciaMais, null);
    assert.equal(body.data.toleranciaMenos, null);
  });

  test('PATCH altera tolerância retorna 200', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
    });
    const cotaA = list.json().data.find((c: any) => c.codigoCota === 'A');
    assert.ok(cotaA, 'cota A deve existir');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas/${cotaA.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { toleranciaMais: 0.1, toleranciaMenos: 0.02 },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.toleranciaMais, 0.1);
    assert.equal(res.json().data.toleranciaMenos, 0.02);
  });

  test('reordenar troca as ordens corretamente', async () => {
    // Garante 3 cotas no plano principal
    await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'C',
        valorNominal: 30,
        caracteristica: 'processo',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'todas',
        instrumento: 'visual',
        ordem: 30,
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
    });
    const cotas = list.json().data;
    assert.ok(cotas.length >= 3);

    const novasOrdens = [
      { id: cotas[0].id, ordem: 300 },
      { id: cotas[1].id, ordem: 200 },
      { id: cotas[2].id, ordem: 100 },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas/reordenar`,
      headers: { authorization: `Bearer ${token}` },
      payload: { ordens: novasOrdens },
    });

    assert.equal(res.statusCode, 200);
    const retornadas = res.json().data.slice(0, 3);
    assert.equal(retornadas[0].id, cotas[2].id);
    assert.equal(retornadas[0].ordem, 100);
    assert.equal(retornadas[2].id, cotas[0].id);
    assert.equal(retornadas[2].ordem, 300);
  });

  test('DELETE cota sem medições retorna 204', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigoCota: 'DEL',
        valorNominal: 1,
        caracteristica: 'processo',
        frequenciaMonitorar: 'todas',
        frequenciaRegistrar: 'todas',
        instrumento: 'visual',
        ordem: 999,
      },
    });
    const id = create.json().data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/artigos/${artigoId}/operacoes/${opId}/plano/cotas/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(del.statusCode, 204);
  });
});
