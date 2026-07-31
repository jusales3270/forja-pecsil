-- DropForeignKey
ALTER TABLE "ops_lote" DROP CONSTRAINT "ops_lote_maquina_travada_id_fkey";

-- AlterTable
ALTER TABLE "operacoes_artigo" DROP COLUMN "trava_maquina";

-- AlterTable
ALTER TABLE "ops_lote" DROP COLUMN "maquina_travada_id",
DROP COLUMN "trava_maquina";

