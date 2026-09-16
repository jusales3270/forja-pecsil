// Estações, remapeamento de tipo de serviço, aviso de chegada e roteiro no
// painel — rotas reais num banco descartável, nunca na base da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

test('OS segue o roteiro do PCP: estações, avisos de chegada e trilha no painel', {
  skip: process.env.RUN_RECOVERY_INTEGRATION !== '1', timeout: 120_000,
}, async (t) => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use banco administrativo descartável terminado em _test.');
  const name = `forja_roteiro_${Date.now()}_${process.pid}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  let prisma: any;
  let app: any;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE template0`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema',
      new URL('../prisma/schema.prisma', import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'roteiro_integration_test_secret';
    prisma = (await import('../src/db/prisma.js')).prisma;
    const { buildTestApp } = await import('./helpers.js');
    app = await buildTestApp();
    await app.register((await import('../src/routes/avisos.js')).avisosRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/maquinas.js')).maquinasRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/dashboard.js')).dashboardRoutes, { prefix: '/api' });
    await app.ready();

    // Ordem das estações propositalmente diferente da ordem do roteiro
    const etapa = (nome: string, ordemPadrao: number) =>
      prisma.etapa.create({ data: { nome, ordemPadrao, slaHoras: 24, aplicaParaTipos: [] } });
    const fundicao = await etapa('Fundição', 1);
    const desbaste = await etapa('Desbaste', 2);
    const metalizacao = await etapa('Metalização', 3);

    const pessoa = (codigo: string, papel: string, etapaId: string | null = null) => prisma.pessoa.create({ data: {
      nome: codigo, codigoPessoal: codigo, pinHash: 'fixture-sem-login', papel, etapaId,
    } });
    const adm = await pessoa('ADM', 'admin');
    const pcp = await pessoa('PCP', 'pcp');
    const contaMetal = await pessoa('METAL', 'estacao', metalizacao.id);
    const contaDesb = await pessoa('DESB', 'estacao', desbaste.id);
    const tokens = new Map<string, string>([adm, pcp, contaMetal, contaDesb].map((p: any) =>
      [p.id, app.jwt.sign({ pessoaId: p.id, papel: p.papel, nome: p.nome, etapaId: p.etapaId })]));
    const req = (p: any, method: string, reqUrl: string, payload?: any) => app.inject({
      method, url: reqUrl, payload, headers: { authorization: `Bearer ${tokens.get(p.id)}` },
    });

    await t.test('só admin cria e edita estação e máquina', async () => {
      assert.equal((await req(pcp, 'POST', '/api/etapas', { nome: 'Serra' })).statusCode, 403);
      let r = await req(adm, 'POST', '/api/etapas', { nome: 'Serra' });
      assert.equal(r.statusCode, 201, r.body);
      const serra = r.json().data;
      assert.equal(serra.ordemPadrao, 4, 'Sem ordem informada, entra no fim.');
      assert.equal((await req(adm, 'POST', '/api/etapas', { nome: 'serra' })).statusCode, 409, 'Nome repetido.');
      assert.equal((await req(adm, 'POST', '/api/etapas', { nome: 'Outra', ordemPadrao: 1 })).statusCode, 409, 'Ordem repetida.');

      assert.equal((await req(pcp, 'POST', '/api/maquinas', { nome: 'Serra fita', codigoInterno: 'SERRA-01', tipo: 'outros', etapaId: serra.id })).statusCode, 403);
      r = await req(adm, 'POST', '/api/maquinas', { nome: 'Serra fita', codigoInterno: 'SERRA-01', tipo: 'outros', etapaId: serra.id });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().data.etapa.nome, 'Serra');
      assert.equal((await req(adm, 'POST', '/api/maquinas', { nome: 'Dup', codigoInterno: 'SERRA-01', tipo: 'outros', etapaId: serra.id })).statusCode, 409);
      r = await req(adm, 'PUT', `/api/maquinas/${r.json().data.id}`, { nome: 'Serra de fita' });
      assert.equal(r.statusCode, 200, r.body);

      r = await req(adm, 'GET', '/api/etapas');
      assert.ok(r.json().data.some((e: any) => e.nome === 'Serra'));
    });

    const cliente = await prisma.cliente.create({ data: { nome: 'Cliente roteiro', ativo: true } });
    const tipo = (nome: string, codigo: number, etapaId: string) => prisma.tipoServico.create({ data: { nome, codigo, etapaId } });
    const tMetal = await tipo('METALIZAÇÃO', 1, metalizacao.id);
    const tDesb = await tipo('DESBASTE', 2, desbaste.id);
    const tFund = await tipo('FUNDIR', 3, fundicao.id);
    const artigo = await prisma.artigo.create({ data: {
      codigo: 'ART-ROTEIRO', descricao: 'Peça com roteiro próprio', tipoProduto: 'forma', clienteId: cliente.id,
      status: 'ativo', criadoPorId: adm.id,
      operacoes: { create: [tMetal, tDesb, tFund].map((ts: any, i: number) => ({
        etapaId: ts.etapaId, tipoServicoId: ts.id, tipoServico: ts.nome, codigoOp: String((i + 1) * 10), ordem: i + 1, tempoUnitMin: 1,
      })) },
    } });
    const criarOS = (codigoGrv: string, divisao?: any) => req(pcp, 'POST', '/api/os', {
      codigoGrv, clienteId: cliente.id, artigoId: artigo.id, quantidadeTotal: 10,
      prazoEntrega: new Date(Date.now() + 20 * 86_400_000).toISOString(), divisao,
    });

    let osId = '';
    await t.test('criar OS avisa só a estação da 1ª operação do roteiro, um aviso por lote', async () => {
      const r = await criarOS('OS-ROTEIRO-1', { tipoDivisao: 'quantidade_lotes', quantidadeLotes: 2 });
      assert.equal(r.statusCode, 201, r.body);
      osId = r.json().data.id;

      const avisos = await prisma.alerta.findMany({ where: { tipo: 'op_chegou' }, orderBy: { mensagem: 'asc' } });
      assert.equal(avisos.length, 2);
      assert.ok(avisos.every((a: any) => a.etapaDestinoId === metalizacao.id));
      assert.match(avisos[0].mensagem, /OS-ROTEIRO-1 \(ART-ROTEIRO\) — lote 1: nova OS na fila de METALIZAÇÃO com 5 peças\. Depois: Desbaste \(DESBASTE\)\./);

      let lista = await req(contaMetal, 'GET', '/api/avisos');
      assert.equal(lista.statusCode, 200, lista.body);
      assert.equal(lista.json().data.length, 2);
      assert.equal(lista.json().data[0].opLote.etapa.nome, 'Metalização');
      assert.deepEqual(lista.json().data[0].opLote.proximasOperacoes.map((o: any) => o.etapa.nome), ['Desbaste', 'Fundição']);
      lista = await req(contaDesb, 'GET', '/api/avisos');
      assert.equal(lista.json().data.length, 0, 'Desbaste ainda não recebeu nada.');
    });

    await t.test('painel mostra a trilha na ordem do PCP e de onde/para onde em cada card', async () => {
      const r = await req(adm, 'GET', '/api/dashboard');
      assert.equal(r.statusCode, 200, r.body);
      const d = r.json().data;
      const roteiro = d.roteiros.find((x: any) => x.osId === osId);
      assert.equal(roteiro.lotes.length, 2);
      assert.deepEqual(roteiro.lotes[0].passos.map((p: any) => [p.estacao, p.estado]),
        [['Metalização', 'atual'], ['Desbaste', 'futuro'], ['Fundição', 'futuro']]);
      const cardsMetal = d.kanban.find((k: any) => k.etapaId === metalizacao.id).cards.filter((c: any) => c.osId === osId);
      assert.equal(cardsMetal.length, 2);
      assert.deepEqual([cardsMetal[0].veioDe, cardsMetal[0].proxima], [null, { estacao: 'Desbaste', tipoServico: 'DESBASTE' }]);
    });

    await t.test('trocar a estação do tipo leva artigos e OPs não iniciadas; OP em andamento fica', async () => {
      const serra = await prisma.etapa.findFirstOrThrow({ where: { nome: 'Serra' } });
      const ops = await prisma.oPLote.findMany({ where: { lote: { osId }, tipoServico: 'DESBASTE' }, orderBy: { lote: { numeroLote: 'asc' } } });
      await prisma.oPLote.update({ where: { id: ops[0].id }, data: { status: 'em_processo' } });

      let r = await req(pcp, 'PUT', `/api/tipos-servico/${tDesb.id}`, { etapaId: serra.id });
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json().meta, { operacoesArtigoMovidas: 0, opsLoteMovidas: 0 }, 'Sem propagarEtapa nada além do tipo muda.');
      await prisma.tipoServico.update({ where: { id: tDesb.id }, data: { etapaId: desbaste.id } });

      r = await req(pcp, 'PUT', `/api/tipos-servico/${tDesb.id}`, { etapaId: serra.id, propagarEtapa: true });
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json().meta, { operacoesArtigoMovidas: 1, opsLoteMovidas: 1 });
      const depois = await prisma.oPLote.findMany({ where: { id: { in: ops.map((o: any) => o.id) } }, orderBy: { lote: { numeroLote: 'asc' } } });
      assert.equal(depois[0].etapaId, desbaste.id, 'Em andamento termina onde está.');
      assert.equal(depois[1].etapaId, serra.id);
      const opArtigo = await prisma.operacaoArtigo.findFirstOrThrow({ where: { artigoId: artigo.id, tipoServicoId: tDesb.id } });
      assert.equal(opArtigo.etapaId, serra.id);

      const nova = await criarOS('OS-ROTEIRO-2');
      assert.equal(nova.statusCode, 201, nova.body);
      const desbNova = nova.json().data.lotes[0].opsLote.find((o: any) => o.tipoServico === 'DESBASTE');
      assert.equal(desbNova.etapa.nome, 'Serra', 'OS nova já nasce com a estação certa.');
    });

    await t.test('próxima estação só é avisada quando o lote inteiro sai da operação anterior', async () => {
      const r = await criarOS('OS-ROTEIRO-3');
      assert.equal(r.statusCode, 201, r.body);
      const [metal, desb] = r.json().data.lotes[0].opsLote;
      const maquina = await prisma.maquina.create({ data: { nome: 'Metal 1', codigoInterno: 'MET-1', tipo: 'metalizacao', etapaId: metalizacao.id } });
      const chegadas = () => prisma.alerta.findMany({ where: { tipo: 'op_chegou', entidadeId: desb.id } });
      const turno = async (quantidadeConcluida: number) => {
        let x = await req(pcp, 'POST', `/api/op-lote/${metal.id}/iniciar`, { modoMetalizacao: 'interno', maquinaId: maquina.id, operadorId: pcp.id });
        assert.equal(x.statusCode, 201, x.body);
        x = await req(pcp, 'POST', `/api/op-lote/${metal.id}/encerrar`, { quantidadeConcluida });
        assert.equal(x.statusCode, 200, x.body);
      };

      await turno(4);
      assert.equal((await chegadas()).length, 0, 'Parcial não avisa.');
      await turno(10);
      const avisos = await chegadas();
      assert.equal(avisos.length, 1);
      assert.equal(avisos[0].etapaDestinoId, desb.etapa.id);
      assert.match(avisos[0].mensagem, /OS-ROTEIRO-3 \(ART-ROTEIRO\) — lote 1: 10 peças chegaram de Metalização \(METALIZAÇÃO\) para DESBASTE\. Depois: Fundição \(FUNDIR\)\./);
    });

    await t.test('retorno de envio externo com o lote inteiro avisa a próxima estação uma vez', async () => {
      const r = await criarOS('OS-ROTEIRO-4');
      assert.equal(r.statusCode, 201, r.body);
      const [metal, desb] = r.json().data.lotes[0].opsLote;
      let x = await req(pcp, 'POST', `/api/op-lote/${metal.id}/enviar-externo`, { fornecedor: 'Fornecedor X' });
      assert.equal(x.statusCode, 200, x.body);
      assert.equal(await prisma.alerta.count({ where: { tipo: 'op_chegou', entidadeId: desb.id } }), 0);
      x = await req(pcp, 'POST', `/api/op-lote/${metal.id}/receber-externo`, { confirmarRecebimento: true });
      assert.equal(x.statusCode, 200, x.body);
      assert.equal(await prisma.alerta.count({ where: { tipo: 'op_chegou', entidadeId: desb.id } }), 1);
      const { avisarProximaSeLoteCompleto } = await import('../src/lib/aviso-chegada.js');
      assert.equal(await prisma.$transaction((tx: any) => avisarProximaSeLoteCompleto(tx, metal.id)), null, 'Não repete.');
      assert.equal(await prisma.alerta.count({ where: { tipo: 'op_chegou', entidadeId: desb.id } }), 1);
    });

    await t.test('estação com OP em aberto não pode ser desativada', async () => {
      const r = await req(adm, 'PUT', `/api/etapas/${metalizacao.id}`, { ativa: false });
      assert.equal(r.statusCode, 409, r.body);
      assert.equal((await req(pcp, 'PUT', `/api/etapas/${metalizacao.id}`, { nome: 'X' })).statusCode, 403);
    });
  } finally {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
    await admin.$disconnect();
  }
});
