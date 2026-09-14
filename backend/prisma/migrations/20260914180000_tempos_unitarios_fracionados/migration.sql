-- Preserva os 4min30s do roteiro de bronze no artigo e no snapshot da OP.
ALTER TABLE "operacoes_artigo"
  ALTER COLUMN "tempo_unit_min" TYPE DOUBLE PRECISION;

ALTER TABLE "ops_lote"
  ALTER COLUMN "tempo_unit_planejado" TYPE DOUBLE PRECISION,
  ALTER COLUMN "tempo_total_planejado" TYPE DOUBLE PRECISION;
