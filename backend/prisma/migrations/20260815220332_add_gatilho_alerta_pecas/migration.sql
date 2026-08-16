-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "gatilho_alerta_pecas" INTEGER;

-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "alerta_parcial_em" TIMESTAMP(3),
ADD COLUMN     "gatilho_alerta_pecas" INTEGER;

