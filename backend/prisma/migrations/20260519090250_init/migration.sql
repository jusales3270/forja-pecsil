-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'chefe', 'pcp', 'engenharia', 'programador', 'operador', 'inspetor', 'embalador');

-- CreateEnum
CREATE TYPE "TipoProduto" AS ENUM ('forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde');

-- CreateEnum
CREATE TYPE "TipoMaquina" AS ENUM ('torno', 'vertiflow', 'tres_eixos', 'quinto_eixo', 'fundicao', 'metalizacao', 'solda', 'qualidade', 'embalagem', 'outros');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('aberta', 'em_producao', 'finalizada', 'atrasada', 'cancelada');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('na_fila', 'em_processo', 'aguardando_qualidade', 'bloqueado', 'concluido');

-- CreateEnum
CREATE TYPE "StatusOPLote" AS ENUM ('na_fila', 'em_processo', 'aguardando_qualidade', 'concluida', 'bloqueada');

-- CreateEnum
CREATE TYPE "StatusProcessamento" AS ENUM ('rodando', 'finalizado', 'interrompido');

-- CreateEnum
CREATE TYPE "TipoDesenho" AS ENUM ('cliente', 'forma', 'acompanhamento_dim');

-- CreateEnum
CREATE TYPE "CaracteristicaCota" AS ENUM ('funcional', 'critica', 'processo');

-- CreateEnum
CREATE TYPE "FrequenciaMedicao" AS ENUM ('todas', 'primeira', 'um_em_3', 'um_em_5', 'um_em_10', 'na_preparacao');

-- CreateEnum
CREATE TYPE "InstrumentoMedicao" AS ENUM ('paq_digital', 'comparador', 'altimetro', 'micrometro', 'renishaw', 'visual', 'metrologia', 'outros');

-- CreateEnum
CREATE TYPE "ResultadoInspecao" AS ENUM ('aprovado', 'reprovado', 'com_observacoes');

-- CreateEnum
CREATE TYPE "TipoInspecao" AS ENUM ('primeira_peca', 'amostragem', 'final');

-- CreateEnum
CREATE TYPE "TipoEventoOS" AS ENUM ('os_criada', 'os_alterada', 'prazo_alterado', 'prioridade_alterada', 'lote_criado', 'op_lote_iniciada', 'op_lote_concluida', 'inspecao_iniciada', 'inspecao_aprovada', 'inspecao_reprovada', 'inspecao_com_observacao', 'volume_registrado', 'observacao_livre', 'alerta_disparado', 'retrabalho_solicitado', 'os_finalizada', 'os_cancelada');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('lote_parado', 'qualidade_reprovada', 'cota_fora_tolerancia', 'volume_correcao_alta', 'os_em_risco', 'os_vencida', 'resumo_diario');

-- CreateEnum
CREATE TYPE "SeveridadeAlerta" AS ENUM ('info', 'warning', 'critico');

-- CreateEnum
CREATE TYPE "CanalAlerta" AS ENUM ('whatsapp', 'dashboard');

-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo_pessoal" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem_padrao" INTEGER NOT NULL,
    "sla_horas" INTEGER NOT NULL,
    "aplica_para_tipos" TEXT[],
    "exige_checkpoint_qualidade" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquinas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo_interno" TEXT NOT NULL,
    "tipo" "TipoMaquina" NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artigos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_produto" "TipoProduto" NOT NULL,
    "cliente_padrao_id" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artigos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desenhos" (
    "id" TEXT NOT NULL,
    "artigo_id" TEXT NOT NULL,
    "tipo" "TipoDesenho" NOT NULL,
    "codigo_desenho" TEXT NOT NULL,
    "revisao" TEXT NOT NULL,
    "data_revisao" TIMESTAMP(3),
    "arquivo_bucket" TEXT NOT NULL,
    "arquivo_key" TEXT NOT NULL,
    "arquivo_tipo" TEXT NOT NULL,
    "arquivo_tamanho" INTEGER NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desenhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacoes_artigo" (
    "id" TEXT NOT NULL,
    "artigo_id" TEXT NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "codigo_op" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo_servico" TEXT NOT NULL,
    "tempo_unit_min" INTEGER NOT NULL,
    "tempo_setup_min" INTEGER NOT NULL DEFAULT 0,
    "exige_inspecao" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operacoes_artigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_inspecao" (
    "id" TEXT NOT NULL,
    "operacao_artigo_id" TEXT NOT NULL,
    "observacoes_gerais" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotas_inspecao" (
    "id" TEXT NOT NULL,
    "plano_inspecao_id" TEXT NOT NULL,
    "codigo_cota" TEXT NOT NULL,
    "valor_nominal" DOUBLE PRECISION NOT NULL,
    "tolerancia_mais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tolerancia_menos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caracteristica" "CaracteristicaCota" NOT NULL,
    "frequencia" "FrequenciaMedicao" NOT NULL,
    "instrumento" "InstrumentoMedicao" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotas_inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oses" (
    "id" TEXT NOT NULL,
    "codigo_grv" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "artigo_id" TEXT NOT NULL,
    "quantidade_total" INTEGER NOT NULL,
    "prazo_entrega" TIMESTAMP(3) NOT NULL,
    "data_abertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "status" "StatusOS" NOT NULL DEFAULT 'aberta',
    "observacoes" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" TEXT NOT NULL,
    "os_id" TEXT NOT NULL,
    "numero_lote" INTEGER NOT NULL,
    "quantidade_pecas" INTEGER NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'na_fila',
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_lote" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "operacao_artigo_id" TEXT NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "codigo_grv_op" TEXT,
    "ordem" INTEGER NOT NULL,
    "status" "StatusOPLote" NOT NULL DEFAULT 'na_fila',
    "quantidade_concluida" INTEGER NOT NULL DEFAULT 0,
    "tempo_unit_planejado" INTEGER NOT NULL,
    "tempo_total_planejado" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carimbos" (
    "id" TEXT NOT NULL,
    "op_lote_id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "maquina_id" TEXT,
    "timestamp_entrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp_saida" TIMESTAMP(3),
    "programador_id" TEXT,
    "operador_responsavel_id" TEXT,
    "quantidade_concluida" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carimbos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processamentos_maquina" (
    "id" TEXT NOT NULL,
    "op_lote_id" TEXT NOT NULL,
    "maquina_id" TEXT NOT NULL,
    "carimbo_id" TEXT NOT NULL,
    "programador_id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "status" "StatusProcessamento" NOT NULL DEFAULT 'rodando',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processamentos_maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apontamentos_turno" (
    "id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "producao" JSONB NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apontamentos_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspecoes_op" (
    "id" TEXT NOT NULL,
    "op_lote_id" TEXT NOT NULL,
    "tipo" "TipoInspecao" NOT NULL,
    "inspetor_id" TEXT,
    "resultado" "ResultadoInspecao",
    "foto_bucket" TEXT,
    "foto_key" TEXT,
    "observacoes_gerais" TEXT,
    "timestamp_iniciada" TIMESTAMP(3),
    "timestamp_concluida" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspecoes_op_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicoes_inspecao" (
    "id" TEXT NOT NULL,
    "inspecao_op_id" TEXT NOT NULL,
    "cota_inspecao_id" TEXT NOT NULL,
    "numero_peca_inspecionada" INTEGER NOT NULL,
    "valor_medido" DOUBLE PRECISION NOT NULL,
    "dentro_tolerancia" BOOLEAN NOT NULL,
    "inspetor_id" TEXT NOT NULL,
    "observacoes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicoes_inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controles_volume" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "numero_peca" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "volume_solicitado" DOUBLE PRECISION NOT NULL,
    "volume_encontrado" DOUBLE PRECISION NOT NULL,
    "correcao_necessaria" DOUBLE PRECISION NOT NULL,
    "temperatura" DOUBLE PRECISION,
    "horario_entrada" TIMESTAMP(3) NOT NULL,
    "horario_saida" TIMESTAMP(3),
    "responsavel_id" TEXT NOT NULL,
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controles_volume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_os" (
    "id" TEXT NOT NULL,
    "os_id" TEXT NOT NULL,
    "lote_id" TEXT,
    "tipo" "TipoEventoOS" NOT NULL,
    "autor_id" TEXT,
    "payload" JSONB,
    "visivel_dashboard" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "severidade" "SeveridadeAlerta" NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "canal" "CanalAlerta" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviado_em" TIMESTAMP(3),
    "visualizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_codigo_pessoal_key" ON "pessoas"("codigo_pessoal");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_ordem_padrao_key" ON "etapas"("ordem_padrao");

-- CreateIndex
CREATE UNIQUE INDEX "maquinas_codigo_interno_key" ON "maquinas"("codigo_interno");

-- CreateIndex
CREATE UNIQUE INDEX "artigos_codigo_key" ON "artigos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "operacoes_artigo_artigo_id_codigo_op_key" ON "operacoes_artigo"("artigo_id", "codigo_op");

-- CreateIndex
CREATE UNIQUE INDEX "planos_inspecao_operacao_artigo_id_key" ON "planos_inspecao"("operacao_artigo_id");

-- CreateIndex
CREATE UNIQUE INDEX "oses_codigo_grv_key" ON "oses"("codigo_grv");

-- CreateIndex
CREATE UNIQUE INDEX "processamentos_maquina_carimbo_id_key" ON "processamentos_maquina"("carimbo_id");

-- CreateIndex
CREATE UNIQUE INDEX "apontamentos_turno_operador_id_data_key" ON "apontamentos_turno"("operador_id", "data");

-- CreateIndex
CREATE INDEX "eventos_os_os_id_timestamp_idx" ON "eventos_os"("os_id", "timestamp");

-- AddForeignKey
ALTER TABLE "maquinas" ADD CONSTRAINT "maquinas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artigos" ADD CONSTRAINT "artigos_cliente_padrao_id_fkey" FOREIGN KEY ("cliente_padrao_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artigos" ADD CONSTRAINT "artigos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desenhos" ADD CONSTRAINT "desenhos_artigo_id_fkey" FOREIGN KEY ("artigo_id") REFERENCES "artigos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacoes_artigo" ADD CONSTRAINT "operacoes_artigo_artigo_id_fkey" FOREIGN KEY ("artigo_id") REFERENCES "artigos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacoes_artigo" ADD CONSTRAINT "operacoes_artigo_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_inspecao" ADD CONSTRAINT "planos_inspecao_operacao_artigo_id_fkey" FOREIGN KEY ("operacao_artigo_id") REFERENCES "operacoes_artigo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotas_inspecao" ADD CONSTRAINT "cotas_inspecao_plano_inspecao_id_fkey" FOREIGN KEY ("plano_inspecao_id") REFERENCES "planos_inspecao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oses" ADD CONSTRAINT "oses_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oses" ADD CONSTRAINT "oses_artigo_id_fkey" FOREIGN KEY ("artigo_id") REFERENCES "artigos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oses" ADD CONSTRAINT "oses_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "oses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_lote" ADD CONSTRAINT "ops_lote_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_lote" ADD CONSTRAINT "ops_lote_operacao_artigo_id_fkey" FOREIGN KEY ("operacao_artigo_id") REFERENCES "operacoes_artigo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_lote" ADD CONSTRAINT "ops_lote_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_op_lote_id_fkey" FOREIGN KEY ("op_lote_id") REFERENCES "ops_lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_programador_id_fkey" FOREIGN KEY ("programador_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carimbos" ADD CONSTRAINT "carimbos_operador_responsavel_id_fkey" FOREIGN KEY ("operador_responsavel_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processamentos_maquina" ADD CONSTRAINT "processamentos_maquina_op_lote_id_fkey" FOREIGN KEY ("op_lote_id") REFERENCES "ops_lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processamentos_maquina" ADD CONSTRAINT "processamentos_maquina_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processamentos_maquina" ADD CONSTRAINT "processamentos_maquina_carimbo_id_fkey" FOREIGN KEY ("carimbo_id") REFERENCES "carimbos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processamentos_maquina" ADD CONSTRAINT "processamentos_maquina_programador_id_fkey" FOREIGN KEY ("programador_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processamentos_maquina" ADD CONSTRAINT "processamentos_maquina_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apontamentos_turno" ADD CONSTRAINT "apontamentos_turno_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecoes_op" ADD CONSTRAINT "inspecoes_op_op_lote_id_fkey" FOREIGN KEY ("op_lote_id") REFERENCES "ops_lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecoes_op" ADD CONSTRAINT "inspecoes_op_inspetor_id_fkey" FOREIGN KEY ("inspetor_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes_inspecao" ADD CONSTRAINT "medicoes_inspecao_inspecao_op_id_fkey" FOREIGN KEY ("inspecao_op_id") REFERENCES "inspecoes_op"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes_inspecao" ADD CONSTRAINT "medicoes_inspecao_cota_inspecao_id_fkey" FOREIGN KEY ("cota_inspecao_id") REFERENCES "cotas_inspecao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicoes_inspecao" ADD CONSTRAINT "medicoes_inspecao_inspetor_id_fkey" FOREIGN KEY ("inspetor_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_volume" ADD CONSTRAINT "controles_volume_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controles_volume" ADD CONSTRAINT "controles_volume_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_os" ADD CONSTRAINT "eventos_os_os_id_fkey" FOREIGN KEY ("os_id") REFERENCES "oses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_os" ADD CONSTRAINT "eventos_os_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_os" ADD CONSTRAINT "eventos_os_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "pessoas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
