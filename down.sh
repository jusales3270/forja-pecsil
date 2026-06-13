#!/usr/bin/env bash
# Forja - Para containers (mantém dados)
echo "🛑 Parando containers do Forja..."
docker compose down
echo "✅ Containers parados. Dados preservados em volumes Docker."
echo "   Para subir de novo: ./up.sh"
echo "   Para apagar dados:  ./reset.sh"
