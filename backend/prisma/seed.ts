// ============================================================
// Forja - Seed v2.0
// Cadastros iniciais: pessoas, clientes, etapas, máquinas
// Artigos NÃO entram aqui - são cadastrados pelo PCP no Sprint 2a
// ============================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed v2 do banco Forja...');

  // ===========================
  // LIMPEZA (ordem reversa de dependência)
  // ===========================
  console.log('🧹 Limpando banco...');
  await prisma.alerta.deleteMany();
  await prisma.eventoOS.deleteMany();
  await prisma.controleVolume.deleteMany();
  await prisma.medicaoInspecao.deleteMany();
  await prisma.inspecaoOP.deleteMany();
  await prisma.apontamentoTurno.deleteMany();
  await prisma.processamentoMaquina.deleteMany();
  await prisma.carimbo.deleteMany();
  await prisma.oPLote.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.oS.deleteMany();
  await prisma.cotaInspecao.deleteMany();
  await prisma.planoInspecao.deleteMany();
  await prisma.operacaoArtigo.deleteMany();
  await prisma.desenho.deleteMany();
  await prisma.artigo.deleteMany();
  await prisma.maquina.deleteMany();
  await prisma.etapa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.pessoa.deleteMany();

  // ===========================
  // PESSOAS
  // ===========================
  console.log('👥 Criando pessoas...');

  const hashPin = async (pin: string) => bcrypt.hash(pin, 10);

  const pessoas = await Promise.all([
    prisma.pessoa.create({
      data: {
        nome: 'Administrador',
        codigoPessoal: '0001',
        pinHash: await hashPin('1234'),
        papel: 'admin',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Chefe',
        codigoPessoal: '0002',
        pinHash: await hashPin('1234'),
        papel: 'chefe',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'PCP',
        codigoPessoal: '0003',
        pinHash: await hashPin('1234'),
        papel: 'pcp',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Programador 1',
        codigoPessoal: '0010',
        pinHash: await hashPin('1234'),
        papel: 'programador',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Programador 2',
        codigoPessoal: '0011',
        pinHash: await hashPin('1234'),
        papel: 'programador',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Operador 1',
        codigoPessoal: '0020',
        pinHash: await hashPin('1234'),
        papel: 'operador',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Operador 2',
        codigoPessoal: '0021',
        pinHash: await hashPin('1234'),
        papel: 'operador',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Inspetor 1',
        codigoPessoal: '0030',
        pinHash: await hashPin('1234'),
        papel: 'inspetor',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Inspetor 2',
        codigoPessoal: '0031',
        pinHash: await hashPin('1234'),
        papel: 'inspetor',
      },
    }),
    prisma.pessoa.create({
      data: {
        nome: 'Embalador',
        codigoPessoal: '0040',
        pinHash: await hashPin('1234'),
        papel: 'embalador',
      },
    }),
  ]);

  console.log(`  ✓ ${pessoas.length} pessoas criadas`);

  // ===========================
  // CLIENTES
  // ===========================
  console.log('🏢 Criando clientes...');

  const clientes = await Promise.all([
    prisma.cliente.create({ data: { nome: 'Verallia / Saint-Gobain - Campo Bom' } }),
    prisma.cliente.create({ data: { nome: 'Owens-Illinois (Argentina)' } }),
    prisma.cliente.create({ data: { nome: 'Nadir' } }),
    prisma.cliente.create({ data: { nome: 'On' } }),
  ]);

  console.log(`  ✓ ${clientes.length} clientes criados`);

  // ===========================
  // ETAPAS (alto nível, agrupam OPs)
  // ===========================
  console.log('🔄 Criando etapas do fluxo...');

  const etapasData = [
    {
      nome: 'Engenharia / Programação',
      ordemPadrao: 1,
      slaHoras: 24,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Fundição',
      ordemPadrao: 2,
      slaHoras: 168, // 7 dias
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Desbaste',
      ordemPadrao: 3,
      slaHoras: 48,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Metalização',
      ordemPadrao: 4,
      slaHoras: 24,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Encaixe e Arredondamento',
      ordemPadrao: 5,
      slaHoras: 24,
      aplicaParaTipos: ['forma', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Torno',
      ordemPadrao: 6,
      slaHoras: 48,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: true,
    },
    {
      nome: 'Furação Vertiflow',
      ordemPadrao: 7,
      slaHoras: 24,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Rebaixo e Gravação',
      ordemPadrao: 8,
      slaHoras: 24,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Chaveta',
      ordemPadrao: 9,
      slaHoras: 12,
      aplicaParaTipos: ['forma', 'bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Acabamento / Polimento',
      ordemPadrao: 10,
      slaHoras: 12,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
    {
      nome: 'Qualidade Final',
      ordemPadrao: 11,
      slaHoras: 12,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: true,
    },
    {
      nome: 'Embalagem',
      ordemPadrao: 12,
      slaHoras: 12,
      aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
      exigeCheckpointQualidade: false,
    },
  ];

  const etapas = await Promise.all(
    etapasData.map((e) => prisma.etapa.create({ data: e }))
  );

  console.log(`  ✓ ${etapas.length} etapas criadas`);

  // Helper pra achar etapa por nome
  const e = (nome: string) => {
    const found = etapas.find((x) => x.nome === nome);
    if (!found) throw new Error(`Etapa não encontrada: ${nome}`);
    return found;
  };

  // ===========================
  // MÁQUINAS
  // ===========================
  console.log('🏭 Criando máquinas...');

  const maquinas = await Promise.all([
    // Engenharia/Programação (PC dos programadores)
    prisma.maquina.create({
      data: { nome: 'PC Engenharia', codigoInterno: 'PC-ENG-01', tipo: 'outros', etapaId: e('Engenharia / Programação').id },
    }),
    // Fundição (PC dos programadores da fundição)
    prisma.maquina.create({
      data: { nome: 'PC Fundição', codigoInterno: 'PC-FUND-01', tipo: 'fundicao', etapaId: e('Fundição').id },
    }),
    // Desbaste
    prisma.maquina.create({
      data: { nome: 'Desbaste 01', codigoInterno: 'DESB-01', tipo: 'tres_eixos', etapaId: e('Desbaste').id },
    }),
    prisma.maquina.create({
      data: { nome: 'Desbaste 02', codigoInterno: 'DESB-02', tipo: 'tres_eixos', etapaId: e('Desbaste').id },
    }),
    // Metalização (terceirizada — registrada como máquina pra controle)
    prisma.maquina.create({
      data: { nome: 'Metalização (externa)', codigoInterno: 'METAL-EXT', tipo: 'metalizacao', etapaId: e('Metalização').id },
    }),
    // Encaixe
    prisma.maquina.create({
      data: { nome: 'Encaixe 01', codigoInterno: 'ENC-01', tipo: 'tres_eixos', etapaId: e('Encaixe e Arredondamento').id },
    }),
    // Tornos
    prisma.maquina.create({
      data: { nome: 'Torno GL-450', codigoInterno: 'TORNO-GL450', tipo: 'torno', etapaId: e('Torno').id },
    }),
    prisma.maquina.create({
      data: { nome: 'Torno QT-300', codigoInterno: 'TORNO-QT300', tipo: 'torno', etapaId: e('Torno').id },
    }),
    prisma.maquina.create({
      data: { nome: 'Torno Verallia 14', codigoInterno: 'TORNO-VER14', tipo: 'torno', etapaId: e('Torno').id },
    }),
    prisma.maquina.create({
      data: { nome: 'Torno QT-350', codigoInterno: 'TORNO-QT350', tipo: 'torno', etapaId: e('Torno').id },
    }),
    // Vertiflow
    prisma.maquina.create({
      data: { nome: 'Vertiflow 01', codigoInterno: 'VF-01', tipo: 'vertiflow', etapaId: e('Furação Vertiflow').id },
    }),
    prisma.maquina.create({
      data: { nome: 'Vertiflow 02', codigoInterno: 'VF-02', tipo: 'vertiflow', etapaId: e('Furação Vertiflow').id },
    }),
    // Rebaixo (quinto eixo)
    prisma.maquina.create({
      data: { nome: 'Quinto Eixo 01', codigoInterno: 'QE-01', tipo: 'quinto_eixo', etapaId: e('Rebaixo e Gravação').id },
    }),
    // Chaveta
    prisma.maquina.create({
      data: { nome: 'Três Eixos 01', codigoInterno: '3E-01', tipo: 'tres_eixos', etapaId: e('Chaveta').id },
    }),
    // Acabamento
    prisma.maquina.create({
      data: { nome: 'Bancada Acabamento', codigoInterno: 'ACAB-01', tipo: 'outros', etapaId: e('Acabamento / Polimento').id },
    }),
    // Qualidade
    prisma.maquina.create({
      data: { nome: 'Bancada Qualidade', codigoInterno: 'QC-01', tipo: 'qualidade', etapaId: e('Qualidade Final').id },
    }),
    // Embalagem
    prisma.maquina.create({
      data: { nome: 'Expedição', codigoInterno: 'EMB-01', tipo: 'embalagem', etapaId: e('Embalagem').id },
    }),
  ]);

  console.log(`  ✓ ${maquinas.length} máquinas criadas`);

  // ===========================
  // RESUMO
  // ===========================
  console.log('\n✅ Seed v2 concluído com sucesso!\n');
  console.log('📋 Resumo:');
  console.log(`   Pessoas: ${pessoas.length}`);
  console.log(`   Clientes: ${clientes.length}`);
  console.log(`   Etapas: ${etapas.length}`);
  console.log(`   Máquinas: ${maquinas.length}`);
  console.log(`   Artigos: 0 (serão cadastrados pelo PCP no backoffice — Sprint 2a)`);
  console.log('\n🔑 PINs de teste (todos: 1234):');
  console.log('   Administrador: código 0001');
  console.log('   Chefe: código 0002');
  console.log('   PCP: código 0003');
  console.log('   Programador 1: código 0010');
  console.log('   Operador 1: código 0020');
  console.log('   Inspetor 1: código 0030');
  console.log('   Embalador: código 0040\n');
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
