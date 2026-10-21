// ============================================================
// Forja - Desenhos para a Biblioteca da Fundição (integração com o Business OS)
// Cobre: só a conta de integração lê; só desenho com arquivo entra; selo da
// Fundição (prevista no roteiro e realizada pelo carimbo, com as OS); o
// arquivo sai pelo stream com a chave atual.
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp, ensurePessoa, ensureCliente, ensureArtigo, loginAs } from './helpers.js';
import { prisma } from '../src/db/prisma.js';
import { ehEtapaFundicao, normalizarNome } from '../src/lib/desenhos-integracao.js';
import { removerArquivo, uploadArquivo } from '../src/lib/storage.js';

const SUFIXO = `${Date.now()}`.slice(-6);
const CLIENTE = `__TEST_CLIENTE_BIBLIOTECA_${SUFIXO}`;
const PDF = Buffer.from(`%PDF-1.4\n% desenho de teste ${SUFIXO}\n%%EOF\n`);

describe('Integração — desenhos da Biblioteca da Fundição', () => {
  let app: FastifyInstance;
  let tokenIntegracao: string;
  let tokenComum: string;
  let artigoFundido: string;
  let artigoPrevisto: string;
  let artigoSemFundicao: string;
  let desenhoFundido: string;
  let desenhoSemArquivo: string;
  let desenhoSemFundicao: string;
  let arquivo: { bucket: string; key: string };
  let osId: string;
  let loteId: string;
  let opLoteId: string;
  const pessoas = [`TEST-INTEG-BIB-${SUFIXO}`, `TEST-OPER-BIB-${SUFIXO}`];

  before(async () => {
    app = await buildTestApp();
    const integ = await ensurePessoa({ codigoPessoal: pessoas[0], pin: '1234', nome: 'Integração Biblioteca', papel: 'chefe' });
    await prisma.pessoa.update({ where: { id: integ.id }, data: { integracao: true } });
    tokenIntegracao = await loginAs(app, pessoas[0], '1234');
    await ensurePessoa({ codigoPessoal: pessoas[1], pin: '1234', nome: 'Operador Biblioteca', papel: 'admin' });
    tokenComum = await loginAs(app, pessoas[1], '1234');

    const etapas = await prisma.etapa.findMany();
    const fundicao = etapas.find((e) => ehEtapaFundicao(e.nome));
    const outra = etapas.find((e) => !ehEtapaFundicao(e.nome));
    if (!fundicao || !outra) throw new Error('Seed não rodou (falta a etapa Fundição). Execute pnpm db:seed.');
    const clienteId = (await ensureCliente(CLIENTE)).id;

    artigoFundido = (await ensureArtigo({ codigo: `__BIB-FUND-${SUFIXO}`, clienteId, criadoPorId: integ.id, descricao: 'FORMA BIBLIOTECA FUNDIDA' })).id;
    artigoPrevisto = (await ensureArtigo({ codigo: `__BIB-PREV-${SUFIXO}`, clienteId, criadoPorId: integ.id })).id;
    artigoSemFundicao = (await ensureArtigo({ codigo: `__BIB-USIN-${SUFIXO}`, clienteId, criadoPorId: integ.id })).id;

    const op = (artigoId: string, etapaId: string) => prisma.operacaoArtigo.create({ data: { artigoId, etapaId, codigoOp: '10', ordem: 0, tipoServico: 'Teste', tempoUnitMin: 1 } });
    const opFund = await op(artigoFundido, fundicao.id);
    await op(artigoPrevisto, fundicao.id);
    await op(artigoSemFundicao, outra.id);

    // Um lote do artigo fundido entrou na Fundição.
    osId = (await prisma.oS.create({ data: { codigoGrv: `__BIB-OS-${SUFIXO}`, clienteId, artigoId: artigoFundido, quantidadeTotal: 1, prazoEntrega: new Date(Date.now() + 86400000), criadoPorId: integ.id } })).id;
    loteId = (await prisma.lote.create({ data: { osId, numeroLote: 1, quantidadePecas: 1 } })).id;
    opLoteId = (await prisma.oPLote.create({ data: { loteId, operacaoArtigoId: opFund.id, etapaId: fundicao.id, ordem: 0, tempoUnitPlanejado: 1, tempoTotalPlanejado: 1, codigoOp: '10', tipoServico: 'Teste' } })).id;
    await prisma.carimbo.create({ data: { opLoteId, loteId, etapaId: fundicao.id, timestampEntrada: new Date('2026-10-01T10:00:00Z') } });

    arquivo = await uploadArquivo({ bucket: 'desenhos', buffer: PDF, contentType: 'application/pdf', filenameOriginal: 'forma.pdf' });
    const comArquivo = { arquivoBucket: arquivo.bucket, arquivoKey: arquivo.key, arquivoTipo: 'application/pdf', arquivoTamanho: PDF.length, arquivoNomeOriginal: 'forma.pdf' };
    desenhoFundido = (await prisma.desenho.create({ data: { artigoId: artigoFundido, tipo: 'forma', codigoDesenho: `DES-${SUFIXO}`, revisao: 'B', ...comArquivo } })).id;
    desenhoSemArquivo = (await prisma.desenho.create({ data: { artigoId: artigoPrevisto, tipo: 'cliente', codigoDesenho: `DES-P-${SUFIXO}`, revisao: 'A' } })).id;
    desenhoSemFundicao = (await prisma.desenho.create({ data: { artigoId: artigoSemFundicao, tipo: 'cliente', codigoDesenho: `DES-U-${SUFIXO}`, revisao: 'A', ...comArquivo } })).id;
  });

  after(async () => {
    await prisma.carimbo.deleteMany({ where: { opLoteId } });
    await prisma.oPLote.deleteMany({ where: { id: opLoteId } });
    await prisma.lote.deleteMany({ where: { id: loteId } });
    await prisma.oS.deleteMany({ where: { id: osId } });
    const artigos = [artigoFundido, artigoPrevisto, artigoSemFundicao];
    await prisma.operacaoArtigo.deleteMany({ where: { artigoId: { in: artigos } } });
    await prisma.desenho.deleteMany({ where: { artigoId: { in: artigos } } });
    await prisma.artigo.deleteMany({ where: { id: { in: artigos } } });
    await prisma.cliente.deleteMany({ where: { nome: CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: { in: pessoas } } });
    if (arquivo) await removerArquivo(arquivo.bucket, arquivo.key).catch(() => undefined);
    await closeTestApp(app);
  });

  test('nome da etapa: acento, caixa e espaço não importam', () => {
    assert.equal(normalizarNome(' Fundição '), 'fundicao');
    assert.ok(ehEtapaFundicao('FUNDICAO'));
    assert.ok(!ehEtapaFundicao('Fundição externa'));
  });

  test('conta comum (mesmo admin) recebe 403', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/integracao/desenhos', headers: { authorization: `Bearer ${tokenComum}` } });
    assert.equal(r.statusCode, 403);
    const a = await app.inject({ method: 'GET', url: `/api/integracao/desenhos/${desenhoFundido}/arquivo`, headers: { authorization: `Bearer ${tokenComum}` } });
    assert.equal(a.statusCode, 403);
  });

  test('lista todos os desenhos com arquivo, com o selo da Fundição', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/integracao/desenhos', headers: { authorization: `Bearer ${tokenIntegracao}` } });
    assert.equal(r.statusCode, 200);
    const lista = r.json().data as any[];
    const ids = new Set(lista.map((d) => d.id));
    assert.ok(ids.has(desenhoFundido));
    assert.ok(ids.has(desenhoSemFundicao), 'entra mesmo sem Fundição no roteiro (decisão do proprietário)');
    assert.ok(!ids.has(desenhoSemArquivo), 'sem arquivo não entra');

    const f = lista.find((d) => d.id === desenhoFundido);
    assert.equal(f.arquivoKey, arquivo.key);
    assert.equal(f.artigo.codigo, `__BIB-FUND-${SUFIXO}`);
    assert.equal(f.cliente.nome, CLIENTE);
    assert.equal(f.fundicao.prevista, true);
    assert.equal(new Date(f.fundicao.primeiraEm).toISOString(), '2026-10-01T10:00:00.000Z');
    assert.deepEqual(f.fundicao.os, [`__BIB-OS-${SUFIXO}`]);

    const u = lista.find((d) => d.id === desenhoSemFundicao);
    assert.deepEqual(u.fundicao, { prevista: false, primeiraEm: null, ultimaEm: null, os: [] });
  });

  test('o arquivo sai pelo stream, com a chave atual', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/integracao/desenhos/${desenhoFundido}/arquivo`, headers: { authorization: `Bearer ${tokenIntegracao}` } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['content-type'], 'application/pdf');
    assert.equal(r.headers['x-arquivo-key'], arquivo.key);
    assert.deepEqual(r.rawPayload, PDF);
    const sem = await app.inject({ method: 'GET', url: `/api/integracao/desenhos/${desenhoSemArquivo}/arquivo`, headers: { authorization: `Bearer ${tokenIntegracao}` } });
    assert.equal(sem.statusCode, 404);
  });
});
