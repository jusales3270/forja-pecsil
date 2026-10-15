// ============================================================
// Forja - Rascunho de OS vindo do orçamento (Business OS) e lista de materiais
// Cobre: integração cria rascunho (idempotente, sem lote/OP), fica fora do
// Tótem e do Painel, liberação (pendências, número, lotes, OPs, materiais),
// cancelamento, catálogo de materiais e permissões.
// ============================================================

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp, ensurePessoa, ensureCliente, loginAs } from './helpers.js';
import { dashboardRoutes } from '../src/routes/dashboard.js';
import { prisma } from '../src/db/prisma.js';

let app: FastifyInstance;
let tokenIntegracao: string;
let tokenPcp: string;
let tokenAdmin: string;
let tokenOperador: string;
let pcpId: string;
let clienteId: string;
let etapaId: string;
const SUFIXO = `${Date.now()}`.slice(-6);
const COD_ARTIGO = `TEST-RASC-${SUFIXO}`;
const COD_ARTIGO_NOVO = `TEST-RASC-NOVO-${SUFIXO}`;
const MATERIAIS = [`T9-01-${SUFIXO}`, `T9-02-${SUFIXO}`];
const osIds = new Set<string>();
const artigoIds = new Set<string>();

const amanhaMais = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString();
const rascunho = (ref: string, extra: Record<string, unknown> = {}) => ({
  refExterna: ref,
  codigoProvisorio: `ORC-T${SUFIXO}/${ref.slice(-4)}`,
  cliente: { nome: 'Cliente Teste Rascunho' },
  artigo: { codigo: COD_ARTIGO, descricao: 'FORMA TESTE RASCUNHO', tipoProduto: 'forma' },
  quantidadeTotal: 10,
  prazoEntrega: amanhaMais(20),
  precoUnitario: 1500,
  valorTotal: 15000,
  poCliente: '4502399999',
  pedidoClienteItem: 'Pedido 4502399999 · item 010',
  desenhoInformado: 'DES-1 rev. B',
  ...extra,
});
const post = (url: string, token: string, payload?: unknown) => app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` }, payload: payload as any });

before(async () => {
  app = await buildTestApp();
  await app.register(dashboardRoutes, { prefix: '/api' });

  const integ = await ensurePessoa({ codigoPessoal: 'TEST-INTEG-RASC', pin: '1234', nome: 'Integração Teste', papel: 'chefe' });
  await prisma.pessoa.update({ where: { id: integ.id }, data: { integracao: true } });
  tokenIntegracao = await loginAs(app, 'TEST-INTEG-RASC', '1234');
  pcpId = (await ensurePessoa({ codigoPessoal: 'TEST-PCP-RASC', pin: '1234', nome: 'PCP Rascunho', papel: 'pcp' })).id;
  tokenPcp = await loginAs(app, 'TEST-PCP-RASC', '1234');
  await ensurePessoa({ codigoPessoal: 'TEST-ADM-RASC', pin: '1234', nome: 'Admin Rascunho', papel: 'admin' });
  tokenAdmin = await loginAs(app, 'TEST-ADM-RASC', '1234');
  await ensurePessoa({ codigoPessoal: 'TEST-OPER-RASC', pin: '1234', nome: 'Operador Rascunho', papel: 'operador' });
  tokenOperador = await loginAs(app, 'TEST-OPER-RASC', '1234');

  clienteId = (await ensureCliente('Cliente Teste Rascunho')).id;
  const etapa = await prisma.etapa.findFirst({ orderBy: { ordemPadrao: 'asc' } });
  if (!etapa) throw new Error('Seed não rodou. Execute pnpm db:seed antes dos testes.');
  etapaId = etapa.id;
  // Artigo existente do cliente, sem roteiro (como os importados do GRV)
  const a = await prisma.artigo.create({ data: { codigo: COD_ARTIGO, descricao: 'FORMA TESTE RASCUNHO', tipoProduto: 'forma', clienteId, status: 'ativo', criadoPorId: pcpId } });
  artigoIds.add(a.id);
});

after(async () => {
  for (const id of osIds) await app.inject({ method: 'DELETE', url: `/api/os/${id}?force=1`, headers: { authorization: `Bearer ${tokenAdmin}` } });
  await prisma.materialArtigo.deleteMany({ where: { artigoId: { in: [...artigoIds] } } });
  await prisma.operacaoArtigo.deleteMany({ where: { artigoId: { in: [...artigoIds] } } });
  await prisma.desenho.deleteMany({ where: { artigoId: { in: [...artigoIds] } } });
  await prisma.artigo.deleteMany({ where: { id: { in: [...artigoIds] } } });
  await prisma.materialCatalogo.deleteMany({ where: { codigo: { in: MATERIAIS } } });
  await closeTestApp(app);
});

describe('integração: rascunho do orçamento ganho', () => {
  let osId: string;

  test('só a conta de integração cria rascunho', async () => {
    const r = await post('/api/integracao/os-rascunho', tokenPcp, rascunho('item-sem-permissao'));
    assert.equal(r.statusCode, 403);
  });

  test('cria o rascunho sem lote nem OP, e reenviar devolve o mesmo', async () => {
    const r = await post('/api/integracao/os-rascunho', tokenIntegracao, rascunho('item-0001'));
    assert.equal(r.statusCode, 201, r.body);
    const d = r.json().data;
    osId = d.id;
    osIds.add(osId);
    assert.equal(d.status, 'rascunho');
    assert.equal(d.criado, true);
    assert.match(d.codigoGrv, /^ORC-/);
    const os = await prisma.oS.findUnique({ where: { id: osId }, include: { lotes: true } });
    assert.equal(os?.origem, 'business_os');
    assert.equal(os?.lotes.length, 0);
    assert.equal(os?.pedidoClienteItem, 'Pedido 4502399999 · item 010');
    const de_novo = await post('/api/integracao/os-rascunho', tokenIntegracao, rascunho('item-0001'));
    assert.equal(de_novo.statusCode, 200);
    assert.equal(de_novo.json().data.id, osId);
    assert.equal(de_novo.json().data.criado, false);
  });

  test('rascunho fica fora do Painel de Produção', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { authorization: `Bearer ${tokenAdmin}` } });
    assert.equal(r.statusCode, 200, r.body);
    const body = JSON.stringify(r.json());
    assert.ok(!body.includes(osId), 'o rascunho não pode aparecer no painel');
  });

  test('produto sem artigo na Forja: precisa de tipo válido; com tipo, nasce o artigo em rascunho', async () => {
    const semTipo = await post('/api/integracao/os-rascunho', tokenIntegracao, rascunho('item-0002', { artigo: { codigo: COD_ARTIGO_NOVO, descricao: 'PEÇA NOVA', tipoProduto: 'outro' } }));
    assert.equal(semTipo.statusCode, 400);
    assert.equal(semTipo.json().error, 'tipo_produto_invalido');
    const ok = await post('/api/integracao/os-rascunho', tokenIntegracao, rascunho('item-0002', { artigo: { codigo: COD_ARTIGO_NOVO, descricao: 'PEÇA NOVA', tipoProduto: 'funil' } }));
    assert.equal(ok.statusCode, 201, ok.body);
    osIds.add(ok.json().data.id);
    const art = await prisma.artigo.findUnique({ where: { id: ok.json().data.artigoId } });
    artigoIds.add(art!.id);
    assert.equal(art?.status, 'rascunho');
    assert.equal(art?.tipoProduto, 'funil');
  });

  test('conta de estação/operador não abre OS direto (módulo no backend)', async () => {
    const r = await post('/api/os', tokenOperador, { codigoGrv: `X-${SUFIXO}`, clienteId, artigoId: [...artigoIds][0], quantidadeTotal: 1, prazoEntrega: amanhaMais(5) });
    assert.equal(r.statusCode, 403);
  });

  test('catálogo de materiais: recebe da integração e busca sem acento e pelo código', async () => {
    const r = await app.inject({
      method: 'PUT', url: '/api/integracao/materiais', headers: { authorization: `Bearer ${tokenIntegracao}` },
      payload: { itens: [
        { codigo: MATERIAIS[0], descricao: 'MÁSCARA PFF2 C/ VÁLVULA TESTE', unidade: 'PÇ', familia: 'uso_consumo', grupo: 'EPI' },
        { codigo: MATERIAIS[1], descricao: 'PARAFUSO SEXT. M12 TESTE', unidade: 'PÇ', familia: 'materia_prima', grupo: 'FIXADORES' },
      ] },
    });
    assert.equal(r.statusCode, 200, r.body);
    const porNome = await app.inject({ method: 'GET', url: '/api/materiais-catalogo?busca=mascara%20valvula%20teste', headers: { authorization: `Bearer ${tokenPcp}` } });
    assert.deepEqual(porNome.json().data.map((m: any) => m.codigo), [MATERIAIS[0]]);
    const porCodigo = await app.inject({ method: 'GET', url: `/api/materiais-catalogo?busca=${MATERIAIS[1].replace(/-/g, '')}`, headers: { authorization: `Bearer ${tokenPcp}` } });
    assert.equal(porCodigo.json().data[0]?.codigo, MATERIAIS[1]);
    const negado = await app.inject({ method: 'PUT', url: '/api/integracao/materiais', headers: { authorization: `Bearer ${tokenPcp}` }, payload: { itens: [] } });
    assert.equal(negado.statusCode, 403);
  });

  test('liberar: exige número da OS, roteiro e confirma o que falta', async () => {
    const provisorio = await post(`/api/os/${osId}/liberar`, tokenPcp, { codigoGrv: 'ORC-XYZ' });
    assert.equal(provisorio.json().error, 'codigo_provisorio');
    const semRoteiro = await post(`/api/os/${osId}/liberar`, tokenPcp, { codigoGrv: `1-${SUFIXO}/001` });
    assert.equal(semRoteiro.json().error, 'artigo_sem_operacoes');

    const artigoId = (await prisma.oS.findUnique({ where: { id: osId } }))!.artigoId;
    await prisma.operacaoArtigo.create({ data: { artigoId, etapaId, codigoOp: '10', ordem: 0, tipoServico: 'Teste', tempoUnitMin: 3 } });
    const pendente = await post(`/api/os/${osId}/liberar`, tokenPcp, { codigoGrv: `1-${SUFIXO}/001` });
    assert.equal(pendente.statusCode, 409);
    assert.equal(pendente.json().error, 'confirmar_pendencias');
    assert.deepEqual(pendente.json().details, { semDesenho: true, semMateriais: true });

    // Lista de materiais do artigo, pelo catálogo (por peça)
    const m1 = await post(`/api/artigos/${artigoId}/materiais`, tokenPcp, { materialCodigo: MATERIAIS[1], descricao: 'PARAFUSO SEXT. M12 TESTE', quantidade: 4, unidade: 'PÇ' });
    assert.equal(m1.statusCode, 201, m1.body);
    const fora = await post(`/api/artigos/${artigoId}/materiais`, tokenPcp, { materialCodigo: 'NAO-EXISTE', descricao: 'X', quantidade: 1, unidade: 'UN' });
    assert.equal(fora.json().error, 'material_fora_do_catalogo');
    const negado = await post(`/api/artigos/${artigoId}/materiais`, tokenOperador, { descricao: 'X', quantidade: 1, unidade: 'UN' });
    assert.equal(negado.statusCode, 403);
  });

  test('liberar gera lotes, OPs e a cópia dos materiais com o total; não libera duas vezes', async () => {
    const r = await post(`/api/os/${osId}/liberar`, tokenPcp, { codigoGrv: `1-${SUFIXO}/001`, semDesenho: true, divisao: { tipoDivisao: 'quantidade_lotes', quantidadeLotes: 2 } });
    assert.equal(r.statusCode, 200, r.body);
    const os = r.json().data;
    assert.equal(os.status, 'aberta');
    assert.equal(os.codigoGrv, `1-${SUFIXO}/001`);
    assert.equal(os.lotes.length, 2);
    assert.equal(os.lotes[0].opsLote.length, 1);
    assert.equal(os.materiais.length, 1);
    assert.equal(Number(os.materiais[0].quantidadeTotal), 40);
    assert.ok(os.liberadaEm);
    const eventos = await prisma.eventoOS.count({ where: { osId, tipo: 'os_liberada' } });
    assert.equal(eventos, 1);
    const de_novo = await post(`/api/os/${osId}/liberar`, tokenPcp, { codigoGrv: `1-${SUFIXO}/002`, semDesenho: true });
    assert.equal(de_novo.json().error, 'nao_e_rascunho');
  });

  test('cancelar: depois de liberada recusa; rascunho cancela', async () => {
    const liberada = await post('/api/integracao/os-rascunho/item-0001/cancelar', tokenIntegracao);
    assert.equal(liberada.statusCode, 409);
    assert.equal(liberada.json().error, 'os_liberada');
    const rasc = await post('/api/integracao/os-rascunho/item-0002/cancelar', tokenIntegracao);
    assert.equal(rasc.statusCode, 200, rasc.body);
    assert.equal(rasc.json().data.status, 'cancelada');
    const inexistente = await post('/api/integracao/os-rascunho/nao-existe/cancelar', tokenIntegracao);
    assert.equal(inexistente.json().data.cancelado, false);
    const sit = await app.inject({ method: 'GET', url: '/api/integracao/os-rascunho/item-0001', headers: { authorization: `Bearer ${tokenIntegracao}` } });
    assert.equal(sit.json().data.status, 'aberta');
    assert.equal(sit.json().data.materiais.length, 1);
  });
});

describe('integração: rascunho de TREINO', () => {
  test('treino vira rascunho TREINO, não libera e some ao cancelar', async () => {
    const r = await post('/api/integracao/os-rascunho', tokenIntegracao, rascunho('item-treino-1', { treino: true, codigoProvisorio: `TREINO-T-${SUFIXO}/1` }));
    assert.equal(r.statusCode, 201, r.body);
    const d = r.json().data;
    osIds.add(d.id);
    assert.match(d.codigoGrv, /^TREINO-/);
    const os = await prisma.oS.findUnique({ where: { id: d.id } });
    assert.equal(os?.origem, 'business_os_treino');
    const lib = await post(`/api/os/${d.id}/liberar`, tokenPcp, { codigoGrv: `9-${SUFIXO}/001`, semDesenho: true, semMateriais: true });
    assert.equal(lib.statusCode, 409);
    assert.equal(lib.json().error, 'treino');
    const c = await post('/api/integracao/os-rascunho/item-treino-1/cancelar', tokenIntegracao);
    assert.equal(c.statusCode, 200, c.body);
    assert.equal(c.json().data.excluido, true);
    assert.equal(await prisma.oS.count({ where: { id: d.id } }), 0);
  });
});
