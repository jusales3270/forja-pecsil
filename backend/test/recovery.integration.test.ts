// Somente bancos descartáveis. Não usa o backup real da empresa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { recoverDatabase, psql, targetUrl, inspectDump } from '../ops/recover-database.mjs';

const require = createRequire(import.meta.url);
const enabled = process.env.RUN_RECOVERY_INTEGRATION === '1';

test('recupera em Postgres real, preserva origem e entrega alertas à Engenharia', { skip: !enabled, timeout: 180_000 }, async () => {
  const adminUrl = process.env.DATABASE_URL!;
  assert.ok(new URL(adminUrl).pathname.endsWith('_test'), 'Use um banco administrativo terminado em _test.');
  const suffix = `${Date.now()}_${process.pid}`;
  const sourceName = `forja_recuperado_source_${suffix}`;
  const destName = `forja_recuperado_dest_${suffix}`;
  const failName = `forja_recuperado_fail_${suffix}`;
  const sourceUrl = targetUrl(adminUrl, sourceName);
  const destUrl = targetUrl(adminUrl, destName);
  const schemaPath = new URL('../prisma/schema.prisma', import.meta.url).pathname;
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  let app: any;
  let prisma: any;
  try {
    psql(adminUrl, `CREATE DATABASE "${sourceName}" TEMPLATE template0;`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', schemaPath],
      { env: { ...process.env, DATABASE_URL: sourceUrl }, stdio: 'pipe' });
    const pinHash = bcrypt.hashSync('Recovery-1234', 10);
    psql(sourceUrl, `
      INSERT INTO etapas (id,nome,ordem_padrao,sla_horas,aplica_para_tipos,atualizado_em) VALUES
        ('${id(1)}','Fundição',1,72,ARRAY['forma'],now()), ('${id(2)}','Engenharia / Programação',2,24,ARRAY['forma'],now());
      INSERT INTO pessoas (id,nome,codigo_pessoal,pin_hash,papel,etapa_id,atualizado_em) VALUES
        ('${id(3)}','Admin Teste','RECOVERY-ADMIN','${pinHash}','admin',null,now()),
        ('${id(4)}','Estação Engenharia','RECOVERY-ENG','${pinHash}','estacao','${id(2)}',now());
      INSERT INTO clientes (id,nome,atualizado_em) VALUES ('${id(5)}','Cliente sintético',now());
      INSERT INTO maquinas (id,nome,codigo_interno,tipo,etapa_id,atualizado_em) VALUES ('${id(6)}','Forno teste','FORNO-TEST','fundicao','${id(1)}',now());
      INSERT INTO artigos (id,codigo,descricao,tipo_produto,cliente_id,criado_por_id,status,atualizado_em) VALUES ('${id(7)}','ART-RECOVERY','Artigo teste','forma','${id(5)}','${id(3)}','ativo',now());
      INSERT INTO tipos_servico (id,codigo,nome,etapa_id,atualizado_em) VALUES ('${id(8)}',5,'TRATAMENTO TÉRMICO','${id(1)}',now());
      INSERT INTO operacoes_artigo (id,artigo_id,etapa_id,tipo_servico_id,codigo_op,ordem,tipo_servico,tempo_unit_min,avisa_ao_iniciar,etapa_avisada_id,exige_lote_completo,gatilho_alerta_pecas,atualizado_em) VALUES
        ('${id(9)}','${id(7)}','${id(1)}','${id(8)}','50',0,'TRATAMENTO TÉRMICO',10,true,'${id(2)}',true,2,now());
      INSERT INTO oses (id,codigo_grv,cliente_id,artigo_id,quantidade_total,prazo_entrega,criado_por_id,atualizado_em) VALUES
        ('${id(10)}','OS-RECOVERY','${id(5)}','${id(7)}',10,now()+interval '30 days','${id(3)}',now());
      INSERT INTO lotes (id,os_id,numero_lote,quantidade_pecas,atualizado_em) VALUES ('${id(11)}','${id(10)}',1,10,now());
      INSERT INTO ops_lote (id,lote_id,operacao_artigo_id,etapa_id,ordem,tempo_unit_planejado,tempo_total_planejado,codigo_op,tipo_servico,avisa_ao_iniciar,etapa_avisada_id,exige_lote_completo,gatilho_alerta_pecas,atualizado_em) VALUES
        ('${id(12)}','${id(11)}','${id(9)}','${id(1)}',0,10,100,'50','TRATAMENTO TÉRMICO',true,'${id(2)}',true,2,now());
      INSERT INTO alertas (id,tipo,severidade,entidade_tipo,entidade_id,etapa_destino_id,canal,mensagem) VALUES
        ('${id(13)}','os_em_risco','info','OS','${id(10)}','${id(2)}','dashboard','Aviso histórico de teste');
    `);
    psql(sourceUrl, `INSERT INTO mensagens_internas
      (id,corpo,remetente_id,destinatario_id,etapa_origem_id,etapa_destino_id,remetente_nome,destinatario_nome,lido_em,resposta_a_id)
      VALUES ('${id(15)}','Resposta sintética','${id(4)}','${id(3)}','${id(2)}','${id(1)}','Engenharia','Admin',null,'${id(14)}'),
      ('${id(14)}','Recado sintético','${id(3)}','${id(4)}','${id(1)}','${id(2)}','Admin','Engenharia',now(),null);`);
    const u = new URL(sourceUrl);
    const dump = execFileSync('pg_dump', ['--data-only', '--no-owner', '--no-privileges'], {
      encoding: 'utf8', env: { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432',
        PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: sourceName },
    });
    const snapshot = (url: string) => {
      const inspection = inspectDump(dump, readFileSync(schemaPath, 'utf8'));
      return inspection.blocks.map((b: any) => psql(url,
        `SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.id)::text,'[]') FROM public."${b.name}" t;`));
    };
    const original = snapshot(sourceUrl);
    const result = recoverDatabase({ source: dump, databaseUrl: sourceUrl, database: destName, log: () => {} });
    assert.equal(result.counts.pessoas, 2);
    assert.equal(result.counts.mensagens_internas, 2);
    assert.equal(result.automation.stationAccounts, 1);
    assert.deepEqual(snapshot(destUrl), original, 'Todos os dados e hashes devem ser iguais após o COPY.');
    assert.deepEqual(snapshot(sourceUrl), original, 'O banco de origem deve permanecer intacto.');
    assert.throws(() => recoverDatabase({ source: dump, databaseUrl: sourceUrl, database: destName, log: () => {} }), /criação do banco novo/);
    assert.deepEqual(snapshot(destUrl), original, 'Uma segunda tentativa não pode substituir o destino.');

    // Erro SQL após criar o banco: deve reverter TODO o COPY, sem carga parcial.
    const duplicated = dump.replace(/(COPY public.clientes[^\n]+\n)([^\n]+\n)/, '$1$2$2');
    assert.throws(() => recoverDatabase({ source: duplicated, databaseUrl: sourceUrl, database: failName, log: () => {} }), /importação transacional/);
    assert.equal(psql(targetUrl(sourceUrl, failName), 'SELECT count(*) FROM pessoas;'), '0');

    process.env.DATABASE_URL = destUrl;
    process.env.JWT_SECRET = 'recovery_integration_test_secret';
    process.env.NODE_ENV = 'test';
    const helpers = await import('./helpers.js');
    prisma = (await import('../src/db/prisma.js')).prisma;
    app = await helpers.buildTestApp();
    await app.register((await import('../src/routes/avisos.js')).avisosRoutes, { prefix: '/api' });
    await app.register((await import('../src/routes/apontamento-peca.js')).apontamentoPecaRoutes, { prefix: '/api' });
    const token = await helpers.loginAs(app, 'RECOVERY-ADMIN', 'Recovery-1234');
    const engineering = await helpers.loginAs(app, 'RECOVERY-ENG', 'Recovery-1234');
    assert.ok(token && engineering, 'Os usuários recuperados devem conseguir entrar.');
    const request = (method: string, url: string, payload?: any) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });
    let r = await request('POST', `/api/op-lote/${id(12)}/iniciar`, { maquinaId: id(6), operadorId: id(3) });
    assert.equal(r.statusCode, 201, r.body);
    let alerts = await prisma.alerta.findMany({ where: { tipo: 'fase_iniciada', entidadeId: id(12) } });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].etapaDestinoId, id(2));
    assert.match(alerts[0].mensagem, /OS-RECOVERY/);
    for (let i = 1; i <= 3; i++) {
      r = await request('POST', '/api/apontamento-peca', { opLoteId: id(12), maquinaId: id(6) });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().meta.alertaParcial, i === 2);
    }
    r = await app.inject({ method: 'GET', url: `/api/avisos?etapaId=${id(2)}`, headers: { authorization: `Bearer ${engineering}` } });
    assert.equal(r.statusCode, 200, r.body);
    assert.match(r.body, /OS-RECOVERY/);
    assert.match(r.body, /fase_iniciada/);
    assert.match(r.body, /parcial_pronta/);
    r = await request('POST', `/api/op-lote/${id(12)}/encerrar`, { quantidadeConcluida: 3 });
    assert.equal(r.statusCode, 200, r.body);
    r = await request('POST', `/api/op-lote/${id(12)}/iniciar`, { maquinaId: id(6), operadorId: id(3) });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(await prisma.alerta.count({ where: { tipo: 'fase_iniciada', entidadeId: id(12) } }), 1, 'Reiniciar a operação não duplica o aviso.');
    assert.deepEqual(snapshot(sourceUrl), original, 'Operar na base recuperada não altera a origem.');
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    for (const name of [sourceName, destName, failName]) psql(adminUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
    process.env.DATABASE_URL = adminUrl;
  }
});
