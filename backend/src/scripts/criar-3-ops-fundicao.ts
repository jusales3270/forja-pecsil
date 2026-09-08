// ============================================================
// Script para criar 3 novas OSs / OPs iniciando na Fundição
// com a linha de produção completa de 13 operações:
// Fundição -> Tratamento Térmico -> Engenharia -> Desbaste ->
// Metalização -> Encaixe -> Torno -> Acabamento -> Qualidade Final
// ============================================================

import { prisma } from '../db/prisma.js';
import { buscarRoteiroPadrao, PASSO_SEQUENCIA } from '../data/roteiros-padrao.js';

async function main() {
  console.log('Iniciando criação de 3 novas OPs na Fundição...');

  // 1. Cliente teste
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
  }

  // 2. Autor admin/pcp
  const autor = await prisma.pessoa.findFirst({
    where: { papel: { in: ['admin', 'pcp'] }, ativo: true },
  });
  if (!autor) throw new Error('Nenhum usuário admin/pcp encontrado');

  // 3. Roteiro fundicao-grv (13 operações completas)
  const roteiro = buscarRoteiroPadrao('fundicao-grv')!;
  if (!roteiro) throw new Error('Roteiro fundicao-grv não encontrado');

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

  // Definição das 3 novas OSs
  const listaNovasOS = [
    {
      codigoGrv: 'OS-TEST-FUND-02',
      artigoCodigo: 'ART-TEST-FUND-02',
      artigoDescricao: 'FORMA BL 600ML FOFO 96A',
      tipoProduto: 'forma',
      quantidadePecas: 2,
      prioridade: 'normal' as const,
    },
    {
      codigoGrv: 'OS-TEST-FUND-03',
      artigoCodigo: 'ART-TEST-FUND-03',
      artigoDescricao: 'FUNDO FORMA CERVEJA 350ML',
      tipoProduto: 'fundo_forma',
      quantidadePecas: 4,
      prioridade: 'urgente' as const,
    },
    {
      codigoGrv: 'OS-TEST-FUND-04',
      artigoCodigo: 'ART-TEST-FUND-04',
      artigoDescricao: 'BLOCO MOLDE REFRIGERANTE 500ML',
      tipoProduto: 'bloco' as const,
      quantidadePecas: 5,
      prioridade: 'normal' as const,
    },
  ];

  const prazoEntrega = new Date();
  prazoEntrega.setDate(prazoEntrega.getDate() + 10);

  const ossCriadas = [];

  for (const def of listaNovasOS) {
    // 4. Se a OS já existia de teste anterior, limpa
    const osExistente = await prisma.oS.findUnique({
      where: { codigoGrv: def.codigoGrv },
      include: {
        lotes: {
          include: {
            opsLote: { select: { id: true } },
          },
        },
      },
    });

    if (osExistente) {
      const opIds = osExistente.lotes.flatMap((l) => l.opsLote.map((o) => o.id));
      const loteIds = osExistente.lotes.map((l) => l.id);

      await prisma.apontamentoPeca.deleteMany({ where: { opLoteId: { in: opIds } } });
      await prisma.paradaMaquina.deleteMany({ where: { carimbo: { opLoteId: { in: opIds } } } });
      await prisma.processamentoMaquina.deleteMany({ where: { carimbo: { opLoteId: { in: opIds } } } });
      await prisma.carimbo.deleteMany({ where: { opLoteId: { in: opIds } } });
      await prisma.alerta.deleteMany({
        where: {
          OR: [
            { entidadeTipo: 'OPLote', entidadeId: { in: opIds } },
            { entidadeTipo: 'OS', entidadeId: osExistente.id },
          ],
        },
      });
      await prisma.oPLote.deleteMany({ where: { id: { in: opIds } } });
      await prisma.eventoOS.deleteMany({ where: { osId: osExistente.id } });
      await prisma.lote.deleteMany({ where: { id: { in: loteIds } } });
      await prisma.oS.delete({ where: { id: osExistente.id } });
    }

    // 5. Busca ou cria o Artigo
    let artigo = await prisma.artigo.findFirst({
      where: { codigo: def.artigoCodigo, clienteId: cliente.id },
      include: { operacoes: true },
    });

    if (!artigo) {
      artigo = await prisma.artigo.create({
        data: {
          codigo: def.artigoCodigo,
          descricao: def.artigoDescricao,
          clienteId: cliente.id,
          tipoProduto: def.tipoProduto,
          status: 'ativo',
          criadoPorId: autor.id,
        },
        include: { operacoes: true },
      });
    }

    // Garante as 13 operações no artigo
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

    const operacoesArtigo = await prisma.operacaoArtigo.findMany({
      where: { artigoId: artigo.id },
      orderBy: { ordem: 'asc' },
    });

    // 6. Cria OS, Lote e as 13 OPs todas no estado inicial (Modelação pronta em Pendentes)
    const novaOS = await prisma.$transaction(async (tx) => {
      const osCriada = await tx.oS.create({
        data: {
          codigoGrv: def.codigoGrv,
          clienteId: cliente.id,
          artigoId: artigo.id,
          quantidadeTotal: def.quantidadePecas,
          prazoEntrega,
          prioridade: def.prioridade,
          status: 'aberta',
          observacoes: `OS Teste ${def.codigoGrv} - Linha Completa Fundição até Qualidade`,
          criadoPorId: autor.id,
        },
      });

      const lote = await tx.lote.create({
        data: {
          osId: osCriada.id,
          numeroLote: 1,
          quantidadePecas: def.quantidadePecas,
          status: 'na_fila',
        },
      });

      for (const op of operacoesArtigo) {
        await tx.oPLote.create({
          data: {
            loteId: lote.id,
            operacaoArtigoId: op.id,
            etapaId: op.etapaId,
            ordem: op.ordem,
            tempoUnitPlanejado: op.tempoUnitMin,
            tempoTotalPlanejado: op.tempoUnitMin * def.quantidadePecas,
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
          osId: osCriada.id,
          loteId: lote.id,
          tipo: 'os_criada',
          autorId: autor.id,
          payload: { codigoGrv: def.codigoGrv, quantidadePecas: def.quantidadePecas },
        },
      });

      return osCriada;
    });

    ossCriadas.push(novaOS);
    console.log(`OS ${def.codigoGrv} criada com sucesso (${def.quantidadePecas} peças, prioridade: ${def.prioridade}).`);
  }

  console.log('\n=============================================');
  console.log('✅ 3 NOVAS OPs CRIADAS COM SUCESSO NA FUNDIÇÃO!');
  for (const os of ossCriadas) {
    console.log(` - OS: ${os.codigoGrv} | Status: ${os.status} | Prazo: ${os.prazoEntrega.toLocaleDateString('pt-BR')}`);
  }
  console.log('Todas as 3 OSs estão disponíveis na aba "Modelação" em Pendentes na estação Fundição.');
  console.log('=============================================\n');
}

main()
  .catch((e) => {
    console.error('Erro ao criar novas OPs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
