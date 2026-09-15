// ============================================================
// Forja - Testes da rota /op-lote (Sprint 3)
// Cobre: listar pendentes, listar em-andamento, iniciar, encerrar
// ============================================================

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
import { apontamentoPecaRoutes } from '../src/routes/apontamento-peca.js';
import { calcularFluxoDePecas } from '../src/lib/fluxo-pecas.js';
import { prisma } from '../src/db/prisma.js';

let app: FastifyInstance;
let tokenProgramador: string;
let tokenInspetor: string;
let tokenAdmin: string;
let programadorId: string;
let operadorId: string;
let clienteId: string;
let etapaId: string;
let etapaOutraId: string;
let maquinaCompartilhadaId: string; // pra testes read-only de listagem
let maquinaOutraEtapaId: string;
let artigoId: string;

// IDs criados durante os testes (cleanup no after)
const osCriadasIds: string[] = [];
const maquinasCriadasCodigos: string[] = [];

before(async () => {
  app = await buildTestApp();
  await app.register(apontamentoPecaRoutes, { prefix: '/api' });

  const programador = await ensurePessoa({
    codigoPessoal: 'TEST-PROG-OPL',
    pin: '1111',
    nome: 'Programador Teste OPL',
    papel: 'programador',
  });
  programadorId = programador.id;

  const operador = await ensurePessoa({
    codigoPessoal: 'TEST-OPER-OPL',
    pin: '2222',
    nome: 'Operador Teste OPL',
    papel: 'operador',
  });
  operadorId = operador.id;

  await ensurePessoa({
    codigoPessoal: 'TEST-INSP-OPL',
    pin: '3333',
    nome: 'Inspetor Teste OPL',
    papel: 'inspetor',
  });

  await ensurePessoa({
    codigoPessoal: 'TEST-ADMIN-OPL',
    pin: '9999',
    nome: 'Admin Teste OPL',
    papel: 'admin',
  });

  tokenProgramador = await loginAs(app, 'TEST-PROG-OPL', '1111');
  tokenInspetor = await loginAs(app, 'TEST-INSP-OPL', '3333');
  tokenAdmin = await loginAs(app, 'TEST-ADMIN-OPL', '9999');

  const cliente = await ensureCliente('Cliente Teste OPL');
  clienteId = cliente.id;

  const etapas = await prisma.etapa.findMany({ orderBy: { ordemPadrao: 'asc' } });
  if (etapas.length < 2) {
    throw new Error('Seed não rodou. Execute pnpm db:seed antes dos testes.');
  }
  etapaId = etapas[0].id;
  etapaOutraId = etapas[1].id;

  // Máquina compartilhada pros testes que NÃO iniciam OP (só listagem etc)
  const mc = await ensureMaquina({
    codigoInterno: 'TEST-MAQ-OPL-COMPARTILHADA',
    etapaId,
    nome: 'Máquina Compartilhada',
  });
  maquinaCompartilhadaId = mc.id;
  maquinasCriadasCodigos.push('TEST-MAQ-OPL-COMPARTILHADA');

  const m3 = await ensureMaquina({
    codigoInterno: 'TEST-MAQ-OPL-OUTRA',
    etapaId: etapaOutraId,
    nome: 'Máquina Outra Etapa',
  });
  maquinaOutraEtapaId = m3.id;
  maquinasCriadasCodigos.push('TEST-MAQ-OPL-OUTRA');

  const artigo = await ensureArtigoAtivoComOperacoes({
    codigo: 'TEST-ART-OPL',
    clienteId,
    criadoPorId: programadorId,
    etapaId,
    exigeInspecao: false,
  });
  artigoId = artigo.id;
});

after(async () => {
  for (const osId of osCriadasIds) {
    await prisma.eventoOS.deleteMany({ where: { osId } });
    const lotes = await prisma.lote.findMany({ where: { osId }, select: { id: true } });
    for (const l of lotes) {
      const ops = await prisma.oPLote.findMany({
        where: { loteId: l.id },
        select: { id: true },
      });
      for (const o of ops) {
        await prisma.apontamentoPeca.deleteMany({ where: { opLoteId: o.id } });
        await prisma.processamentoMaquina.deleteMany({ where: { opLoteId: o.id } });
        await prisma.carimbo.deleteMany({ where: { opLoteId: o.id } });
      }
      await prisma.oPLote.deleteMany({ where: { loteId: l.id } });
    }
    await prisma.lote.deleteMany({ where: { osId } });
    await prisma.oS.delete({ where: { id: osId } }).catch(() => {});
  }

  await prisma.maquina
    .deleteMany({ where: { codigoInterno: { in: maquinasCriadasCodigos } } })
    .catch(() => {});

  await prisma.operacaoArtigo.deleteMany({ where: { artigoId } }).catch(() => {});
  await prisma.artigo.delete({ where: { id: artigoId } }).catch(() => {});

  await prisma.pessoa
    .deleteMany({
      where: {
        codigoPessoal: { in: ['TEST-PROG-OPL', 'TEST-OPER-OPL', 'TEST-INSP-OPL'] },
      },
    })
    .catch(() => {});

  await closeTestApp(app);
});

// ============================================================
// Helpers internos
// ============================================================

async function criarOSDeTeste(quantidade = 5): Promise<{
  osId: string;
  loteId: string;
  opLoteIds: string[];
}> {
  const prazo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const res = await app.inject({
    method: 'POST',
    url: '/api/os',
    headers: { authorization: `Bearer ${tokenProgramador}` },
    payload: {
      codigoGrv: `TEST-OS-OPL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clienteId,
      artigoId,
      quantidadeTotal: quantidade,
      prazoEntrega: prazo,
    },
  });
  assert.equal(res.statusCode, 201, `Falha ao criar OS de teste: ${res.body}`);
  const body = res.json().data;
  osCriadasIds.push(body.id);
  const lote = body.lotes[0];
  return {
    osId: body.id,
    loteId: lote.id,
    opLoteIds: lote.opsLote.map((o: any) => o.id),
  };
}

let maquinaCounter = 0;
async function criarMaquinaDedicada(): Promise<string> {
  maquinaCounter++;
  const codigo = `TEST-MAQ-OPL-D${maquinaCounter}-${Date.now()}`;
  const m = await ensureMaquina({ codigoInterno: codigo, etapaId });
  maquinasCriadasCodigos.push(codigo);
  return m.id;
}

// ============================================================
// GET /op-lote/pendentes
// ============================================================
describe('GET /op-lote/pendentes', () => {
  test('lista OPs na_fila da etapa informada', async () => {
    await criarOSDeTeste(3);

    const res = await app.inject({
      method: 'GET',
      url: `/api/op-lote/pendentes?etapaId=${etapaId}`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
    });
    assert.equal(res.statusCode, 200);
    const ops = res.json().data;
    assert.ok(Array.isArray(ops));
    assert.ok(ops.length > 0);
    for (const op of ops) {
      assert.equal(op.status, 'na_fila');
      assert.equal(op.etapaId, etapaId);
      assert.ok(op.lote?.os?.codigoGrv);
    }
  });

  test('não retorna OPs de OS cancelada', async () => {
    const { osId } = await criarOSDeTeste(2);
    await app.inject({
      method: 'DELETE',
      url: `/api/os/${osId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/op-lote/pendentes?etapaId=${etapaId}`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
    });
    const ops = res.json().data;
    const dessaOs = ops.filter((o: any) => o.lote.os.id === osId);
    assert.equal(dessaOs.length, 0);
  });

  test('filtra por busca textual no código GRV', async () => {
    const { osId } = await criarOSDeTeste(2);
    const os = await prisma.oS.findUnique({ where: { id: osId } });
    const busca = os!.codigoGrv.slice(0, 15);

    const res = await app.inject({
      method: 'GET',
      url: `/api/op-lote/pendentes?etapaId=${etapaId}&busca=${encodeURIComponent(busca)}`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
    });
    const ops = res.json().data;
    assert.ok(ops.some((o: any) => o.lote.os.codigoGrv === os!.codigoGrv));
  });

  test('etapaId inválido retorna 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/op-lote/pendentes?etapaId=nao-eh-uuid',
      headers: { authorization: `Bearer ${tokenProgramador}` },
    });
    assert.equal(res.statusCode, 400);
  });

  test('sem token retorna 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/op-lote/pendentes?etapaId=${etapaId}`,
    });
    assert.equal(res.statusCode, 401);
  });
});

// ============================================================
// GET /op-lote/em-andamento
// ============================================================
describe('GET /op-lote/em-andamento', () => {
  test('retorna OPs em processo com carimbo aberto', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds } = await criarOSDeTeste(2);
    const opId = opLoteIds[0];

    const iniciada = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(iniciada.statusCode, 201, iniciada.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/op-lote/em-andamento?etapaId=${etapaId}`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
    });
    assert.equal(res.statusCode, 200);
    const ops = res.json().data;
    const minha = ops.find((o: any) => o.id === opId);
    assert.ok(minha);
    assert.equal(minha.status, 'em_processo');
    assert.equal(minha.carimbos.length, 1);
    assert.equal(minha.carimbos[0].timestampSaida, null);
  });
});

// ============================================================
// POST /op-lote/:id/iniciar
// ============================================================
describe('POST /op-lote/:id/iniciar', () => {
  test('caminho feliz cria carimbo + processamento e atualiza status', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { osId, loteId, opLoteIds } = await criarOSDeTeste(4);
    const opId = opLoteIds[0];

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(res.statusCode, 201, res.body);
    const data = res.json().data;
    assert.equal(data.status, 'em_processo');
    assert.equal(data.carimbos.length, 1);
    assert.equal(data.carimbos[0].timestampSaida, null);

    const lote = await prisma.lote.findUnique({ where: { id: loteId } });
    assert.equal(lote!.status, 'em_processo');

    const os = await prisma.oS.findUnique({ where: { id: osId } });
    assert.equal(os!.status, 'em_producao');

    const proc = await prisma.processamentoMaquina.findFirst({
      where: { opLoteId: opId },
    });
    assert.ok(proc);
    assert.equal(proc!.status, 'rodando');
  });

  test('máquina ocupada retorna 409', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds: ops1 } = await criarOSDeTeste(2);
    const { opLoteIds: ops2 } = await criarOSDeTeste(2);

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${ops1[0]}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(r1.statusCode, 201);

    const r2 = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${ops2[0]}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(r2.statusCode, 409);
    assert.equal(r2.json().error, 'maquina_ocupada');
  });

  test('máquina de outra etapa retorna 400', async () => {
    const { opLoteIds } = await criarOSDeTeste(2);

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opLoteIds[0]}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId: maquinaOutraEtapaId, operadorId },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'maquina_etapa_incorreta');
  });

  test('OP que já está em_processo retorna 400', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds } = await criarOSDeTeste(2);
    const opId = opLoteIds[0];

    await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });

    const maquina2 = await criarMaquinaDedicada();
    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId: maquina2, operadorId },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'op_nao_disponivel');
  });

  test('inspetor (papel sem permissão) retorna 403', async () => {
    const { opLoteIds } = await criarOSDeTeste(2);

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opLoteIds[0]}/iniciar`,
      headers: { authorization: `Bearer ${tokenInspetor}` },
      payload: { maquinaId: maquinaCompartilhadaId, operadorId },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'forbidden');
  });

  test('opLoteId inválido retorna 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/op-lote/00000000-0000-0000-0000-000000000000/iniciar',
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId: maquinaCompartilhadaId, operadorId },
    });
    assert.equal(res.statusCode, 404);
  });
});

// ============================================================
// POST /op-lote/:id/encerrar
// ============================================================
describe('POST /op-lote/:id/encerrar', () => {
  test('encerramento parcial volta OP pra na_fila', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds } = await criarOSDeTeste(5);
    const opId = opLoteIds[0];

    await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/encerrar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { quantidadeConcluida: 2 },
    });
    assert.equal(res.statusCode, 200, res.body);
    const meta = res.json().meta;
    assert.equal(meta.completou, false);
    assert.equal(meta.novoStatus, 'na_fila');
    assert.equal(meta.loteConcluido, false);

    const op = await prisma.oPLote.findUnique({ where: { id: opId } });
    assert.equal(op!.status, 'na_fila');
    assert.equal(op!.quantidadeConcluida, 2);

    const carimbo = await prisma.carimbo.findFirst({
      where: { opLoteId: opId },
      orderBy: { timestampEntrada: 'desc' },
    });
    assert.ok(carimbo!.timestampSaida);
    assert.equal(carimbo!.quantidadeConcluida, 2);

    const proc = await prisma.processamentoMaquina.findFirst({
      where: { opLoteId: opId },
    });
    assert.equal(proc!.status, 'finalizado');
    assert.ok(proc!.fim);
  });

  test('encerramento completo de OP sem inspeção vai pra concluida', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds, loteId } = await criarOSDeTeste(3);
    const opId = opLoteIds[0];

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(r1.statusCode, 201, r1.body);

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/encerrar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { quantidadeConcluida: 3 },
    });
    assert.equal(res.statusCode, 200, res.body);
    const meta = res.json().meta;
    assert.equal(meta.completou, true);
    assert.equal(meta.novoStatus, 'concluida');
    assert.ok(meta.proximaOpId);

    const lote = await prisma.lote.findUnique({ where: { id: loteId } });
    assert.equal(lote!.status, 'em_processo');
  });

  test('encerrar a última OP do lote marca Lote como concluido', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds, loteId } = await criarOSDeTeste(2);

    for (const opId of opLoteIds) {
      const r1 = await app.inject({
        method: 'POST',
        url: `/api/op-lote/${opId}/iniciar`,
        headers: { authorization: `Bearer ${tokenProgramador}` },
        payload: { maquinaId, operadorId },
      });
      assert.equal(r1.statusCode, 201, r1.body);
      const r2 = await app.inject({
        method: 'POST',
        url: `/api/op-lote/${opId}/encerrar`,
        headers: { authorization: `Bearer ${tokenProgramador}` },
        payload: { quantidadeConcluida: 2 },
      });
      assert.equal(r2.statusCode, 200, r2.body);
    }

    const lote = await prisma.lote.findUnique({ where: { id: loteId } });
    assert.equal(lote!.status, 'concluido');
  });

  test('quantidade maior que o lote retorna 400', async () => {
    const maquinaId = await criarMaquinaDedicada();
    const { opLoteIds } = await criarOSDeTeste(2);
    const opId = opLoteIds[0];

    const r1 = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/iniciar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { maquinaId, operadorId },
    });
    assert.equal(r1.statusCode, 201);

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/encerrar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { quantidadeConcluida: 99 },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'quantidade_invalida');
  });

  test('encerrar OP que não está em_processo retorna 400', async () => {
    const { opLoteIds } = await criarOSDeTeste(2);
    const opId = opLoteIds[0];

    const res = await app.inject({
      method: 'POST',
      url: `/api/op-lote/${opId}/encerrar`,
      headers: { authorization: `Bearer ${tokenProgramador}` },
      payload: { quantidadeConcluida: 1 },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'op_nao_em_processo');
  });
});


describe('Metalização interna e envio externo', () => {
  async function preparar() {
    const os = await criarOSDeTeste(5);
    const metal = await prisma.etapa.findFirstOrThrow({ where: { nome: 'Metalização' } });
    await prisma.oPLote.update({ where: { id: os.opLoteIds[0] }, data: { etapaId: metal.id, tipoServico: 'METALIZAÇÃO' } });
    return { ...os, metalId: metal.id, id: os.opLoteIds[0], seguinteId: os.opLoteIds[1] };
  }
  const post = (id: string, acao: string, payload: object = {}, token = tokenAdmin) => app.inject({
    method: 'POST', url: `/api/op-lote/${id}/${acao}`, headers: { authorization: `Bearer ${token}` }, payload,
  });

  test('envio congela; recebimento único libera exatamente o lote sem apontamentos', async () => {
    const { id, seguinteId, metalId, loteId } = await preparar();
    const enviados = await Promise.all([post(id, 'enviar-externo', { fornecedor: 'Fornecedor teste' }), post(id, 'enviar-externo')]);
    assert.deepEqual(enviados.map(r => r.statusCode).sort(), [200, 409]);
    const op = await prisma.oPLote.findUniqueOrThrow({ where: { id } });
    assert.equal(op.status, 'bloqueada');
    assert.equal(op.quantidadeConcluida, 0);
    assert.equal(op.quantidadeEnvioExterno, 5);
    assert.equal((await calcularFluxoDePecas([loteId])).get(seguinteId)?.disponiveis, 0);
    const lista = await app.inject({ method: 'GET', url: `/api/op-lote/envios-externos?etapaId=${metalId}`, headers: { authorization: `Bearer ${tokenAdmin}` } });
    assert.ok(lista.json().data.some((o: any) => o.id === id));
    assert.equal((await post(id, 'encerrar', { quantidadeConcluida: 5 })).statusCode, 403);
    assert.equal((await post(id, 'iniciar', { modoMetalizacao: 'interno' })).statusCode, 403);
    assert.equal((await post(id, 'retomar')).statusCode, 403);
    const contar = await app.inject({ method: 'POST', url: '/api/apontamento-peca', headers: { authorization: `Bearer ${tokenAdmin}` }, payload: { opLoteId: id, maquinaId: maquinaCompartilhadaId } });
    assert.equal(contar.statusCode, 403);
    assert.equal((await post(seguinteId, 'iniciar')).statusCode, 409);
    assert.equal((await post(id, 'receber-externo')).statusCode, 400);
    assert.equal((await post(id, 'receber-externo', { confirmarRecebimento: true }, tokenInspetor)).statusCode, 403);
    const retornos = await Promise.all([post(id, 'receber-externo', { confirmarRecebimento: true }), post(id, 'receber-externo', { confirmarRecebimento: true })]);
    assert.deepEqual(retornos.map(r => r.statusCode).sort(), [200, 409]);
    const recebida = await prisma.oPLote.findUniqueOrThrow({ where: { id } });
    assert.equal(recebida.status, 'concluida');
    assert.equal(recebida.quantidadeConcluida, 5);
    assert.ok(recebida.recebimentoExternoEm);
    assert.equal((await calcularFluxoDePecas([loteId])).get(seguinteId)?.disponiveis, 5);
    assert.equal(await prisma.apontamentoPeca.count({ where: { opLoteId: id } }), 0);
    assert.equal(await prisma.carimbo.count({ where: { opLoteId: id, timestampSaida: null } }), 0);
    const eventos = await prisma.eventoOS.findMany({ where: { loteId } });
    assert.equal(eventos.filter(e => (e.payload as any)?.acao === 'metalizacao_recebimento_externo').length, 1);
    assert.ok(eventos.filter(e => (e.payload as any)?.acao?.startsWith('metalizacao_')).every(e => e.autorId));
    const depois = await app.inject({ method: 'GET', url: `/api/op-lote/envios-externos?etapaId=${metalId}`, headers: { authorization: `Bearer ${tokenAdmin}` } });
    assert.ok(!depois.json().data.some((o: any) => o.id === id));
  });

  test('escolha interna mantém máquina, contagem e encerramento normais', async () => {
    const { id, metalId, seguinteId, loteId } = await preparar();
    const codigoInterno = `TEST-MET-INT-${Date.now()}`;
    const maquina = await ensureMaquina({ codigoInterno, etapaId: metalId });
    maquinasCriadasCodigos.push(codigoInterno);
    assert.equal((await post(id, 'iniciar')).statusCode, 400);
    assert.equal((await post(id, 'iniciar', { modoMetalizacao: 'interno', maquinaId: maquina.id, operadorId })).statusCode, 201);
    assert.equal((await post(id, 'enviar-externo')).statusCode, 409);
    for (let i = 0; i < 5; i++) {
      const contar = await app.inject({ method: 'POST', url: '/api/apontamento-peca', headers: { authorization: `Bearer ${tokenAdmin}` }, payload: { opLoteId: id, maquinaId: maquina.id } });
      assert.equal(contar.statusCode, 201, contar.body);
    }
    assert.equal((await post(id, 'encerrar', { quantidadeConcluida: 5 })).statusCode, 200);
    assert.equal((await calcularFluxoDePecas([loteId])).get(seguinteId)?.disponiveis, 5);
    assert.equal((await prisma.oPLote.findUniqueOrThrow({ where: { id } })).envioExternoEm, null);
  });

  test('recusa outra estação, lote parcial e conta de outra estação', async () => {
    const { id, seguinteId, metalId } = await preparar();
    assert.equal((await post(seguinteId, 'enviar-externo')).statusCode, 400);
    await prisma.oPLote.update({ where: { id: seguinteId }, data: { etapaId: metalId } });
    assert.equal((await post(seguinteId, 'enviar-externo')).statusCode, 409);
    const tokenOutra = app.jwt.sign({ pessoaId: programadorId, papel: 'estacao', etapaId: etapaOutraId });
    assert.equal((await post(id, 'enviar-externo', {}, tokenOutra)).statusCode, 403);
    await post(id, 'enviar-externo');
    assert.equal((await post(id, 'receber-externo', { confirmarRecebimento: true }, tokenOutra)).statusCode, 403);
  });
});
