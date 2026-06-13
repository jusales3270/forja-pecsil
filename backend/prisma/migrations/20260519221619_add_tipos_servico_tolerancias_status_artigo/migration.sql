/*
  Warnings:

  - You are about to drop the column `cliente_padrao_id` on the `artigos` table. All the data in the column will be lost.
  - You are about to drop the column `frequencia` on the `cotas_inspecao` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[codigo,cliente_id]` on the table `artigos` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cliente_id` to the `artigos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequencia_monitorar` to the `cotas_inspecao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequencia_registrar` to the `cotas_inspecao` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusArtigo" AS ENUM ('rascunho', 'ativo', 'arquivado');

-- DropForeignKey
ALTER TABLE "artigos" DROP CONSTRAINT "artigos_cliente_padrao_id_fkey";

-- DropIndex
DROP INDEX "artigos_codigo_key";

-- AlterTable
ALTER TABLE "artigos" DROP COLUMN "cliente_padrao_id",
ADD COLUMN     "cliente_id" TEXT NOT NULL,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "po_padrao" TEXT,
ADD COLUMN     "status" "StatusArtigo" NOT NULL DEFAULT 'rascunho';

-- AlterTable
ALTER TABLE "cotas_inspecao" DROP COLUMN "frequencia",
ADD COLUMN     "frequencia_monitorar" "FrequenciaMedicao" NOT NULL,
ADD COLUMN     "frequencia_registrar" "FrequenciaMedicao" NOT NULL,
ALTER COLUMN "tolerancia_mais" DROP NOT NULL,
ALTER COLUMN "tolerancia_mais" DROP DEFAULT,
ALTER COLUMN "tolerancia_menos" DROP NOT NULL,
ALTER COLUMN "tolerancia_menos" DROP DEFAULT;

-- AlterTable
ALTER TABLE "desenhos" ALTER COLUMN "arquivo_bucket" DROP NOT NULL,
ALTER COLUMN "arquivo_key" DROP NOT NULL,
ALTER COLUMN "arquivo_tipo" DROP NOT NULL,
ALTER COLUMN "arquivo_tamanho" DROP NOT NULL;

-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "tipo_servico_id" TEXT;

-- CreateTable
CREATE TABLE "tipos_servico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "exige_inspecao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tolerancias_gerais_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "faixa_min" DOUBLE PRECISION NOT NULL,
    "faixa_max" DOUBLE PRECISION NOT NULL,
    "tolerancia_mais" DOUBLE PRECISION NOT NULL,
    "tolerancia_menos" DOUBLE PRECISION NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tolerancias_gerais_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_servico_nome_key" ON "tipos_servico"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "artigos_codigo_cliente_id_key" ON "artigos"("codigo", "cliente_id");

-- AddForeignKey
ALTER TABLE "tipos_servico" ADD CONSTRAINT "tipos_servico_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tolerancias_gerais_cliente" ADD CONSTRAINT "tolerancias_gerais_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artigos" ADD CONSTRAINT "artigos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacoes_artigo" ADD CONSTRAINT "operacoes_artigo_tipo_servico_id_fkey" FOREIGN KEY ("tipo_servico_id") REFERENCES "tipos_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
