-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "custo_previsto" DECIMAL(12,2),
ADD COLUMN     "espera_horas" INTEGER,
ADD COLUMN     "exige_lote_completo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fornecedor" TEXT,
ADD COLUMN     "prazo_previsto_dias" INTEGER,
ADD COLUMN     "terceirizada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "custo_previsto" DECIMAL(12,2),
ADD COLUMN     "espera_horas" INTEGER,
ADD COLUMN     "exige_lote_completo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fornecedor" TEXT,
ADD COLUMN     "prazo_previsto_dias" INTEGER,
ADD COLUMN     "terceirizada" BOOLEAN NOT NULL DEFAULT false;

