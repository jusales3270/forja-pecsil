// ============================================================
// Forja - Conferência de chegada no Desbaste
// ============================================================
// Lote de 5: Fundição → Desbaste → Metalização → Encaixe e Arredondamento.
// A Fundição entrega 5, o Desbaste confere quantas chegaram de fato.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  closeTestApp,
  ensurePessoa,
  ensureCliente,
  ensureMaquina,
  ensureArtigoAtivoComOperacoes,
  loginAs,
} from './helpers.js';
import { calcularFluxoDePecas } from '../src/lib/fluxo-pecas.js';
import { dashboardRoutes } from '../src/routes/dashboard.js';
import { prisma } from '../src/db/prisma.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenPcp: string;
let tokenProgramador: string;
let pcpId: string;
let fundicao: { id: string };
let desbaste: { id: string };
let metalizacao: { id: string };
let encaixe: { id: string };
let operadorFundicaoId: string;
let operadorDesbasteId: string;
let maquinaFundicaoId: string;
let maquinaDesbasteId: string;
let clienteId: string;
let artigoId: string;
const osCriadas: string[] = [];

before(async () => {
  app = await buildTestApp();
  await app.register(dashboardRoutes, { prefix: '/api' });
  const etapa = (nome: string) => prisma.etapa.findFirstOrThrow({ where: { nome }, select: { id: true } });
  fundicao = await etapa('Fundição');
  desbaste = await etapa('Desbaste');
  metalizacao = await etapa('Metalização');
  encaixe = await etapa('Encaixe e Arredondamento');

  const admin = await ensurePessoa({ codigoPessoal: 'TEST-CONF-ADMIN', pin: '7001', papel: 'admin' });
  tokenAdmin = await loginAs(app, 'TEST-CONF-ADMIN', '7001');
  pcpId = (await ensurePessoa({ codigoPessoal: 'TEST-CONF-PCP', pin: '7002', papel: 'pcp' })).id;
  tokenPcp = await loginAs(app, 'TEST-CONF-PCP', '7002');
  await ensurePessoa({ codigoPessoal: 'TEST-CONF-PROG', pin: '7003', papel: 'programador' });
  tokenProgramador = await loginAs(app, 'TEST-CONF-PROG', '7003');

  const vincular = async (codigo: string, etapaId: string) => {
    const p = await ensurePessoa({ codigoPessoal: codigo, pin: '7004', papel: 'operador' });
    await prisma.pessoa.update({ where: { id: p.id }, data: { etapaId } });
    return p.id;
  };
  operadorFundicaoId = await vincular('TEST-CONF-OPER-FUND', fundicao.id);
  operadorDesbasteId = await vincular('TEST-CONF-OPER-DESB', desbaste.id);
  maquinaFundicaoId = (await ensureMaquina({ codigoInterno: 'TEST-CONF-MAQ-FUND', etapaId: fundicao.id })).id;
  maquinaDesbasteId = (await ensureMaquina({ codigoInterno: 'TEST-CONF-MAQ-DESB', etapaId: desbaste.id })).id;

  clienteId = (await ensureCliente('Cliente Teste Conferência')).id;
  artigoId = (await ensureArtigoAtivoComOperacoes({
    codigo: 'TEST-ART-CONF', clienteId, criadoPorId: admin.id, etapaId: fundicao.id, exigeInspecao: false,
  })).id;
});

after(async () => {
  for (const osId of osCriadas) {
    const lotes = await prisma.lote.findMany({ where: { osId }, select: { id: true } });
    const ops = await prisma.oPLote.findMany({ where: { loteId: { in: lotes.map((l) => l.id) } }, select: { id: true } });
    const opIds = ops.map((o) => o.id);
    await prisma.alerta.deleteMany({ where: { entidadeId: { in: opIds } } });
    await prisma.eventoOS.deleteMany({ where: { osId } });
    await prisma.processamentoMaquina.deleteMany({ where: { opLoteId: { in: opIds } } });
    await prisma.carimbo.deleteMany({ where: { opLoteId: { in: opIds } } });
    await prisma.oPLote.deleteMany({ where: { id: { in: opIds } } });
    await prisma.lote.deleteMany({ where: { osId } });
    await prisma.oS.delete({ where: { id: osId } }).catch(() => {});
  }
  await closeTestApp(app);
});

const post = (url: string, payload: object = {}, token = tokenAdmin) =>
  app.inject({ method: 'POST', url: `/api/op-lote/${url}`, headers: { authorization: `Bearer ${token}` }, payload });
const pendentes = async (etapaId: string) =>
  (await app.inject({ method: 'GET', url: `/api/op-lote/pendentes?etapaId=${etapaId}`, headers: { authorization: `Bearer ${tokenAdmin}` } })).json().data;

/** OS de 5 peças já fundida: Fundição concluída, lote esperando no Desbaste. */
async function loteNoDesbaste() {
  const r = await app.inject({
    method: 'POST', url: '/api/os', headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      codigoGrv: `TEST-OS-CONF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clienteId, artigoId, quantidadeTotal: 5,
      prazoEntrega: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  const os = r.json().data;
  osCriadas.push(os.id);
  const lote = os.lotes[0];
  const [fundId, desbId] = lote.opsLote.map((o: any) => o.id);
  await prisma.oPLote.update({ where: { id: desbId }, data: { etapaId: desbaste.id, tipoServico: 'DESBASTE' } });
  const { id: _i, criadoEm: _c, atualizadoEm: _a, ...base } = await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } });
  const metal = await prisma.oPLote.create({ data: { ...base, etapaId: metalizacao.id, codigoOp: '30', ordem: base.ordem + 1, tipoServico: 'METALIZAÇÃO' } as any });
  const enc = await prisma.oPLote.create({ data: { ...base, etapaId: encaixe.id, codigoOp: '40', ordem: base.ordem + 2, tipoServico: 'ENCAIXE' } as any });

  assert.equal((await post(`${fundId}/iniciar`, { maquinaId: maquinaFundicaoId, operadorId: operadorFundicaoId })).statusCode, 201);
  assert.equal((await post(`${fundId}/encerrar`, { quantidadeConcluida: 5 })).statusCode, 200);
  return { osId: os.id, loteId: lote.id, fundId, desbId, metalId: metal.id, encId: enc.id };
}
const iniciarDesbaste = (desbId: string, extra: object = {}) =>
  post(`${desbId}/iniciar`, { maquinaId: maquinaDesbasteId, operadorId: operadorDesbasteId, metalizacao: { modo: 'interno' }, ...extra });

describe('conferência de chegada no Desbaste', () => {
  test('não inicia sem contar, nem com mais do que foi liberado', async () => {
    const { desbId } = await loteNoDesbaste();
    const fila = (await pendentes(desbaste.id)).find((o: any) => o.id === desbId);
    assert.deepEqual(fila.conferenciaChegada, { exigida: true, esperado: 5 });

    let r = await iniciarDesbaste(desbId);
    assert.equal(r.statusCode, 400, r.body);
    assert.equal(r.json().error, 'conferencia_chegada_obrigatoria');
    r = await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 6 } });
    assert.equal(r.json().error, 'conferencia_invalida');
    r = await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 0 } });
    assert.equal(r.json().error, 'conferencia_invalida');
  });

  test('conferência completa não avisa ninguém e o lote segue normal', async () => {
    const { desbId, metalId, loteId } = await loteNoDesbaste();
    assert.equal((await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 5 } })).statusCode, 201);
    assert.equal(await prisma.alerta.count({ where: { tipo: 'os_em_risco', entidadeId: desbId } }), 0);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 5 })).statusCode, 200);
    assert.equal((await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } })).status, 'concluida');
    assert.equal((await calcularFluxoDePecas([loteId])).get(metalId)?.disponiveis, 5);
  });

  test('falta: lote continua valendo 5, Desbaste só trabalha o que chegou, PCP e Fundição avisados', async () => {
    const { desbId, metalId, loteId } = await loteNoDesbaste();
    const r = await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 3 } });
    assert.equal(r.statusCode, 201, r.body);

    // Avisos: pessoal para o PCP e para a estação de onde as peças vieram
    const avisoPcp = await prisma.alerta.findFirst({ where: { tipo: 'os_em_risco', entidadeId: desbId, destinatarioId: pcpId } });
    assert.ok(avisoPcp, 'PCP avisado');
    assert.match(avisoPcp!.mensagem, /chegaram 3 de 5.*Faltam 2/);
    assert.equal(await prisma.alerta.count({ where: { tipo: 'os_em_risco', entidadeId: desbId, etapaDestinoId: fundicao.id } }), 1, 'Fundição avisada');

    // Lote não muda; Desbaste não encerra além do que chegou
    assert.equal((await prisma.lote.findUniqueOrThrow({ where: { id: loteId } })).quantidadePecas, 5);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 4 })).statusCode, 400);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 3 })).statusCode, 200);
    const desb = await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } });
    assert.equal(desb.status, 'na_fila', 'parcial: o lote não fecha');

    // As 3 seguem; o card fica na fila do Desbaste mostrando a falta
    assert.equal((await calcularFluxoDePecas([loteId])).get(metalId)?.disponiveis, 3);
    const card = (await pendentes(desbaste.id)).find((o: any) => o.id === desbId);
    assert.ok(card, 'card continua na fila sem peças');
    assert.equal(card.pecasDisponiveis, 0);
    assert.deepEqual(card.faltaChegada, { faltam: 2, esperado: 5, contado: 3 });
    assert.equal(card.conferenciaChegada, null, 'não pergunta de novo');
  });

  test('peças que faltavam aparecem: ficam disponíveis no Desbaste', async () => {
    const { desbId, loteId } = await loteNoDesbaste();
    assert.equal((await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 3 } })).statusCode, 201);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 3 })).statusCode, 200);

    assert.equal((await post(`${desbId}/conferencia/complemento`, { quantidade: 3 })).statusCode, 400, 'mais do que falta');
    let r = await post(`${desbId}/conferencia/complemento`, { quantidade: 1 });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().data.faltam, 1);
    assert.equal((await calcularFluxoDePecas([loteId])).get(desbId)?.disponiveis, 1);

    r = await post(`${desbId}/conferencia/complemento`, { quantidade: 1 });
    assert.equal(r.json().data.faltam, 0);
    assert.equal((await calcularFluxoDePecas([loteId])).get(desbId)?.disponiveis, 2);
    // Sem falta, o Desbaste fecha o lote inteiro
    assert.equal((await iniciarDesbaste(desbId)).statusCode, 201);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 5 })).statusCode, 200);
    assert.equal((await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } })).status, 'concluida');
  });

  test('só o PCP aceita a falta; o lote passa a valer o que chegou e o que estava pronto fecha', async () => {
    const { desbId, metalId, encId, loteId } = await loteNoDesbaste();
    // Metalização externa indicada junto com a conferência
    let r = await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 4 }, metalizacao: { modo: 'externo' } });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 4 })).statusCode, 200);
    assert.equal((await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } })).status, 'na_fila');

    assert.equal((await post(`${desbId}/conferencia/aceitar-falta`, { confirmar: true }, tokenProgramador)).statusCode, 403);
    assert.equal((await post(`${desbId}/conferencia/aceitar-falta`, {}, tokenPcp)).statusCode, 400, 'exige confirmação');
    r = await post(`${desbId}/conferencia/aceitar-falta`, { confirmar: true }, tokenPcp);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().data, { quantidadeAntes: 5, quantidadeDepois: 4 });

    assert.equal((await prisma.lote.findUniqueOrThrow({ where: { id: loteId } })).quantidadePecas, 4);
    assert.equal((await prisma.oPLote.findUniqueOrThrow({ where: { id: desbId } })).status, 'concluida', 'Desbaste fecha com 4');
    const metal = await prisma.oPLote.findUniqueOrThrow({ where: { id: metalId } });
    assert.equal(metal.quantidadeEnvioExterno, 4, 'envio externo com o lote real');
    const eventos = await prisma.eventoOS.findMany({ where: { loteId } });
    assert.equal(eventos.filter((e) => (e.payload as any)?.acao === 'metalizacao_envio_externo').length, 1, 'lote saiu para o fornecedor');
    assert.equal(eventos.filter((e) => (e.payload as any)?.acao === 'falta_aceita').length, 1);

    // Retorno: Encaixe recebe as 4
    assert.equal((await post(`${metalId}/receber-externo`, { confirmarRecebimento: true })).statusCode, 200);
    assert.equal((await calcularFluxoDePecas([loteId])).get(encId)?.disponiveis, 4);
    assert.ok(!(await pendentes(desbaste.id)).some((o: any) => o.id === desbId), 'sem falta, sai da fila');
    assert.equal((await post(`${desbId}/conferencia/aceitar-falta`, { confirmar: true }, tokenPcp)).statusCode, 409, 'nada mais a aceitar');
  });

  test('painel do chefe lista a falta e o card do Desbaste não some do kanban', async () => {
    const { desbId, osId } = await loteNoDesbaste();
    assert.equal((await iniciarDesbaste(desbId, { conferenciaChegada: { quantidade: 2 } })).statusCode, 201);
    assert.equal((await post(`${desbId}/encerrar`, { quantidadeConcluida: 2 })).statusCode, 200);
    const r = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { authorization: `Bearer ${tokenAdmin}` } });
    assert.equal(r.statusCode, 200, r.body);
    const d = r.json().data;
    const falta = d.faltasChegada.find((f: any) => f.opLoteId === desbId);
    assert.ok(falta, 'aparece no quadro de faltas');
    assert.equal(falta.faltam, 3);
    assert.equal(falta.contado, 2);
    assert.equal(falta.osId, osId);
    const coluna = d.kanban.find((k: any) => k.etapaId === desbaste.id);
    const card = coluna.cards.find((c: any) => c.opLoteId === desbId);
    assert.ok(card, 'card continua no kanban do Desbaste');
    assert.equal(card.faltaChegada, 3);
  });
});
