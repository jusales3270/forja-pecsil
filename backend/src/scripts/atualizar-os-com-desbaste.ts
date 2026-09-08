import { prisma } from '../db/prisma.js';

async function main() {
  console.log('Atualizando OS-TEST-FUND-01 para incluir toda a linha de usinagem após a Engenharia...');

  const os = await prisma.oS.findUnique({
    where: { codigoGrv: 'OS-TEST-FUND-01' },
    include: {
      artigo: true,
      lotes: {
        include: {
          opsLote: {
            orderBy: { ordem: 'asc' },
          },
        },
      },
    },
  });

  if (!os || os.lotes.length === 0) {
    throw new Error('OS-TEST-FUND-01 não encontrada');
  }

  const lote = os.lotes[0];

  // 1. Remove qualquer OP a partir da 80 (antiga qualidade)
  const opsAntigasParaRemover = lote.opsLote.filter((o) => Number.parseInt(o.codigoOp, 10) >= 80);
  for (const o of opsAntigasParaRemover) {
    await prisma.apontamentoPeca.deleteMany({ where: { opLoteId: o.id } });
    await prisma.paradaMaquina.deleteMany({ where: { carimbo: { opLoteId: o.id } } });
    await prisma.processamentoMaquina.deleteMany({ where: { carimbo: { opLoteId: o.id } } });
    await prisma.carimbo.deleteMany({ where: { opLoteId: o.id } });
    await prisma.oPLote.delete({ where: { id: o.id } });
  }

  // 2. Busca os tipos de serviço para as etapas seguintes
  const codigos = [25, 10, 26, 30, 13, 18];
  const tipos = await prisma.tipoServico.findMany({
    where: { codigo: { in: codigos } },
  });
  const porCodigo = new Map(tipos.map((t) => [t.codigo!, t]));

  const novasOperacoes = [
    {
      codigoOp: '80',
      codigoTipoServico: 25,
      observacoes: 'DESBASTE PARA METALIZAÇÃO',
      tempoUnitMin: 15,
      exigeInspecao: false,
    },
    {
      codigoOp: '90',
      codigoTipoServico: 10,
      observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________',
      tempoUnitMin: 10,
      exigeInspecao: false,
    },
    {
      codigoOp: '100',
      codigoTipoServico: 26,
      observacoes: 'ENCAIXE E ARREDONDAMENTO',
      tempoUnitMin: 15,
      exigeInspecao: false,
    },
    {
      codigoOp: '110',
      codigoTipoServico: 30,
      observacoes: 'CÉLULA DE TORNEAMENTO DE BLOCOS',
      tempoUnitMin: 20,
      exigeInspecao: false,
    },
    {
      codigoOp: '120',
      codigoTipoServico: 13,
      observacoes: 'POLIMENTO / ACABAMENTO',
      tempoUnitMin: 10,
      exigeInspecao: false,
    },
    {
      codigoOp: '130',
      codigoTipoServico: 18,
      observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
      tempoUnitMin: 10,
      exigeInspecao: true,
    },
  ];

  let ordemAtual = 7;
  for (const opDef of novasOperacoes) {
    const tipo = porCodigo.get(opDef.codigoTipoServico)!;

    // Busca ou cria operacaoArtigo correspondente
    let operacaoArtigo = await prisma.operacaoArtigo.findFirst({
      where: {
        artigoId: os.artigoId,
        codigoOp: opDef.codigoOp,
      },
    });

    if (!operacaoArtigo) {
      operacaoArtigo = await prisma.operacaoArtigo.create({
        data: {
          artigoId: os.artigoId,
          etapaId: tipo.etapaId,
          tipoServicoId: tipo.id,
          codigoOp: opDef.codigoOp,
          ordem: ordemAtual,
          tipoServico: tipo.nome,
          tempoUnitMin: opDef.tempoUnitMin,
          tempoSetupMin: 0,
          exigeInspecao: opDef.exigeInspecao,
          observacoes: opDef.observacoes,
        },
      });
    }

    await prisma.oPLote.create({
      data: {
        loteId: lote.id,
        operacaoArtigoId: operacaoArtigo.id,
        etapaId: tipo.etapaId,
        ordem: ordemAtual,
        tempoUnitPlanejado: opDef.tempoUnitMin,
        tempoTotalPlanejado: opDef.tempoUnitMin * lote.quantidadePecas,
        codigoOp: opDef.codigoOp,
        tipoServico: tipo.nome,
        exigeInspecao: opDef.exigeInspecao,
        status: 'na_fila',
        quantidadeConcluida: 0,
        observacoes: opDef.observacoes,
      },
    });

    ordemAtual++;
  }

  console.log('\n=============================================');
  console.log('✅ OS-TEST-FUND-01 ATUALIZADA COM SUCESSO!');
  console.log('As OPs 10 a 70 permanecem concluídas pelo teste que você acabou de fazer.');
  console.log('A OP 80 (DESBASTE) está liberada AGORA na estação DESBASTE com as 3 peças!');
  console.log('\nSequência completa atualizada:');
  const osAtualizada = await prisma.oS.findUnique({
    where: { id: os.id },
    include: {
      lotes: {
        include: {
          opsLote: {
            orderBy: { ordem: 'asc' },
            include: { etapa: true },
          },
        },
      },
    },
  });

  for (const op of osAtualizada!.lotes[0].opsLote) {
    console.log(
      `  - Op ${op.codigoOp} [${op.tipoServico}] -> Etapa: "${op.etapa.nome}" | Status: ${op.status} | Concluídas: ${op.quantidadeConcluida}/${lote.quantidadePecas}`,
    );
  }
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('Erro ao atualizar:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
