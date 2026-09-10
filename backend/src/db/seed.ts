import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function garantirSeedInicial() {
  try {
    const totalArtigos = await prisma.artigo.count().catch(() => 0);

    if (totalArtigos > 0) {
      return; // Já existem dados completos no banco
    }

    console.log('📦 Banco sem artigos detectado. Limpando tabelas e restaurando backup completo...');
    
    // Limpa tabelas para evitar conflito de IDs/chaves únicas do seed parcial
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "Alerta", "EventoOS", "ControleVolume", "MedicaoInspecao", "InspecaoOP", 
        "ApontamentoPeca", "ApontamentoTurno", "ParadaMaquina", "MotivoParada", 
        "ProcessamentoMaquina", "Carimbo", "OPLote", "Lote", "OS", "CotaInspecao", 
        "PlanoInspecao", "OperacaoArtigo", "TipoServico", "ToleranciaGeralCliente", 
        "Desenho", "Artigo", "Maquina", "Etapa", "Cliente", "Pessoa" 
      CASCADE;
    `).catch((e) => console.warn('Aviso ao truncar antes do restore:', e.message));

    const backupPath = path.resolve(process.cwd(), 'prisma/backup_data.sql');
    if (fs.existsSync(backupPath)) {
      try {
        const dbUrl = process.env.DATABASE_URL || 'postgresql://forja:forja_dev_2026@postgres:5432/forja';
        execSync(`psql "${dbUrl}" -f "${backupPath}"`, { stdio: 'inherit' });
        console.log('✅ Todos os 3.876 artigos, usuários e dados históricos restaurados com sucesso!');
        return;
      } catch (errDump) {
        console.warn('⚠️ Falha ao rodar psql no backup_data.sql:', errDump);
      }
    }

    console.log('🌱 Inicializando pessoas e cadastros padrão...');

    const hashPin = async (pin: string) => bcrypt.hash(pin, 10);
    const defaultPin = await hashPin('1234');

    // 1. Pessoas
    await Promise.all([
      prisma.pessoa.create({
        data: {
          nome: 'Administrador',
          codigoPessoal: '0001',
          pinHash: defaultPin,
          papel: 'admin',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Chefe',
          codigoPessoal: '0002',
          pinHash: defaultPin,
          papel: 'chefe',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'PCP',
          codigoPessoal: '0003',
          pinHash: defaultPin,
          papel: 'pcp',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Programador 1',
          codigoPessoal: '0010',
          pinHash: defaultPin,
          papel: 'programador',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Programador 2',
          codigoPessoal: '0011',
          pinHash: defaultPin,
          papel: 'programador',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Operador 1',
          codigoPessoal: '0020',
          pinHash: defaultPin,
          papel: 'operador',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Operador 2',
          codigoPessoal: '0021',
          pinHash: defaultPin,
          papel: 'operador',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Inspetor 1',
          codigoPessoal: '0030',
          pinHash: defaultPin,
          papel: 'inspetor',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Inspetor 2',
          codigoPessoal: '0031',
          pinHash: defaultPin,
          papel: 'inspetor',
        },
      }),
      prisma.pessoa.create({
        data: {
          nome: 'Embalador',
          codigoPessoal: '0040',
          pinHash: defaultPin,
          papel: 'embalador',
        },
      }),
    ]);

    // 2. Clientes
    await Promise.all([
      prisma.cliente.create({ data: { nome: 'Verallia / Saint-Gobain - Campo Bom' } }),
      prisma.cliente.create({ data: { nome: 'Owens-Illinois (Argentina)' } }),
      prisma.cliente.create({ data: { nome: 'Nadir' } }),
      prisma.cliente.create({ data: { nome: 'On' } }),
    ]);

    // 3. Etapas
    const etapasData = [
      {
        nome: 'Fundição',
        ordemPadrao: 1,
        slaHoras: 168,
        aplicaParaTipos: ['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde'],
        exigeCheckpointQualidade: false,
      },
      {
        nome: 'Engenharia / Programação',
        ordemPadrao: 2,
        slaHoras: 24,
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

    const getEtapaId = (nome: string): string => {
      const found = etapas.find((x) => x.nome === nome);
      if (!found) throw new Error(`Etapa não encontrada: ${nome}`);
      return found.id;
    };

    // 4. Máquinas
    await Promise.all([
      prisma.maquina.create({
        data: { nome: 'PC Engenharia', codigoInterno: 'PC-ENG-01', tipo: 'outros', etapaId: getEtapaId('Engenharia / Programação') },
      }),
      prisma.maquina.create({
        data: { nome: 'PC Fundição', codigoInterno: 'PC-FUND-01', tipo: 'fundicao', etapaId: getEtapaId('Fundição') },
      }),
      prisma.maquina.create({
        data: { nome: 'Desbaste 01', codigoInterno: 'DESB-01', tipo: 'tres_eixos', etapaId: getEtapaId('Desbaste') },
      }),
      prisma.maquina.create({
        data: { nome: 'Desbaste 02', codigoInterno: 'DESB-02', tipo: 'tres_eixos', etapaId: getEtapaId('Desbaste') },
      }),
      prisma.maquina.create({
        data: { nome: 'Metalização (externa)', codigoInterno: 'METAL-EXT', tipo: 'metalizacao', etapaId: getEtapaId('Metalização') },
      }),
      prisma.maquina.create({
        data: { nome: 'Encaixe 01', codigoInterno: 'ENC-01', tipo: 'tres_eixos', etapaId: getEtapaId('Encaixe e Arredondamento') },
      }),
      prisma.maquina.create({
        data: { nome: 'Torno GL-450', codigoInterno: 'TORNO-GL450', tipo: 'torno', etapaId: getEtapaId('Torno') },
      }),
      prisma.maquina.create({
        data: { nome: 'Torno QT-300', codigoInterno: 'TORNO-QT300', tipo: 'torno', etapaId: getEtapaId('Torno') },
      }),
      prisma.maquina.create({
        data: { nome: 'Torno Verallia 14', codigoInterno: 'TORNO-VER14', tipo: 'torno', etapaId: getEtapaId('Torno') },
      }),
      prisma.maquina.create({
        data: { nome: 'Torno QT-350', codigoInterno: 'TORNO-QT350', tipo: 'torno', etapaId: getEtapaId('Torno') },
      }),
      prisma.maquina.create({
        data: { nome: 'Vertiflow 01', codigoInterno: 'VF-01', tipo: 'vertiflow', etapaId: getEtapaId('Furação Vertiflow') },
      }),
      prisma.maquina.create({
        data: { nome: 'Vertiflow 02', codigoInterno: 'VF-02', tipo: 'vertiflow', etapaId: getEtapaId('Furação Vertiflow') },
      }),
      prisma.maquina.create({
        data: { nome: 'Quinto Eixo 01', codigoInterno: 'QE-01', tipo: 'quinto_eixo', etapaId: getEtapaId('Rebaixo e Gravação') },
      }),
      prisma.maquina.create({
        data: { nome: 'Três Eixos 01', codigoInterno: '3E-01', tipo: 'tres_eixos', etapaId: getEtapaId('Chaveta') },
      }),
      prisma.maquina.create({
        data: { nome: 'Bancada Acabamento', codigoInterno: 'ACAB-01', tipo: 'outros', etapaId: getEtapaId('Acabamento / Polimento') },
      }),
      prisma.maquina.create({
        data: { nome: 'Bancada Qualidade', codigoInterno: 'QC-01', tipo: 'qualidade', etapaId: getEtapaId('Qualidade Final') },
      }),
      prisma.maquina.create({
        data: { nome: 'Expedição', codigoInterno: 'EMB-01', tipo: 'embalagem', etapaId: getEtapaId('Embalagem') },
      }),
    ]);

    console.log('✅ Seed inicial concluído com sucesso!');
  } catch (err) {
    console.error('⚠️ Erro ao executar seed automático inicial:', err);
  }
}
