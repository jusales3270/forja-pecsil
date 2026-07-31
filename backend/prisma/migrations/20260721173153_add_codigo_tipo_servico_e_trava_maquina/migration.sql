-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "trava_maquina" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "maquina_travada_id" TEXT,
ADD COLUMN     "trava_maquina" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_servico" ADD COLUMN     "codigo" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "tipos_servico_codigo_key" ON "tipos_servico"("codigo");

-- AddForeignKey
ALTER TABLE "ops_lote" ADD CONSTRAINT "ops_lote_maquina_travada_id_fkey" FOREIGN KEY ("maquina_travada_id") REFERENCES "maquinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

