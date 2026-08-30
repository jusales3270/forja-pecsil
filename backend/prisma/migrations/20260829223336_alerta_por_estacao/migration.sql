-- DropForeignKey
ALTER TABLE "alertas" DROP CONSTRAINT "alertas_destinatario_id_fkey";

-- AlterTable
ALTER TABLE "alertas" ADD COLUMN     "etapa_destino_id" TEXT,
ALTER COLUMN "destinatario_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_etapa_destino_id_fkey" FOREIGN KEY ("etapa_destino_id") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

