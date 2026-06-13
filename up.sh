#!/usr/bin/env bash
# ============================================================
# Forja - Script de inicialização (dev)
# Uso: ./up.sh
# ============================================================
# Sobe: Postgres, Redis, MinIO + setup buckets
# Aplica migrations e seed
# Sobe backend e frontend em modo dev
# ============================================================

set -e

echo "🔥 Forja - Inicializando ambiente de desenvolvimento..."
echo ""

# 1. Verificar pré-requisitos
echo "📋 Verificando pré-requisitos..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker não encontrado. Instale Docker primeiro."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm não encontrado. Rode: npm install -g pnpm"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado."; exit 1; }
echo "  ✓ Docker, pnpm e Node.js instalados"
echo ""

# 2. .env (se não existir)
if [ ! -f .env ]; then
  echo "📝 Criando .env a partir de .env.example..."
  cp .env.example .env
fi
if [ ! -f backend/.env ]; then
  cp .env.example backend/.env
fi
if [ ! -f frontend/.env ]; then
  cp .env.example frontend/.env
fi
echo "  ✓ Arquivos .env prontos"
echo ""

# 3. Instalar dependências
echo "📦 Instalando dependências..."
pnpm install
echo ""

# 4. Subir containers
echo "🐳 Subindo containers (Postgres, Redis, MinIO)..."
docker compose up -d postgres redis minio minio_setup
echo "  ✓ Aguardando containers ficarem saudáveis..."

# Espera Postgres
echo "  ⏳ Aguardando Postgres..."
until docker exec forja_postgres pg_isready -U forja >/dev/null 2>&1; do
  sleep 1
done
echo "  ✓ Postgres pronto"

# Espera MinIO
echo "  ⏳ Aguardando MinIO..."
until curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; do
  sleep 1
done
echo "  ✓ MinIO pronto"

# Espera buckets
echo "  ⏳ Aguardando setup de buckets do MinIO..."
sleep 3
echo "  ✓ Buckets criados (verifique em http://localhost:9001)"
echo ""

# 5. Migrations + seed
echo "🗄️  Aplicando migrations do Prisma..."
cd backend
pnpm prisma generate
pnpm prisma migrate deploy 2>/dev/null || pnpm prisma migrate dev --name init
echo ""

echo "🌱 Rodando seed..."
pnpm db:seed
cd ..
echo ""

# 6. Resumo
echo "✅ Tudo pronto!"
echo ""
echo "📍 Acessos:"
echo "   Frontend:        http://localhost:5173"
echo "   Backend API:     http://localhost:3001"
echo "   Healthcheck:     http://localhost:3001/health"
echo "   MinIO Console:   http://localhost:9001  (user: forja_admin / pass: forja_minio_dev_2026)"
echo "   Prisma Studio:   pnpm --filter @forja/backend db:studio"
echo ""
echo "🚀 Para iniciar backend + frontend em modo dev:"
echo "   pnpm dev"
echo ""
echo "🛑 Para parar containers depois:"
echo "   docker compose down"
echo ""
