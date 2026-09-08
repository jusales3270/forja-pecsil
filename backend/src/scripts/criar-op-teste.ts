// ============================================================
// Script para criar OS e OP teste com fluxo completo da Fundição
// (Modelação -> Moldagem -> Vazamento -> Rebarbação -> Tratamento Térmico -> Engenharia)
// ============================================================

import { prisma } from '../db/prisma.js';
import { buscarRoteiroPadrao, PASSO_SEQUENCIA } from '../data/roteiros-padrao.js';

async function main() {
  console.log('Iniciando criação da OP teste...');

  // 1. Busca ou cria cliente teste
  let cliente = await prisma.cliente.findFirst({
    where: { nome: 'CLIENTE TESTE FUNDIÇÃO' },
  });
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        nome: 'CLIENTE TESTE FUNDIÇÃO',
        ativo: true,
      },
    });
    console.log('Cliente teste criado:', cliente.id);
  }

  // 2. Busca usuário admin ou PCP para autor
  const autor = await prisma.pessoa.findFirst({
    where: { papel: { in: ['admin', 'pcp'] }, ativo: true },
  });
  if (!autor) throw new Error('Nenhum usuário admin/pcp encontrado');

  // 3. Busca ou cria artigo teste com roteiro fundicao-grv
  const codigoArtigo = 'ART-TEST-FUND-01';
  let artigo = await prisma.artigo.findFirst({
    where: { codigo: codigoArtigo, clienteId: cliente.id },
    include: { operacoes: true },
  });

  const roteiro = buscarRoteiroPadrao('fundicao-grv')!;
  if (!roteiro) throw new Error('Roteiro fundicao-grv não encontrado');

  // Tipos de serviço
  const codigos = [
    ...new Set(
      roteiro.operacoes.flatMap((o) =>
        [o.codigoTipoServico, o.avisaEtapaDoCodigoTipoServico].filter(
          (c): c is number => c != null,
        ),
      ),
    ),
  ];
  const tipos = await prisma.tipoServico.findMany({
    where: { codigo: { in: codigos }, ativo: true },
  });
  const porCodigo = new Map(tipos.map((t) => [t.codigo!, t]));

  if (!artigo) {
    artigo = await prisma.artigo.create({
      data: {
        codigo: codigoArtigo,
        descricao: 'PEÇA TESTE FUNDIÇÃO (ROTEIRO COMPLETO COM FORNO E ENGENHARIA)',
        clienteId: cliente.id,
        tipoProduto: 'fundo_forma',
        status: 'ativo',
        criadoPorId: autor.id,
      },
      include: { operacoes: true },
    });
    console.log('Artigo teste criado:', artigo.codigo);
  }

  // 4. Se a OS teste já existia, apaga primeiro pra liberar a FK
  const codigoGrvOS = 'OS-TEST-FUND-01';
  const osExistente = await prisma.oS.findUnique({
    where: { codigoGrv: codigoGrvOS },
    include: {
      lotes: {
        include: {
          opsLote: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (osExistente) {
    const opIds = osExistente.lotes.flatMap((l) => l.opsLote.map((o) => o.id));
    const loteIds = osExistente.lotes.map((l) => l.id);

    await prisma.apontamentoPeca.deleteMany({ where: { opLoteId: { in: opIds } } });
    await prisma.paradaMaquina.deleteMany({
      where: { carimbo: { opLoteId: { in: opIds } } },
    });
    await prisma.processamentoMaquina.deleteMany({
      where: { carimbo: { opLoteId: { in: opIds } } },
    });
    await prisma.carimbo.deleteMany({ where: { opLoteId: { in: opIds } } });
    await prisma.alerta.deleteMany({
      where: { entidadeTipo: 'OPLote', entidadeId: { in: opIds } },
    });
    await prisma.oPLote.deleteMany({ where: { id: { in: opIds } } });
    await prisma.eventoOS.deleteMany({ where: { osId: osExistente.id } });
    await prisma.lote.deleteMany({ where: { id: { in: loteIds } } });
    await prisma.oS.delete({ where: { id: osExistente.id } });
    console.log('OS teste antiga e registros relacionados excluídos.');
  }

  // Limpa e recria operações do artigo para garantir que estão atualizadas
  await prisma.operacaoArtigo.deleteMany({ where: { artigoId: artigo.id } });

  for (let i = 0; i < roteiro.operacoes.length; i++) {
    const op = roteiro.operacoes[i];
    const tipo = porCodigo.get(op.codigoTipoServico)!;
    const etapaAvisada = op.avisaEtapaDoCodigoTipoServico
      ? porCodigo.get(op.avisaEtapaDoCodigoTipoServico)?.etapaId ?? null
      : null;

    await prisma.operacaoArtigo.create({
      data: {
        artigoId: artigo.id,
        etapaId: tipo.etapaId,
        tipoServicoId: tipo.id,
        codigoOp: String((i + 1) * PASSO_SEQUENCIA),
        ordem: i,
        tipoServico: tipo.nome,
        tempoUnitMin: op.tempoUnitMin,
        tempoSetupMin: op.tempoSetupMin,
        exigeInspecao: op.exigeInspecao,
        avisaAoIniciar: op.avisaAoIniciar ?? false,
        etapaAvisadaId: etapaAvisada,
        exigeLoteCompleto: op.exigeLoteCompleto ?? false,
        observacoes: op.observacoes,
      },
    });
  }
  console.log('Operações do roteiro fundicao-grv atualizadas no artigo.');

  const operacoesArtigo = await prisma.operacaoArtigo.findMany({
    where: { artigoId: artigo.id },
    orderBy: { ordem: 'asc' },
  });

  const prazoEntrega = new Date();
  prazoEntrega.setDate(prazoEntrega.getDate() + 7);

  const quantidadePecas = 3;

  const os = await prisma.$transaction(async (tx) => {
    const novaOS = await tx.oS.create({
      data: {
        codigoGrv: codigoGrvOS,
        clienteId: cliente.id,
        artigoId: artigo.id,
        quantidadeTotal: quantidadePecas,
        prazoEntrega,
        prioridade: 'normal',
        status: 'aberta',
        observacoes: 'OS de teste para validação do fluxo sequencial da Fundição -> Tratamento Térmico -> Engenharia -> Qualidade',
        criadoPorId: autor.id,
      },
    });

    const lote = await tx.lote.create({
      data: {
        osId: novaOS.id,
        numeroLote: 1,
        quantidadePecas,
        status: 'na_fila',
      },
    });

    for (const op of operacoesArtigo) {
      // Começa 100% no início da Fundição (Modelação - OP 10)
      const jaConcluida = false;

      await tx.oPLote.create({
        data: {
          loteId: lote.id,
          operacaoArtigoId: op.id,
          etapaId: op.etapaId,
          ordem: op.ordem,
          tempoUnitPlanejado: op.tempoUnitMin,
          tempoTotalPlanejado: op.tempoUnitMin * quantidadePecas,
          codigoOp: op.codigoOp,
          tipoServico: op.tipoServico,
          exigeInspecao: op.exigeInspecao,
          avisaAoIniciar: op.avisaAoIniciar,
          etapaAvisadaId: op.etapaAvisadaId,
          exigeLoteCompleto: op.exigeLoteCompleto,
          status: 'na_fila',
          quantidadeConcluida: 0,
          observacoes: op.observacoes,
        },
      });
    }

    await tx.eventoOS.create({
      data: {
        osId: novaOS.id,
        loteId: lote.id,
        tipo: 'os_criada',
        autorId: autor.id,
        payload: { codigoGrv: codigoGrvOS, quantidadePecas },
      },
    });

    return tx.oS.findUnique({
      where: { id: novaOS.id },
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
  });

  console.log('\n=============================================');
  console.log('✅ OS TESTE ATUALIZADA COM SUCESSO!');
  console.log(`OS: ${os!.codigoGrv}`);
  console.log(`Artigo: ${artigo.codigo} - ${artigo.descricao}`);
  console.log(`Lote 1: ${quantidadePecas} peças`);
  console.log('\nSequência de OPs:');
  for (const op of os!.lotes[0].opsLote) {
    console.log(
      `  - Op ${op.codigoOp} [${op.tipoServico}] -> Etapa: "${op.etapa.nome}" | Status: ${op.status} | Concluídas: ${op.quantidadeConcluida}/${quantidadePecas} ${op.avisaAoIniciar ? '🔔 (Avisa Engenharia ao iniciar)' : ''}`,
    );
  }
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('Erro ao criar OP teste:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
