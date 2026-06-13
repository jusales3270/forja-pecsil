#!/usr/bin/env bash
# Forja - APAGA TUDO (containers + volumes) e reinicia
# ⚠️ DESTRUTIVO - apaga banco, MinIO, tudo
set -e

echo "⚠️  ATENÇÃO: isso vai APAGAR TUDO do Forja (banco, arquivos, configurações)"
read -p "Tem certeza? (digite 'sim' pra continuar): " confirm
if [ "$confirm" != "sim" ]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "💥 Apagando containers e volumes..."
docker compose down -v
echo "  ✓ Tudo apagado"
echo ""
echo "🔄 Subindo de novo do zero..."
./up.sh
