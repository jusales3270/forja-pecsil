-- CreateTable
CREATE TABLE "motivos_parada" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER,
    "nome" TEXT NOT NULL,
    "planejado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "captura_automatica_iot" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivos_parada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paradas_maquina" (
    "id" TEXT NOT NULL,
    "carimbo_id" TEXT NOT NULL,
    "motivo_parada_id" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "observacoes" TEXT,
    "registrado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradas_maquina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "motivos_parada_codigo_key" ON "motivos_parada"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "motivos_parada_nome_key" ON "motivos_parada"("nome");

-- AddForeignKey
ALTER TABLE "paradas_maquina" ADD CONSTRAINT "paradas_maquina_carimbo_id_fkey" FOREIGN KEY ("carimbo_id") REFERENCES "carimbos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas_maquina" ADD CONSTRAINT "paradas_maquina_motivo_parada_id_fkey" FOREIGN KEY ("motivo_parada_id") REFERENCES "motivos_parada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas_maquina" ADD CONSTRAINT "paradas_maquina_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

