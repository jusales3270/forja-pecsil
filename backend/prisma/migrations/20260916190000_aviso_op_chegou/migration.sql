-- Aviso de chegada: cada peça segue o roteiro do PCP, e a estação que recebe
-- a OS é avisada. Só adiciona o valor ao enum; não altera dados existentes.
ALTER TYPE "TipoAlerta" ADD VALUE 'op_chegou';
