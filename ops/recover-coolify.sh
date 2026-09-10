#!/usr/bin/env bash
# Executar NO SERVIDOR LOCAL. Não faz deploy nem troca DATABASE_URL.
set -euo pipefail
umask 077

container=${1:?Informe o nome exato do container backend do Forja local.}
mode=${2:-inspect}
database=${3:-}
if [[ "$mode" != inspect && "$mode" != recover ]]; then
  echo 'Uso: bash ops/recover-coolify.sh CONTAINER [inspect | recover forja_recuperado_IDENTIFICADOR]' >&2
  exit 1
fi
if [[ "$mode" == recover && ! "$database" =~ ^forja_recuperado_[a-z0-9_]{1,40}$ ]]; then
  echo 'Informe um nome novo: forja_recuperado_IDENTIFICADOR.' >&2
  exit 1
fi
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
recovery_dir="$repo_dir/recovery-data/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$recovery_dir"

# Salva a cópia no host ANTES do redeploy da imagem que deixa de embutir SQL.
if [[ -n "${SOURCE_BACKUP:-}" ]]; then
  cp -- "$SOURCE_BACKUP" "$recovery_dir/backup-source.sql"
else
  docker cp "$container:/app/backend/prisma/backup_data.sql" "$recovery_dir/backup-source.sql"
fi
chmod 600 "$recovery_dir/backup-source.sql"
docker exec "$container" mkdir -p /app/backend/ops /app/backend/recovery-data
docker cp "$repo_dir/backend/ops/recover-database.mjs" "$container:/app/backend/ops/recover-database.mjs"
docker cp "$recovery_dir/backup-source.sql" "$container:/app/backend/recovery-data/backup-source.sql"
docker exec "$container" chmod 600 /app/backend/recovery-data/backup-source.sql

if [[ "$mode" == inspect ]]; then
  docker exec -w /app/backend "$container" node ops/recover-database.mjs \
    --source recovery-data/backup-source.sql --inspect | tee "$recovery_dir/inspection.json"
else
  # Lê a mesma configuração de conexão usada pelo backend instalado.
  # Credenciais não são impressas nem interpoladas em shell.
  docker exec -w /app/backend "$container" node --input-type=module -e '
    import { readFileSync } from "node:fs";
    import { recoverDatabase } from "./ops/recover-database.mjs";
    try {
      const { env } = await import("./dist/lib/env.js");
      const report = recoverDatabase({
        source: readFileSync("recovery-data/backup-source.sql", "utf8"),
        databaseUrl: env.DATABASE_URL,
        database: process.argv[1],
        log: (message) => console.error(message),
      });
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  ' "$database" | tee "$recovery_dir/recovery.json"
fi
echo "Cópia do SQL e relatório preservados em: $recovery_dir"
