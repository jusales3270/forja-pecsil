-- AlterEnum
ALTER TYPE "Papel" ADD VALUE 'estacao';

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "etapa_id" TEXT;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

