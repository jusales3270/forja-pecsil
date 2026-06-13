-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "data_nf" TIMESTAMP(3),
ADD COLUMN     "data_pagamento" TIMESTAMP(3),
ADD COLUMN     "numero_fiscal" TEXT,
ADD COLUMN     "po_cliente" TEXT,
ADD COLUMN     "preco_unitario" DECIMAL(12,2),
ADD COLUMN     "status_fiscal" TEXT,
ADD COLUMN     "valor_recebido" DECIMAL(14,2),
ADD COLUMN     "valor_total" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "data_nf" TIMESTAMP(3),
ADD COLUMN     "data_pagamento" TIMESTAMP(3),
ADD COLUMN     "numero_fiscal" TEXT,
ADD COLUMN     "po_cliente" TEXT,
ADD COLUMN     "preco_unitario" DECIMAL(12,2),
ADD COLUMN     "status_fiscal" TEXT,
ADD COLUMN     "valor_recebido" DECIMAL(14,2),
ADD COLUMN     "valor_total" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "oses" ADD COLUMN     "data_nf" TIMESTAMP(3),
ADD COLUMN     "data_pagamento" TIMESTAMP(3),
ADD COLUMN     "numero_fiscal" TEXT,
ADD COLUMN     "po_cliente" TEXT,
ADD COLUMN     "preco_unitario" DECIMAL(12,2),
ADD COLUMN     "status_fiscal" TEXT,
ADD COLUMN     "valor_recebido" DECIMAL(14,2),
ADD COLUMN     "valor_total" DECIMAL(14,2);
