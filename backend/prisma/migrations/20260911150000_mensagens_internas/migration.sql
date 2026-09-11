CREATE TABLE "mensagens_internas" (
    "id" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "remetente_id" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "etapa_origem_id" TEXT NOT NULL,
    "etapa_destino_id" TEXT NOT NULL,
    "remetente_nome" TEXT NOT NULL,
    "destinatario_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lido_em" TIMESTAMP(3),
    "resposta_a_id" TEXT,
    CONSTRAINT "mensagens_internas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mensagens_internas_destinatario_id_etapa_destino_id_criado_em_idx" ON "mensagens_internas"("destinatario_id", "etapa_destino_id", "criado_em");
CREATE INDEX "mensagens_internas_remetente_id_criado_em_idx" ON "mensagens_internas"("remetente_id", "criado_em");
CREATE INDEX "mensagens_internas_resposta_a_id_idx" ON "mensagens_internas"("resposta_a_id");
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_etapa_origem_id_fkey" FOREIGN KEY ("etapa_origem_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_etapa_destino_id_fkey" FOREIGN KEY ("etapa_destino_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_resposta_a_id_fkey" FOREIGN KEY ("resposta_a_id") REFERENCES "mensagens_internas"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
