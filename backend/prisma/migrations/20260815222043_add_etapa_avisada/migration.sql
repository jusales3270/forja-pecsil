-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "etapa_avisada_id" TEXT;

-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "etapa_avisada_id" TEXT;

-- AddForeignKey
ALTER TABLE "operacoes_artigo" ADD CONSTRAINT "operacoes_artigo_etapa_avisada_id_fkey" FOREIGN KEY ("etapa_avisada_id") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_lote" ADD CONSTRAINT "ops_lote_etapa_avisada_id_fkey" FOREIGN KEY ("etapa_avisada_id") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

