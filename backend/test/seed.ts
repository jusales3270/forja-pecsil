// Catálogo sintético mínimo para a suíte HTTP; não carrega dados da empresa.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

assert.equal(process.env.NODE_ENV, 'test', 'Fixtures exigem NODE_ENV=test.');
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'),
  'Fixtures exigem um banco descartável terminado em _test.');

const catalogo: [string, [number, string][]][] = [
  ['Fundição', [[20, 'MODELAÇÃO'], [15, 'MOLDAGEM'], [17, 'VAZAMENTO'],
    [7, 'REBARBAÇÃO FUNDIÇÃO'], [50, 'TRATAMENTO TÉRMICO'],
    [51, 'CURA DO MOLDE'], [52, 'RESFRIAMENTO'], [53, 'RETORNO DA REBARBAÇÃO']]],
  ['Engenharia / Programação', [[36, 'ENG. / PROG. CENTRO'], [37, 'ENG. / PROG. TORNO']]],
  ['Desbaste', [[25, 'DESBASTE PARA METALIZAÇÃO'], [8, 'CENTROS VERTICAIS'], [12, 'CORTE EM SERRA']]],
  ['Metalização', [[10, 'METALIZAÇÃO']]],
  ['Encaixe e Arredondamento', [[26, 'ENCAIXE E ARREDONDAMENTO'], [34, 'ACABAMENTO CAVIDADE']]],
  ['Torno', [[21, 'TORNOS 5 EIXOS - INTEGREX'], [29, 'TORNEAMENTO EXTERNO'],
    [30, 'TORNEAMENTO DE BLOCOS'], [31, 'TORNEAMENTO DE FORMAS'], [32, 'TORNEAMENTO DE ARRUELAS']]],
  ['Furação Vertiflow', [[23, 'VERTFLOW / GRAVAÇÃO']]],
  ['Rebaixo e Gravação', [[22, 'FACEAMENTO E FURAÇÕES'], [28, 'FRESAMENTO / GRAVAÇÃO']]],
  ['Chaveta', [[27, 'CORTE LATERAL'], [33, 'REBAIXO / CHAVETA']]],
  ['Acabamento / Polimento', [[11, 'USINAGEM CONVENCIONAL'], [13, 'POLIMENTO / ACABAMENTO'],
    [14, 'MONTAGEM E AJUSTES']]],
  ['Qualidade Final', [[18, 'CONTROLE DE QUALIDADE']]],
];

const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    assert.equal(await tx.etapa.count(), 0, 'O catálogo de teste deve estar vazio.');
    for (const [index, [nome, servicos]] of catalogo.entries()) {
      const etapa = await tx.etapa.create({ data: {
        nome, ordemPadrao: index + 1, slaHoras: 24,
        aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      } });
      await tx.tipoServico.createMany({ data: servicos.map(([codigo, nome]) => ({
        codigo, nome, etapaId: etapa.id,
      })) });
    }
  });
  console.log('Catálogo sintético de etapas e serviços pronto para os testes.');
} finally {
  await prisma.$disconnect();
}
