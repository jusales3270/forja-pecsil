ALTER TABLE "ops_lote"
  ADD COLUMN "envio_externo_em" TIMESTAMP(3),
  ADD COLUMN "recebimento_externo_em" TIMESTAMP(3),
  ADD COLUMN "quantidade_envio_externo" INTEGER;
ALTER TABLE "ops_lote" ADD CONSTRAINT "envio_externo_consistente" CHECK (
  ("envio_externo_em" IS NULL AND "recebimento_externo_em" IS NULL AND "quantidade_envio_externo" IS NULL)
  OR ("envio_externo_em" IS NOT NULL AND "quantidade_envio_externo" IS NOT NULL AND "quantidade_envio_externo" > 0)
);
