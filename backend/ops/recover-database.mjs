#!/usr/bin/env node
// Recuperação administrativa explícita. Nunca é chamada pelo servidor.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';

const backendDir = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

// Lê os nomes físicos e FKs do schema versionado, incluindo @@map/@map.
export function schemaTables(schema) {
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
  const modelNames = new Set(models.map((m) => m[1]));
  const result = models.map(([, model, body]) => {
    const fields = [...body.matchAll(/^\s+(\w+)\s+(\w+)(\[\]|\?)?([^\n]*)/gm)];
    const columns = Object.fromEntries(fields.filter((f) => !modelNames.has(f[2]))
      .map((f) => [f[1], f[4].match(/@map\("([^"]+)"\)/)?.[1] ?? f[1]]));
    const foreignKeys = fields.filter((f) => modelNames.has(f[2])).flatMap((f) => {
      const from = f[4].match(/fields:\s*\[([^\]]+)\]/)?.[1];
      const to = f[4].match(/references:\s*\[([^\]]+)\]/)?.[1];
      return from && to ? [{ model: f[2], from: from.split(',').map((v) => columns[v.trim()]),
        toFields: to.split(',').map((v) => v.trim()) }] : [];
    });
    return { model, name: body.match(/@@map\("([^"]+)"\)/)?.[1] ?? model, columns, foreignKeys };
  });
  if (!result.length) throw new Error('Schema Prisma sem modelos.');
  for (const table of result) for (const fk of table.foreignKeys) {
    const target = result.find((t) => t.model === fk.model);
    fk.table = target.name;
    fk.to = fk.toFields.map((f) => target.columns[f]);
  }
  return result;
}

export function inspectDump(source, schema) {
  const tables = schemaTables(schema);
  const blocks = new Map();
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('COPY ')) continue;
    const match = lines[i].match(/^COPY public\.(\w+) \(([^)]+)\) FROM stdin;$/);
    if (!match) throw new Error('Formato COPY não suportado; use pg_dump --data-only em SQL texto.');
    const name = match[1];
    const columns = match[2].split(',').map((s) => s.trim().replace(/^"(\w+)"$/, '$1'));
    if (columns.some((c) => !/^\w+$/.test(c)) || new Set(columns).size !== columns.length) {
      throw new Error(`Colunas inválidas em ${name}.`);
    }
    const rows = [];
    for (i++; i < lines.length && lines[i] !== '\\.'; i++) {
      if (lines[i].split('\t').length !== columns.length) throw new Error(`Linha COPY inválida em ${name}.`);
      rows.push(lines[i]);
    }
    if (i === lines.length) throw new Error(`Backup truncado em ${name}.`);
    // O histórico de migrations é criado por migrate deploy, nunca pelo dump.
    if (name === '_prisma_migrations') continue;
    const table = tables.find((t) => t.name === name);
    if (!table || blocks.has(name)) throw new Error(`Tabela desconhecida ou repetida: ${name}.`);
    const expected = Object.values(table.columns).sort();
    if (JSON.stringify([...columns].sort()) !== JSON.stringify(expected)) {
      throw new Error(`Colunas de ${name} não correspondem ao schema desta versão.`);
    }
    blocks.set(name, { name, columns, rows, cells: rows.map((r) => r.split('\t')) });
  }
  for (const table of tables) if (!blocks.has(table.name)) throw new Error(`Backup incompleto: falta ${table.name}.`);
  // Valida relações antes de sequer conectar no servidor.
  for (const table of tables) {
    const block = blocks.get(table.name);
    for (const fk of table.foreignKeys) {
      const target = blocks.get(fk.table);
      const targetKeys = new Set(target.cells.map((r) => JSON.stringify(fk.to.map((c) => r[target.columns.indexOf(c)]))));
      for (const row of block.cells) {
        const values = fk.from.map((c) => row[block.columns.indexOf(c)]);
        if (!values.includes('\\N') && !targetKeys.has(JSON.stringify(values))) {
          throw new Error(`Vínculo órfão: ${table.name}.${fk.from.join(',')} → ${fk.table}.`);
        }
      }
    }
  }
  // Ordenação por dependências: todas as FKs continuam habilitadas no COPY.
  const ordered = [];
  const pending = [...tables];
  while (pending.length) {
    const index = pending.findIndex((t) => t.foreignKeys.every((fk) => ordered.some((b) => b.name === fk.table)));
    if (index < 0) throw new Error('Relações cíclicas exigem recuperação específica; nada foi alterado.');
    ordered.push(blocks.get(pending.splice(index, 1)[0].name));
  }
  const count = (name, predicate) => {
    const b = blocks.get(name);
    return b.cells.filter((r) => predicate(Object.fromEntries(b.columns.map((c, i) => [c, r[i]])))).length;
  };
  const warnings = [];
  for (const name of ['operacoes_artigo', 'ops_lote']) {
    const missing = count(name, (r) => r.avisa_ao_iniciar === 't' && r.etapa_avisada_id === '\\N');
    if (missing) warnings.push(`${name}: ${missing} avisos de início sem etapa de destino no backup.`);
  }
  return {
    blocks: ordered,
    report: {
      sha256: createHash('sha256').update(source).digest('hex'),
      counts: Object.fromEntries(ordered.map((b) => [b.name, b.rows.length])),
      automation: {
        operationsWithStartAlert: count('operacoes_artigo', (r) => r.avisa_ao_iniciar === 't'),
        lotOperationsWithStartAlert: count('ops_lote', (r) => r.avisa_ao_iniciar === 't'),
        startAlertsAlreadySent: count('ops_lote', (r) => r.alerta_inicio_em !== '\\N'),
        operationsWithPieceThreshold: count('operacoes_artigo', (r) => r.gatilho_alerta_pecas !== '\\N'),
        stationAccounts: count('pessoas', (r) => r.papel === 'estacao' && r.etapa_id !== '\\N'),
      },
      warnings,
    },
  };
}

export function targetUrl(databaseUrl, database) {
  if (!databaseUrl) throw new Error('DATABASE_URL precisa estar configurada explicitamente.');
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) {
    throw new Error('DATABASE_URL inválida.');
  }
  if (!/^forja_recuperado_[a-z0-9_]{1,40}$/.test(database)) {
    throw new Error('O banco novo deve se chamar forja_recuperado_<identificador>.');
  }
  if (decodeURIComponent(url.pathname.slice(1)) === database) throw new Error('O destino não pode ser o banco atual.');
  if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') {
    throw new Error('Esta recuperação exige schema public.');
  }
  url.pathname = `/${database}`;
  return url.toString();
}

function pgEnvironment(databaseUrl) {
  const u = new URL(databaseUrl);
  return { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGCONNECT_TIMEOUT: '10',
    ...(u.searchParams.has('sslmode') ? { PGSSLMODE: u.searchParams.get('sslmode') } : {}) };
}

function run(command, args, options, stage) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'], ...options });
  } catch (e) {
    // Não imprimir URL, senha, hash ou linha de COPY nos logs.
    const state = String(e.stderr ?? '').match(/\b(?:P\d{4}|[0-9]{2}[A-Z0-9]{3})\b/)?.[0];
    throw new Error(`Falha em ${stage}${state ? ` (código ${state})` : ''}. O banco original não foi alterado. Confira conexão, permissões e compatibilidade da versão.`);
  }
}

export function psql(databaseUrl, input, stage = 'consulta') {
  return run('psql', ['-X', '--no-password', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'SHOW_CONTEXT=never'],
    { env: pgEnvironment(databaseUrl), input }, stage).trim();
}

export function importSql(inspection) {
  const sql = ['BEGIN;', "SET LOCAL statement_timeout = '90s';", "SET LOCAL client_encoding = 'UTF8';",
    'SET LOCAL standard_conforming_strings = on;', "SET LOCAL DateStyle = 'ISO, YMD';"];
  for (const b of inspection.blocks) {
    sql.push(`COPY public.${identifier(b.name)} (${b.columns.map(identifier).join(', ')}) FROM stdin;`, ...b.rows, '\\.');
  }
  for (const b of inspection.blocks) {
    sql.push(`DO $$ BEGIN IF (SELECT count(*) FROM public.${identifier(b.name)}) <> ${b.rows.length} THEN RAISE EXCEPTION 'Contagem incorreta em ${b.name}'; END IF; END $$;`);
  }
  sql.push('COMMIT;');
  return sql.join('\n') + '\n';
}

export function recoverDatabase({ source, databaseUrl, database, schemaPath = path.join(backendDir, 'prisma/schema.prisma'), log = console.log }) {
  const inspection = inspectDump(source, readFileSync(schemaPath, 'utf8'));
  const recoveredUrl = targetUrl(databaseUrl, database);
  // CREATE DATABASE recusa destinos existentes, inclusive recuperações parciais.
  log(`Criando banco novo: ${database}`);
  psql(databaseUrl, `CREATE DATABASE ${identifier(database)} TEMPLATE template0;`, 'criação do banco novo');
  log('Aplicando migrations somente no banco novo...');
  run(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', schemaPath],
    { env: { ...process.env, DATABASE_URL: recoveredUrl } }, 'migrations do banco novo');
  log('Importando dados com transação única e chaves estrangeiras habilitadas...');
  psql(recoveredUrl, importSql(inspection), 'importação transacional');
  log('Recuperação concluída e contagens verificadas. A aplicação ainda usa o banco anterior.');
  return { database, ...inspection.report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { source: { type: 'string' }, database: { type: 'string' }, inspect: { type: 'boolean' } } });
    if (!values.source || (!values.inspect && !values.database)) throw new Error('Uso: node ops/recover-database.mjs --source /caminho/backup.sql --inspect OU --database forja_recuperado_<identificador>');
    const source = readFileSync(values.source, 'utf8');
    const result = values.inspect
      ? inspectDump(source, readFileSync(path.join(backendDir, 'prisma/schema.prisma'), 'utf8')).report
      : recoverDatabase({ source, databaseUrl: process.env.DATABASE_URL, database: values.database });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'Falha na recuperação.');
    process.exitCode = 1;
  }
}
