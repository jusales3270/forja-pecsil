-- CreateTable
CREATE TABLE "apontamentos_peca" (
    "id" TEXT NOT NULL,
    "op_lote_id" TEXT NOT NULL,
    "maquina_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "numero_peca" INTEGER NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apontamentos_peca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apontamentos_peca_op_lote_id_idx" ON "apontamentos_peca"("op_lote_id");

-- CreateIndex
CREATE INDEX "apontamentos_peca_operador_id_maquina_id_idx" ON "apontamentos_peca"("operador_id", "maquina_id");

-- AddForeignKey
ALTER TABLE "apontamentos_peca" ADD CONSTRAINT "apontamentos_peca_op_lote_id_fkey" FOREIGN KEY ("op_lote_id") REFERENCES "ops_lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamentos_peca" ADD CONSTRAINT "apontamentos_peca_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamentos_peca" ADD CONSTRAINT "apontamentos_peca_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
