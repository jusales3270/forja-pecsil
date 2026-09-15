// Execução administrativa explícita; nunca roda no startup, seed ou migration.
// No terminal do backend: node ops/create-metalizacao-demo.mjs --autor-nome "Junior Sales"
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const autorNome = args[0] === '--autor-nome' && args.length === 2 ? args[1] : null;
if (!autorNome) {
  console.error('Uso: node ops/create-metalizacao-demo.mjs --autor-nome "Nome exato do responsável"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada. Execute no container do backend.');
const prisma = new PrismaClient();
const codigo = 'OS-DEMO-MET-001';
const marca = 'DEMONSTRACAO_METALIZACAO_20260915';
try {
  const resultado = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(20260915, 1001)`;
    const autores = await tx.pessoa.findMany({ where: { nome: { equals: autorNome, mode: 'insensitive' }, ativo: true }, select: { id: true, papel: true, etapaId: true } });
    if (autores.length !== 1) throw new Error('Informe o nome exato de um único usuário ativo. Nenhum registro foi criado.');
    const autor = autores[0];
    const tipos = await tx.tipoServico.findMany({ where: { codigo: { in: [10, 26] }, ativo: true }, include: { etapa: true } });
    const metal = tipos.find(t => t.codigo === 10);
    const seguinte = tipos.find(t => t.codigo === 26);
    if (!metal || !seguinte || !/metaliza/i.test(metal.etapa.nome)) throw new Error('Catálogo de Metalização/Encaixe não encontrado. Nenhum registro foi criado.');
    const permitido = ['admin', 'pcp'].includes(autor.papel) || (autor.papel === 'programador' && (!autor.etapaId || autor.etapaId === metal.etapaId)) || (autor.papel === 'estacao' && autor.etapaId === metal.etapaId);
    if (!permitido) throw new Error('O responsável precisa ter permissão para operar a Metalização.');
    const existente = await tx.oS.findUnique({ where: { codigoGrv: codigo } });
    if (existente) {
      if (existente.observacoes !== marca) throw new Error('Código já utilizado por outra OS. Nenhum registro foi alterado.');
      return { mensagem: 'A demonstração já existe; seu andamento foi preservado.', codigoGrv: codigo, status: existente.status };
    }
    const cliente = await tx.cliente.create({ data: { nome: 'DEMONSTRAÇÃO — Metalização', observacoes: marca } });
    const artigo = await tx.artigo.create({ data: {
      codigo: 'ART-DEMO-MET-001', descricao: 'PEÇA DE DEMONSTRAÇÃO — NÃO PRODUZIR', tipoProduto: 'forma',
      clienteId: cliente.id, criadoPorId: autor.id, status: 'ativo', observacoes: marca,
    } });
    const operacoes = [];
    for (const [i, tipo] of [metal, seguinte].entries()) {
      operacoes.push(await tx.operacaoArtigo.create({ data: {
        artigoId: artigo.id, etapaId: tipo.etapaId, tipoServicoId: tipo.id,
        ordem: i, codigoOp: String((i + 1) * 10), tipoServico: tipo.nome,
        tempoUnitMin: 1, exigeInspecao: false, observacoes: marca,
      } }));
    }
    const prazo = new Date(); prazo.setUTCDate(prazo.getUTCDate() + 7);
    const os = await tx.oS.create({ data: {
      codigoGrv: codigo, clienteId: cliente.id, artigoId: artigo.id, criadoPorId: autor.id,
      quantidadeTotal: 5, prazoEntrega: prazo, observacoes: marca,
      lotes: { create: { numeroLote: 1, quantidadePecas: 5, observacoes: marca,
        opsLote: { create: operacoes.map(op => ({
          operacaoArtigoId: op.id, etapaId: op.etapaId, ordem: op.ordem, codigoOp: op.codigoOp,
          tipoServico: op.tipoServico, tempoUnitPlanejado: 1, tempoTotalPlanejado: 5, observacoes: marca,
        })) },
      } },
    } });
    await tx.eventoOS.create({ data: { osId: os.id, autorId: autor.id, tipo: 'os_criada', payload: { acao: 'demonstracao_metalizacao', quantidadeTotal: 5, observacoes: 'Demonstração solicitada para visualizar a escolha interna/externa. Não produzir peças.' } } });
    return { mensagem: 'Demonstração criada na fila da Metalização.', codigoGrv: codigo, pecas: 5, proximaEtapa: seguinte.etapa.nome };
  });
  console.log(JSON.stringify(resultado, null, 2));
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
