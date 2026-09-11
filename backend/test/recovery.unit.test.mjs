import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectDump, schemaTables, importSql, targetUrl } from '../ops/recover-database.mjs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const tables = schemaTables(schema);
function fixture(records = {}) {
  return tables.map((t) => {
    const columns = Object.values(t.columns);
    const rows = (records[t.name] ?? []).map((r) => columns.map((c) => r[c] ?? '\\N').join('\t'));
    return [`COPY public.${t.name} (${columns.join(', ')}) FROM stdin;`, ...rows, '\\.'].join('\n');
  }).join('\n') + '\n';
}

test('preserva tabelas vazias, reconhece nomes físicos e ordena pelas FKs', () => {
  const result = inspectDump(fixture(), schema);
  assert.equal(result.blocks.length, 25);
  assert.equal(result.report.counts.desenhos, 0);
  assert.ok(result.blocks.findIndex((t) => t.name === 'etapas') < result.blocks.findIndex((t) => t.name === 'pessoas'));
  assert.ok(result.blocks.findIndex((t) => t.name === 'pessoas') < result.blocks.findIndex((t) => t.name === 'artigos'));
});

test('recusa backup truncado, tabela ausente, repetida e colunas divergentes', () => {
  assert.throws(() => inspectDump(fixture().slice(0, -4), schema), /truncado/);
  assert.throws(() => inspectDump(fixture().replace(/COPY public.clientes[^]*?\\\.\n/, ''), schema), /falta clientes/);
  assert.throws(() => inspectDump(fixture() + fixture(), schema), /repetida/);
  assert.throws(() => inspectDump(fixture().replace('codigo_pessoal', 'codigo_errado'), schema), /Colunas de pessoas/);
});

test('detecta IDs órfãos antes de conectar, inclusive destino de aviso', () => {
  const records = { ops_lote: [{ id: 'op', etapa_avisada_id: 'etapa-inexistente' }] };
  assert.throws(() => inspectDump(fixture(records), schema), /ops_lote.etapa_avisada_id/);
});

test('não executa SQL ou comandos psql do dump, nem importa migrations antigas', () => {
  const source = `\\! echo MALICIOUS\nTRUNCATE pessoas CASCADE;\nALTER TABLE public.pessoas DISABLE TRIGGER ALL;\nCOPY public._prisma_migrations (id) FROM stdin;\nold\n\\.\n${fixture()}`;
  const sql = importSql(inspectDump(source, schema));
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.endsWith('COMMIT;\n'));
  for (const forbidden of ['MALICIOUS', 'TRUNCATE', 'DISABLE TRIGGER', '_prisma_migrations']) assert.ok(!sql.includes(forbidden));
});

test('mantém campos de automação, vínculo de estação e marca de aviso enviado', () => {
  const result = inspectDump(fixture({
    etapas: [{ id: 'eng' }],
    pessoas: [{ id: 'pessoa', papel: 'estacao', etapa_id: 'eng' }],
    operacoes_artigo: [{ id: 'operacao', avisa_ao_iniciar: 't', etapa_avisada_id: 'eng' }],
    ops_lote: [{ id: 'op', avisa_ao_iniciar: 't', etapa_avisada_id: 'eng', alerta_inicio_em: '2026-09-08 12:00:00' }],
  }), schema);
  assert.equal(result.report.automation.operationsWithStartAlert, 1);
  assert.equal(result.report.automation.lotOperationsWithStartAlert, 1);
  assert.equal(result.report.automation.startAlertsAlreadySent, 1);
  assert.equal(result.report.automation.stationAccounts, 1);
  assert.deepEqual(result.report.warnings, []);
});

test('destino é banco novo explícito; mantém senha e parâmetros sem shell', () => {
  const original = 'postgresql://forja:p%24%28x%29%22@postgres:5432/forja?schema=public';
  const next = new URL(targetUrl(original, 'forja_recuperado_20260910'));
  assert.equal(next.password, 'p%24%28x%29%22');
  assert.equal(next.pathname, '/forja_recuperado_20260910');
  assert.throws(() => targetUrl('', 'forja_recuperado_x'), /explicitamente/);
  assert.throws(() => targetUrl(original, 'forja'), /banco novo/);
  assert.throws(() => targetUrl(original, 'forja_recuperado_x;DROP'), /banco novo/);
  assert.throws(() => targetUrl(next.toString(), 'forja_recuperado_20260910'), /banco atual/);
});
