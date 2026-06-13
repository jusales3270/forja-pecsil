/*
  Warnings:

  - Added the required column `codigo_op` to the `ops_lote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo_servico` to the `ops_lote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "codigo_op" TEXT NOT NULL,
ADD COLUMN     "exige_inspecao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "tipo_servico" TEXT NOT NULL;
