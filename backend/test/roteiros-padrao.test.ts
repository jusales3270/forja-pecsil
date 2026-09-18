// ============================================================
// Forja - Testes de Roteiros Padrão (Modelos GRV e Aplicação)
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

describe('Roteiros Padrão — Catálogo e Aplicação', () => {
  let app: FastifyInstance;
  let token: string;
  let artigoId: string;
  const TEST_CODIGO = '9992';
  const TEST_PIN = '1234';
  const TEST_CLIENTE = '__TEST_CLIENTE_ROTEIROS';
  const TEST_ARTIGO = '__TEST_ART_ROTEIROS_001';

  before(async () => {
    app = await buildTestApp();
    const pessoa = await ensurePessoa({
      codigoPessoal: TEST_CODIGO,
      pin: TEST_PIN,
      nome: 'Usuário Roteiros Test',
    });
    const cliente = await ensureCliente(TEST_CLIENTE);
    const artigo = await ensureArtigo({
      codigo: TEST_ARTIGO,
      clienteId: cliente.id,
      criadoPorId: pessoa.id,
    });
    artigoId = artigo.id;
    token = await loginAsAdmin(app, TEST_CODIGO, TEST_PIN);
  });

  after(async () => {
    await prisma.operacaoArtigo.deleteMany({
      where: { artigoId },
    });
    await prisma.artigo.deleteMany({
      where: { id: artigoId },
    });
    await prisma.cliente.deleteMany({ where: { nome: TEST_CLIENTE } });
    await prisma.pessoa.deleteMany({ where: { codigoPessoal: TEST_CODIGO } });
    await closeTestApp(app);
  });

  test('GET /api/roteiros-padrao lista todos os modelos sem pendência de catálogo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/roteiros-padrao',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const { data } = res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 5);

    // Todos os roteiros oficiais do GRV devem estar presentes
    const ids = data.map((r: any) => r.id);
    assert.ok(ids.includes('fundicao-grv'), 'deve conter fundicao-grv');
    assert.ok(ids.includes('arruela-grv'), 'deve conter arruela-grv');
    assert.ok(ids.includes('fundo-completo-grv'), 'deve conter fundo-completo-grv');
    assert.ok(ids.includes('fundo-de-bloco-grv'), 'deve conter fundo-de-bloco-grv');
    assert.ok(ids.includes('forma-bloco-grv'), 'deve conter forma-bloco-grv');

    // Nenhum roteiro deve ter código não cadastrado (temPendencia deve ser false)
    for (const roteiro of data) {
      assert.equal(
        roteiro.temPendencia,
        false,
        `Roteiro ${roteiro.id} tem tipos de serviço não cadastrados`,
      );
      for (const op of roteiro.operacoes) {
        assert.equal(op.naoEncontrado, false);
        assert.ok(op.tipoServico, `op ${op.codigoOp} deve ter tipoServico resolvido`);
        assert.ok(op.etapa, `op ${op.codigoOp} deve ter etapa resolvida`);
      }
    }
  });

  test('Aplica roteiro fundicao-grv no artigo e gera as 5 operações na sequência correta', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/aplicar-roteiro`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        roteiroId: 'fundicao-grv',
        substituir: true,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.meta.roteiro, 'Fundição e Linha Completa (Padrão GRV + Forno + Usinagem)');
    assert.equal(body.data.length, 13);

    // Confere via GET
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.statusCode, 200);
    const ops = getRes.json().data;
    assert.equal(ops.length, 13);

    assert.equal(ops[0].codigoOp, '10');
    assert.equal(ops[0].tipoServico, 'MODELAÇÃO');
    assert.equal(ops[0].etapa.nome, 'Fundição');

    assert.equal(ops[1].codigoOp, '20');
    assert.equal(ops[1].tipoServico, 'MOLDAGEM');
    assert.equal(ops[1].etapa.nome, 'Fundição');

    assert.equal(ops[2].codigoOp, '30');
    assert.equal(ops[2].tipoServico, 'VAZAMENTO');
    assert.equal(ops[2].etapa.nome, 'Fundição');

    assert.equal(ops[3].codigoOp, '40');
    assert.equal(ops[3].tipoServico, 'REBARBAÇÃO FUNDIÇÃO');
    assert.equal(ops[3].etapa.nome, 'Fundição');

    assert.equal(ops[4].codigoOp, '50');
    assert.equal(ops[4].tipoServico, 'TRATAMENTO TÉRMICO');
    assert.equal(ops[4].etapa.nome, 'Fundição');
    assert.equal(ops[4].avisaAoIniciar, true);

    assert.equal(ops[5].codigoOp, '60');
    assert.equal(ops[5].tipoServico, 'ENG. / PROG. CENTRO');
    assert.equal(ops[5].etapa.nome, 'Engenharia / Programação');

    assert.equal(ops[6].codigoOp, '70');
    assert.equal(ops[6].tipoServico, 'ENG. / PROG. TORNO');
    assert.equal(ops[6].etapa.nome, 'Engenharia / Programação');

    assert.equal(ops[7].codigoOp, '80');
    assert.equal(ops[7].etapa.nome, 'Desbaste');

    assert.equal(ops[8].codigoOp, '90');
    assert.equal(ops[8].etapa.nome, 'Metalização');

    assert.equal(ops[9].codigoOp, '100');
    assert.equal(ops[9].etapa.nome, 'Encaixe e Arredondamento');

    assert.equal(ops[10].codigoOp, '110');
    assert.equal(ops[10].etapa.nome, 'Torno');

    assert.equal(ops[11].codigoOp, '120');
    assert.equal(ops[11].etapa.nome, 'Acabamento / Polimento');

    assert.equal(ops[12].codigoOp, '130');
    assert.equal(ops[12].tipoServico, 'CONTROLE DE QUALIDADE');
    assert.equal(ops[12].etapa.nome, 'Qualidade Final');
    assert.equal(ops[12].exigeInspecao, true);
  });

  test('Aplica roteiro fundo-completo-grv substituindo operações e validando as 15 etapas', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/aplicar-roteiro`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        roteiroId: 'fundo-completo-grv',
        substituir: true,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.data.length, 15);
    assert.equal(body.meta.substituidas, 13);

    // Confere operações no banco
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/artigos/${artigoId}/operacoes`,
      headers: { authorization: `Bearer ${token}` },
    });
    const ops = getRes.json().data;
    assert.equal(ops.length, 15);

    // 10 Modelação, 20 Moldagem, 30 Prog Centro, 40 Prog Torno, 50 Vazamento
    assert.equal(ops[0].codigoOp, '10');
    assert.equal(ops[0].tipoServico, 'MODELAÇÃO');
    assert.equal(ops[0].etapa.nome, 'Fundição');

    assert.equal(ops[1].codigoOp, '20');
    assert.equal(ops[1].tipoServico, 'MOLDAGEM');
    assert.equal(ops[1].etapa.nome, 'Fundição');

    assert.equal(ops[2].codigoOp, '30');
    assert.equal(ops[2].tipoServico, 'ENG. / PROG. CENTRO');
    assert.equal(ops[2].etapa.nome, 'Engenharia / Programação');

    assert.equal(ops[3].codigoOp, '40');
    assert.equal(ops[3].tipoServico, 'ENG. / PROG. TORNO');
    assert.equal(ops[3].etapa.nome, 'Engenharia / Programação');

    assert.equal(ops[4].codigoOp, '50');
    assert.equal(ops[4].tipoServico, 'VAZAMENTO');
    assert.equal(ops[4].etapa.nome, 'Fundição');

    // 110 Integrex
    const opIntegrex = ops.find((o: any) => o.codigoOp === '110');
    assert.ok(opIntegrex);
    assert.equal(opIntegrex.tipoServico, 'TORNOS 5 EIXOS - INTEGREX');
    assert.equal(opIntegrex.etapa.nome, 'Torno');

    // 150 Controle de qualidade
    const opFinal = ops.find((o: any) => o.codigoOp === '150');
    assert.ok(opFinal);
    assert.equal(opFinal.tipoServico, 'CONTROLE DE QUALIDADE');
    assert.equal(opFinal.etapa.nome, 'Qualidade Final');
    assert.equal(opFinal.exigeInspecao, true);
  });

  test('Bronze preserva tempos de 30 segundos ao listar, aplicar e editar o artigo', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const catalogo = await app.inject({ method: 'GET', url: '/api/roteiros-padrao', headers });
    assert.equal(catalogo.statusCode, 200);
    const roteiro = catalogo.json().data.find((r: any) => r.id === 'coroa-forminha-bronze');
    assert.ok(roteiro);
    assert.equal(roteiro.nome, 'Coroa / Forminha em Bronze');
    assert.equal(roteiro.temPendencia, false);
    assert.equal(roteiro.totalOperacoes, 12);
    assert.equal(roteiro.tempoTotalUnitMin, 109.5);
    assert.deepEqual(roteiro.operacoes.map((o: any) => o.codigoTipoServico),
      [36, 37, 25, 10, 26, 26, 31, 21, 28, 28, 13, 18]);

    const aplicada = await app.inject({
      method: 'POST',
      url: `/api/artigos/${artigoId}/operacoes/aplicar-roteiro`,
      headers,
      payload: { roteiroId: 'coroa-forminha-bronze', substituir: true },
    });
    assert.equal(aplicada.statusCode, 201);
    const leitura = await app.inject({
      method: 'GET', url: `/api/artigos/${artigoId}/operacoes`, headers,
    });
    assert.equal(leitura.statusCode, 200);
    const ops = leitura.json().data;
    assert.deepEqual(ops.map((o: any) => o.tempoUnitMin),
      [1, 1, 4.5, 40, 10, 10, 7, 7, 10, 10, 4.5, 4.5]);
    assert.deepEqual(ops.map((o: any) => o.codigoOp),
      ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100', '110', '120']);
    assert.match(ops[7].observacoes, /FERRAMENTA Nº 13/);
    assert.ok(ops.every((o: any) => o.tempoSetupMin === 0));
    assert.equal(ops[11].exigeInspecao, true);

    const editada = await app.inject({
      method: 'PATCH',
      url: `/api/artigos/${artigoId}/operacoes/${ops[2].id}`,
      headers,
      payload: { tempoUnitMin: 4.5, observacoes: 'DESBASTE PARA METALIZAÇÃO' },
    });
    assert.equal(editada.statusCode, 200);
    const persistida = await prisma.operacaoArtigo.findUniqueOrThrow({ where: { id: ops[2].id } });
    assert.equal(persistida.tempoUnitMin, 4.5);
  });

});
