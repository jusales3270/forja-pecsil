/*
  Warnings:

  - You are about to drop the column `data_nf` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `data_pagamento` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `numero_fiscal` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `po_cliente` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `preco_unitario` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `status_fiscal` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `valor_recebido` on the `lotes` table. All the data in the column will be lost.
  - You are about to drop the column `valor_total` on the `lotes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lotes" DROP COLUMN "data_nf",
DROP COLUMN "data_pagamento",
DROP COLUMN "numero_fiscal",
DROP COLUMN "po_cliente",
DROP COLUMN "preco_unitario",
DROP COLUMN "status_fiscal",
DROP COLUMN "valor_recebido",
DROP COLUMN "valor_total";
