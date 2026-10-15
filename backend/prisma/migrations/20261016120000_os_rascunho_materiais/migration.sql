-- Rascunho de OS vindo do orçamento ganho no Business OS e lista de materiais
-- (Sprint 6c, Bloco A). Ver docs do Business OS: PLANO-ALMOXARIFADO.md e PLANO-ORCAMENTO.md.

-- AlterEnum
ALTER TYPE "StatusOS" ADD VALUE 'rascunho';

-- AlterEnum
ALTER TYPE "TipoEventoOS" ADD VALUE 'os_liberada';

-- AlterTable
ALTER TABLE "oses" ADD COLUMN     "desenho_informado" TEXT,
ADD COLUMN     "liberada_em" TIMESTAMP(3),
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "pedido_cliente_item" TEXT,
ADD COLUMN     "ref_externa" TEXT;

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "integracao" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "materiais_catalogo" (
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "familia" TEXT,
    "grupo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "busca" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiais_catalogo_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "materiais_artigo" (
    "id" TEXT NOT NULL,
    "artigo_id" TEXT NOT NULL,
    "material_codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiais_artigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais_os" (
    "id" TEXT NOT NULL,
    "os_id" TEXT NOT NULL,
    "material_codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade_por_peca" DECIMAL(14,4) NOT NULL,
    "quantidade_total" DECIMAL(16,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiais_os_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "materiais_catalogo_ativo_descricao_idx" ON "materiais_catalogo"("ativo", "descricao");

-- CreateIndex
CREATE INDEX "materiais_artigo_artigo_id_ordem_idx" ON "materiais_artigo"("artigo_id", "ordem");

-- CreateIndex
CREATE INDEX "materiais_os_os_id_ordem_idx" ON "materiais_os"("os_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "oses_ref_externa_key" ON "oses"("ref_externa");

-- AddForeignKey
ALTER TABLE "materiais_artigo" ADD CONSTRAINT "materiais_artigo_artigo_id_fkey" FOREIGN KEY ("artigo_id") REFERENCES "artigos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais_os" ADD CONSTRAINT "materiais_os_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "oses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
