-- Fases internas de uma etapa (fundição) + alerta ao iniciar operação longa.
--
-- ordem_na_etapa: posição do tipo de serviço dentro da etapa. Nulo = etapa de
-- processo único (todas as etapas de usinagem). Só a fundição recebe 1..5.
--
-- avisa_ao_iniciar / alerta_inicio_em: par simétrico ao gatilho de peças que já
-- existe. Serve ao tratamento térmico, cujo ciclo de ~3 dias é a janela em que a
-- engenharia programa o desbaste.
--
-- Postgres 16 em dev e produção: ADD VALUE em enum roda dentro da transação da
-- migration sem problema, já que os valores novos não são usados aqui.

-- AlterEnum
ALTER TYPE "TipoAlerta" ADD VALUE 'parcial_pronta';
ALTER TYPE "TipoAlerta" ADD VALUE 'fase_iniciada';

-- AlterTable
ALTER TABLE "operacoes_artigo" ADD COLUMN     "avisa_ao_iniciar" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ops_lote" ADD COLUMN     "alerta_inicio_em" TIMESTAMP(3),
ADD COLUMN     "avisa_ao_iniciar" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tipos_servico" ADD COLUMN     "ordem_na_etapa" INTEGER;
