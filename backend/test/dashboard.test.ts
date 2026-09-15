import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, closeTestApp, ensurePessoa, ensureCliente, ensureArtigoAtivoComOperacoes } from './helpers.js';
import { dashboardRoutes } from '../src/routes/dashboard.js';
import { prisma } from '../src/db/prisma.js';

let app: FastifyInstance;
let token: string;
let osId: string;
let clienteId: string;
let artigoId: string;
let autorId: string;
let metalId: string;
let opExterna: string;
let opFutura: string;
const sufixo = `DASH-${Date.now()}`;
before(async () => {
  app = await buildTestApp();
  await app.register(dashboardRoutes, { prefix: '/api' });
  const pessoa = await ensurePessoa({ codigoPessoal: sufixo, pin: '8899', papel: 'admin' });
  autorId = pessoa.id;
  token = app.jwt.sign({ pessoaId: autorId, papel: 'chefe' });
  clienteId = (await ensureCliente(sufixo)).id;
  metalId = (await prisma.etapa.findFirstOrThrow({ where: { nome: 'Metalização' } })).id;
  artigoId = (await ensureArtigoAtivoComOperacoes({ codigo: sufixo, clienteId, criadoPorId: autorId, etapaId: metalId })).id;
  const operacoes = await prisma.operacaoArtigo.findMany({ where: { artigoId }, orderBy: { ordem: 'asc' } });
  const os = await prisma.oS.create({ data: {
    codigoGrv: sufixo, clienteId, artigoId, criadoPorId: autorId, quantidadeTotal: 10,
    prazoEntrega: new Date('2020-01-01'), status: 'em_producao',
    lotes: { create: [1, 2].map(numeroLote => ({ numeroLote, quantidadePecas: 5, status: 'em_processo',
      opsLote: { create: operacoes.map((o, i) => ({
        operacaoArtigoId: o.id, etapaId: o.etapaId, codigoOp: o.codigoOp, tipoServico: o.tipoServico,
        ordem: i, tempoUnitPlanejado: 10, tempoTotalPlanejado: 50,
        status: i === 0 ? 'bloqueada' : 'na_fila',
        ...(i === 0 ? { envioExternoEm: new Date(), quantidadeEnvioExterno: 5, fornecedor: 'Fornecedor demonstração' } : {}),
      })) },
    })) },
  }, include: { lotes: { include: { opsLote: { orderBy: { ordem: 'asc' } } } } } });
  osId = os.id; opExterna = os.lotes[0].opsLote[0].id; opFutura = os.lotes[0].opsLote[1].id;
});
after(async () => {
  if (osId) {
    await prisma.oPLote.deleteMany({ where: { lote: { osId } } });
    await prisma.lote.deleteMany({ where: { osId } });
    await prisma.oS.delete({ where: { id: osId } });
  }
  if (artigoId) { await prisma.operacaoArtigo.deleteMany({ where: { artigoId } }); await prisma.artigo.delete({ where: { id: artigoId } }); }
  if (clienteId) await prisma.cliente.delete({ where: { id: clienteId } });
  if (autorId) await prisma.pessoa.delete({ where: { id: autorId } });
  if (app) await closeTestApp(app);
});
const painel = (extra = '') => app.inject({ method: 'GET', url: `/api/dashboard?clienteId=${clienteId}${extra}`, headers: { authorization: `Bearer ${token}` } });

test('chefe vê os dois lotes externos como uma OS; operações futuras não viram fila ou gargalo', async () => {
  const r = await painel(); assert.equal(r.statusCode, 200, r.body);
  const d = r.json().data;
  assert.equal(d.totalOSExternas, 1);
  assert.equal(d.enviosExternos.length, 2);
  assert.equal(d.enviosExternos[0].fornecedor, 'Fornecedor demonstração');
  assert.equal(d.osPorStatus.atrasada, 1); // status gravado é em_producao.
  const cards = d.kanban.flatMap((e: any) => e.cards);
  assert.equal(cards.length, 2);
  assert.ok(cards.find((c: any) => c.opLoteId === opExterna && c.externo));
  assert.ok(!cards.some((c: any) => c.opLoteId === opFutura));
  assert.equal(d.gargalos.find((e: any) => e.etapaId === metalId).horasPlanejadas, 0);
  assert.equal(d.indicadores.carteira.atrasadas, 1);
});
test('tipo de peça filtra contadores, externos, histórico e kanban', async () => {
  const r = await painel('&tipoProduto=bloco&dias=30'); assert.equal(r.statusCode, 200, r.body);
  const d = r.json().data;
  assert.equal(d.totalOSExternas, 0);
  assert.equal(d.indicadores.carteira.total, 0);
  assert.equal(d.indicadores.historico.dias, 30);
  assert.ok(d.kanban.every((e: any) => e.cards.length === 0));
});
test('recebida sai do quadro externo e libera a próxima operação no kanban', async () => {
  await prisma.oPLote.update({ where: { id: opExterna }, data: { status: 'concluida', quantidadeConcluida: 5, recebimentoExternoEm: new Date() } });
  const d = (await painel()).json().data;
  assert.equal(d.totalOSExternas, 1); // Ainda há outro lote desta OS fora.
  assert.equal(d.enviosExternos.length, 1);
  const cards = d.kanban.flatMap((e: any) => e.cards);
  assert.ok(cards.some((c: any) => c.opLoteId === opFutura && c.quantidade === 5));
  assert.ok(!cards.some((c: any) => c.opLoteId === opExterna));
  assert.equal(d.gargalos.find((e: any) => e.etapaId === metalId).horasPlanejadas, 0.8);
});
test('OS cancelada não conta como externa nem ocupa o kanban', async () => {
  await prisma.oS.update({ where: { id: osId }, data: { status: 'cancelada' } });
  const d = (await painel()).json().data;
  assert.equal(d.totalOSExternas, 0);
  assert.equal(d.indicadores.carteira.total, 0);
  assert.ok(d.kanban.every((e: any) => !e.cards.length));
});
test('API rejeita filtro inválido e exige login', async () => {
  assert.equal((await painel('&dias=-1')).statusCode, 400);
  assert.equal((await app.inject({ method: 'GET', url: '/api/dashboard' })).statusCode, 401);
});
