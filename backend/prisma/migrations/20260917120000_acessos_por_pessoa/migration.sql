-- Acessos por usuário: o admin libera ou retira módulos de cada pessoa da
-- área administrativa. Contas existentes seguem o padrão do papel.
ALTER TABLE "pessoas"
  ADD COLUMN "acessos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "acessos_personalizados" BOOLEAN NOT NULL DEFAULT false;
