// ============================================================
// Forja - Import de Artigos legados (catálogo de moldes Pecsil)
// ============================================================
// Origem: planilhas do ERP legado (ex: "GradeDeDados", "FUNDO DE
// FORMA") já convertidas para JSON em prisma/data/*.json. Cada
// arquivo é uma lista de {codigo, descricao, tipoProduto}.
//
// Lê TODOS os .json de prisma/data/ automaticamente — pra importar
// um novo lote, basta soltar um novo arquivo .json nessa pasta e
// rodar de novo. Cada linha vira um Artigo com status "ativo",
// disponível de imediato na busca de Artigo (código ou descrição).
//
// Idempotente: pode rodar várias vezes, atualiza os já existentes
// (mesmo codigo + clienteId) em vez de duplicar.
//
// Uso: pnpm --filter @forja/backend db:import-artigos-legado
// ============================================================

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient, TipoProduto } from '@prisma/client';

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));

const NOME_CLIENTE_CATALOGO = 'Pecsil - Catálogo Interno (Moldes)';
const CODIGO_PESSOA_IMPORTADOR = '0001'; // Admin (Junior) - ver README/seed.ts

interface ArtigoLegado {
  codigo: string;
  descricao: string;
  tipoProduto: TipoProduto;
}

async function main() {
  console.log('📦 Import de Artigos legados (catálogo de moldes Pecsil)');
  console.log('');

  const dataDir = join(__dirname, 'data');
  const arquivos = readdirSync(dataDir)
    .filter((f: string) => f.endsWith('.json'))
    .sort();

  if (arquivos.length === 0) {
    console.log(`  Nenhum .json encontrado em ${dataDir}. Nada a fazer.`);
    return;
  }

  // Cliente "guarda-chuva" para o catálogo interno de moldes.
  const clienteExistente = await prisma.cliente.findFirst({
    where: { nome: NOME_CLIENTE_CATALOGO },
  });
  const cliente =
    clienteExistente ??
    (await prisma.cliente.create({ data: { nome: NOME_CLIENTE_CATALOGO } }));
  console.log(`  → Cliente catálogo: "${cliente.nome}" (${cliente.id})`);

  const importador = await prisma.pessoa.findUnique({
    where: { codigoPessoal: CODIGO_PESSOA_IMPORTADOR },
  });
  if (!importador) {
    throw new Error(
      `Pessoa com codigoPessoal "${CODIGO_PESSOA_IMPORTADOR}" não encontrada. Rode o seed antes.`
    );
  }
  console.log(`  → Criado por: ${importador.nome} (${importador.codigoPessoal})`);
  console.log('');

  let totalCriados = 0;
  let totalAtualizados = 0;

  for (const arquivo of arquivos) {
    const caminho = join(dataDir, arquivo);
    const artigos: ArtigoLegado[] = JSON.parse(readFileSync(caminho, 'utf-8'));
    console.log(`  → ${arquivo}: ${artigos.length} linhas`);

    let criados = 0;
    let atualizados = 0;

    for (const item of artigos) {
      const existente = await prisma.artigo.findUnique({
        where: {
          codigo_clienteId: { codigo: item.codigo, clienteId: cliente.id },
        },
      });

      if (existente) {
        await prisma.artigo.update({
          where: { id: existente.id },
          data: {
            descricao: item.descricao,
            tipoProduto: item.tipoProduto,
          },
        });
        atualizados++;
      } else {
        await prisma.artigo.create({
          data: {
            codigo: item.codigo,
            descricao: item.descricao,
            tipoProduto: item.tipoProduto,
            clienteId: cliente.id,
            status: 'ativo',
            ativo: true,
            criadoPorId: importador.id,
          },
        });
        criados++;
      }
    }

    console.log(`     criados: ${criados}, atualizados: ${atualizados}`);
    totalCriados += criados;
    totalAtualizados += atualizados;
  }

  console.log('');
  console.log('✅ Import concluído');
  console.log(`   Total criados: ${totalCriados}`);
  console.log(`   Total atualizados: ${totalAtualizados}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
