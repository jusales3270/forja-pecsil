// ============================================================
// Forja - Roteiros Padrão (modelos de processo produtivo)
// ============================================================
// Modelos de roteiro extraídos de OS reais do GRV, para o PCP
// aplicar num Artigo em vez de cadastrar operação por operação.
//
// Hoje vivem em código (fonte única, versionada). O endpoint
// GET /api/roteiros-padrao já abstrai isso — quando virarem
// cadastro no banco, o contrato da API não muda.
//
// A sequência (codigoOp) é normalizada aqui em 10, 20, 30...
// O GRV tem buracos na numeração (80, 90, 110...) por conta de
// operações deletadas ao longo do tempo; não faz sentido herdar
// esse ruído num modelo novo.
// ============================================================

export interface OperacaoRoteiroPadrao {
  /** Código do Tipo de Serviço no catálogo (ex: 36 = ENG. / PROG. CENTRO) */
  codigoTipoServico: number;
  /** O que fazer nesta passagem. É o que diferencia repetições do mesmo código. */
  observacoes: string;
  tempoUnitMin: number;
  tempoSetupMin: number;
  exigeInspecao: boolean;
  /**
   * Avisa a etapa seguinte ao atingir N peças, sem esperar o lote fechar.
   * Regra do PCP: a engenharia não espera o lote inteiro para começar o
   * próximo programa. O número é sugestão — o PCP ajusta por lote.
   */
  gatilhoAlertaPecas?: number;
  /**
   * Avisa a etapa assim que a operação for INICIADA, sem esperar peça nenhuma.
   * É o caso do tratamento térmico: o ciclo leva ~3 dias e é justamente essa a
   * janela em que a engenharia programa o desbaste. Hoje esse aviso é verbal —
   * quando ninguém avisa, a peça fica parada esperando o programa.
   */
  avisaAoIniciar?: boolean;
  /**
   * Código do Tipo de Serviço cuja etapa recebe o aviso. Ex: a metalização
   * avisa a Engenharia, que começa o programa de encaixe+arredondamento sem
   * esperar o lote fechar.
   */
  avisaEtapaDoCodigoTipoServico?: number;
  /**
   * Operação feita fora da fábrica. A rebarbação da fundição é assim: a peça
   * sai de caminhão, é rebarbada por terceiro e volta. Não abre máquina —
   * registra envio e retorno.
   */
  terceirizada?: boolean;
  fornecedor?: string;
  prazoPrevistoDias?: number;
  /**
   * Operação que é só tempo: cura do molde e resfriamento na areia, 12h cada.
   * Não ocupa máquina nem operador — o relógio corre e ela libera sozinha.
   */
  esperaHoras?: number;
  /**
   * A operação seguinte só começa com o lote INTEIRO fechado aqui. Regra do
   * Rafael pro tratamento térmico: não vai pro desbaste peça parcialmente
   * tratada.
   */
  exigeLoteCompleto?: boolean;
}

export interface RoteiroPadrao {
  id: string;
  nome: string;
  descricao: string;
  /** Procedência do roteiro, para o PCP saber de onde veio e conferir. */
  origem: string;
  /** true = observações extraídas de fonte parcialmente legível, conferir com o PCP */
  revisaoPendente: boolean;
  operacoes: OperacaoRoteiroPadrao[];
}

export const ROTEIROS_PADRAO: RoteiroPadrao[] = [
  // ==========================================================
  // ROTEIROS OFICIAIS GRV (Processos Padrão exportados do GRV)
  // ==========================================================

  // 1. Doc 13328 — PROCESSO PADRÃO FUNDIÇÃO + USINAGEM COMPLETA
  {
    id: 'fundicao-grv',
    nome: 'Fundição e Linha Completa (Padrão GRV + Forno + Usinagem)',
    descricao:
      'Fluxo completo de fabricação da fábrica: Modelação, Moldagem, Vazamento, Rebarbação, Tratamento Térmico (com aviso à Engenharia), Programação CNC Centro/Torno, Desbaste para Metalização, Metalização, Encaixe e Arredondamento, Torno, Acabamento/Polimento e Inspeção Final.',
    origem: 'Processo Padrão GRV Doc 13328 (Fundição + Linha de Produção)',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 20,
        observacoes: 'VERIFICAÇÃO / FABRICAÇÃO DO MODELO',
        tempoUnitMin: 20,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 15,
        observacoes: 'MOLDAGEM',
        tempoUnitMin: 20,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 17,
        observacoes: 'VAZAMENTO',
        tempoUnitMin: 15,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 7,
        observacoes: 'REBARBAÇÃO FUNDIÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 50,
        observacoes:
          'TRATAMENTO TÉRMICO — início e fim no forno. Ao iniciar avisa a Engenharia.',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
        avisaAoIniciar: true,
        avisaEtapaDoCodigoTipoServico: 36,
        exigeLoteCompleto: true,
      },
      {
        codigoTipoServico: 36,
        observacoes: 'PROGRAMAR CENTRO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 2,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 25,
        observacoes: 'DESBASTE PARA METALIZAÇÃO',
        tempoUnitMin: 15,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 10,
        observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
        gatilhoAlertaPecas: 10,
        avisaEtapaDoCodigoTipoServico: 36,
      },
      {
        codigoTipoServico: 26,
        observacoes: 'ENCAIXE E ARREDONDAMENTO',
        tempoUnitMin: 15,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 30,
        observacoes: 'CÉLULA DE TORNEAMENTO DE BLOCOS',
        tempoUnitMin: 20,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO / ACABAMENTO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // 2. Doc 13329 — PROCESSO PADRÃO ARRUELA
  {
    id: 'arruela-grv',
    nome: 'Arruela (Padrão GRV 13329)',
    descricao:
      'Linha de produção de arruelas: Programação de Torno, Corte em Serra, Célula de Torneamento de Arruelas (Traseiro e Dianteiro), Fresamento/Gravação, Usinagem Convencional, Acabamento/Polimento e Qualidade Final.',
    origem: 'Processo Padrão GRV Doc 13329 (Arruela)',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 12,
        observacoes: 'CORTAR PEÇAS COM Ø... X ...MM',
        tempoUnitMin: 2,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 32,
        observacoes: 'LADO TRASEIRO',
        tempoUnitMin: 6,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 32,
        observacoes: 'LADO DIANTEIRO',
        tempoUnitMin: 6,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 28,
        observacoes: 'GRAVAÇÃO',
        tempoUnitMin: 8,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 11,
        observacoes: 'FURAÇÃO FRESA CONVENCIONAL',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO / REBARBAÇÃO / EMBALAGEM',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // 3. Doc 13327 — PROCESSO PADRÃO FUNDO (COMPLETO: FUNDIÇÃO + USINAGEM)
  {
    id: 'fundo-completo-grv',
    nome: 'Fundo Completo — Fundição + Usinagem CNC (Padrão GRV 13327)',
    descricao:
      'Fluxo completo de fabricação do fundo a partir do metal líquido: Modelação, Moldagem, Programação CNC Centro/Torno, Vazamento, Torno CNC Desbaste, Metalização, Esquadro, Torneamento Dianteiro/Traseiro, Integrex 5 Eixos, Acabamento/Polimento/Embalagem/Rebarbação e Inspeção Final.',
    origem: 'Processo Padrão GRV Doc 13327 (Fundo)',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 20,
        observacoes: 'VERIFICAÇÃO / FABRICAÇÃO DO MODELO',
        tempoUnitMin: 20,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 15,
        observacoes: 'MOLDAGEM',
        tempoUnitMin: 20,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 36,
        observacoes: 'PROGRAMAR CENTRO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 17,
        observacoes: 'VAZAMENTO',
        tempoUnitMin: 15,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'DESBASTE PARA METALIZAÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 10,
        observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________',
        tempoUnitMin: 6,
        tempoSetupMin: 0,
        exigeInspecao: false,
        gatilhoAlertaPecas: 10,
        avisaEtapaDoCodigoTipoServico: 36,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'ESQUADRO',
        tempoUnitMin: 4,
        tempoSetupMin: 60,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'LADO TRASEIRO',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'LADO DIANTEIRO',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 21,
        observacoes: 'ACABAMENTO / FURAÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'EMBALAGEM',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'REBARBAÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 1,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // 4. Doc 13326 — PROCESSO PADRÃO FUNDO COM CENTROS VERTICAIS
  {
    id: 'fundo-centros-verticais-grv',
    nome: 'Fundo com Centros Verticais (Padrão GRV 13326)',
    descricao:
      'Usinagem de fundo pré-fundido: Programação CNC Centro/Torno, Torno CNC Dianteiro/Traseiro, Centros Verticais (Gravação), Acabamento/Polimento/Embalagem e Inspeção Final.',
    origem: 'Processo Padrão GRV Doc 13326 (Fundo com Centros Verticais)',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 36,
        observacoes: 'PROGRAMAR CENTRO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 2,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'LADO DIANTEIRO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 8,
        observacoes: 'LADO TRASEIRO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 33,
        observacoes: 'GRAVAÇÃO',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO / REBARBAÇÃO / EMBALAGEM',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // 5. Doc 13325 — PROCESSO PADRÃO FORMA / BLOCO
  {
    id: 'forma-bloco-grv',
    nome: 'Forma / Bloco em Células (Padrão GRV 13325)',
    descricao:
      'Usinagem em células de formas e blocos: Programação CNC, Célula de Desbaste para Metalização, Metalização, Célula de Encaixe e Arredondamento, Célula de Torneamento de Forminhas, Torno 5 Eixos Integrex, Célula de Fresamento/Furação, Polimento/Embalagem e Inspeção Final.',
    origem: 'Processo Padrão GRV Doc 13325 (Forma / Bloco)',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 36,
        observacoes: 'PROGRAMAR CENTRO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 25,
        observacoes: 'DESBASTE PARA METALIZAÇÃO',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 10,
        observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________',
        tempoUnitMin: 40,
        tempoSetupMin: 0,
        exigeInspecao: false,
        gatilhoAlertaPecas: 10,
        avisaEtapaDoCodigoTipoServico: 36,
      },
      {
        codigoTipoServico: 26,
        observacoes: 'ENCAIXE',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 26,
        observacoes: 'ARREDONDAMENTO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 31,
        observacoes: 'LADO TRASEIRO',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 21,
        observacoes: 'LADO DIANTEIRO / ROSCA',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 28,
        observacoes: 'CHAVETA / REBAIXOS',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 28,
        observacoes: 'FURAÇÃO / ALETAS / GRAVAÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO / REBARBAÇÃO / EMBALAGEM',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 5,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // Coroa / Forminha em Bronze — sequência e tempos do PDF fornecido pelo PCP.
  {
    id: 'coroa-forminha-bronze',
    nome: 'Coroa / Forminha em Bronze',
    descricao:
      'Programação CNC Centro/Torno, Desbaste para Metalização, Metalização, Encaixe, Arredondamento, Torneamento Traseiro, Integrex (Dianteiro / Rosca), Chaveta / Rebaixos, Furação / Aletas / Gravação, Polimento / Rebarbação / Embalagem e Inspeção Final.',
    origem: 'COROA-FORMINHA-EM-BRONZE.pdf — GRV, processos 192900–192911',
    revisaoPendente: false,
    operacoes: [
      {
        codigoTipoServico: 36,
        observacoes: 'PROGRAMAR CENTRO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 37,
        observacoes: 'PROGRAMAR TORNO',
        tempoUnitMin: 1,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 25,
        observacoes: 'DESBASTE PARA METALIZAÇÃO',
        tempoUnitMin: 4.5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 10,
        observacoes: 'DESCRIÇÃO DE PÓ ___________\n\nQUANTIDADE POR PEÇA __________',
        tempoUnitMin: 40,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 26,
        observacoes: 'ENCAIXE',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 26,
        observacoes: 'ARREDONDAMENTO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 31,
        observacoes: 'LADO TRASEIRO',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 21,
        observacoes: 'LADO DIANTEIRO\nROSCA\nFERRAMENTA Nº 13',
        tempoUnitMin: 7,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 28,
        observacoes: 'CHAVETA / REBAIXOS',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 28,
        observacoes: 'FURAÇÃO / ALETAS / GRAVAÇÃO',
        tempoUnitMin: 10,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 13,
        observacoes: 'POLIMENTO / REBARBAÇÃO / EMBALAGEM',
        tempoUnitMin: 4.5,
        tempoSetupMin: 0,
        exigeInspecao: false,
      },
      {
        codigoTipoServico: 18,
        observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS',
        tempoUnitMin: 4.5,
        tempoSetupMin: 0,
        exigeInspecao: true,
      },
    ],
  },

  // ==========================================================
  // MODELOS EXPANDIDOS DE CHÃO DE FÁBRICA / REUNIÕES PCP
  // ==========================================================

  {
    id: 'fundicao-estendida',
    nome: 'Fundição (Fluxo Estendido com Esperas e Forno)',
    descricao:
      'Fluxo interno completo da fundição, incluindo as esperas obrigatórias de cura do molde e resfriamento na areia (12h cada), rebarbação terceirizada, jato de granalha e ciclo completo de tratamento térmico.',
    origem:
      'Reuniões com o PCP (Rafael), incluindo a caminhada pela fábrica de 29/08. Sequência e tempos de espera definidos por ele; o OK de cada operação é do Guilherme.',
    revisaoPendente: true,
    operacoes: [
      {
        codigoTipoServico: 20,
        observacoes:
          'MODELAÇÃO — conferir se a coquilha serve e se o modelo precisa de alteração ou manutenção.\nSem coquilha pronta: fabricar em madeira ou 3D e fundir antes de seguir.',
        tempoUnitMin: 20, tempoSetupMin: 0, exigeInspecao: false,
      },
      { codigoTipoServico: 15, observacoes: 'MOLDAGEM', tempoUnitMin: 20, tempoSetupMin: 0, exigeInspecao: false },
      {
        codigoTipoServico: 51,
        observacoes: 'CURA DO MOLDE — 12h no mínimo, às vezes 1 dia. Só depois monta na linha.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
        esperaHoras: 12,
      },
      { codigoTipoServico: 17, observacoes: 'VAZAMENTO — fundir as peças, na linha.', tempoUnitMin: 15, tempoSetupMin: 0, exigeInspecao: false },
      {
        codigoTipoServico: 52,
        observacoes: 'RESFRIAMENTO NA AREIA — 12h dentro do molde. Só depois desmolda, descarta a areia e tira a peça.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
        esperaHoras: 12,
      },
      {
        codigoTipoServico: 7,
        observacoes:
          'REBARBAÇÃO — FEITA FORA. Sai de empilhadeira, vai de caminhão pro terceiro e volta.\nRegistrar envio e retorno, não abre máquina.',
        tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false,
        terceirizada: true,
      },
      {
        codigoTipoServico: 53,
        observacoes: 'JATO DE GRANALHA — interno, assim que a peça volta da rebarbação. Depois desce pro forno.',
        tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false,
      },
      {
        codigoTipoServico: 50,
        observacoes:
          'TRATAMENTO TÉRMICO — início e fim. Forno fica embaixo.\nCiclo de 2 a 3 dias (tempo de forno, não por peça).\nA engenharia é avisada na entrada e usa esse tempo pra programar o desbaste.\nNÃO libera pro desbaste com lote parcialmente tratado.',
        tempoUnitMin: 0,
        tempoSetupMin: 0,
        exigeInspecao: false,
        avisaAoIniciar: true,
        avisaEtapaDoCodigoTipoServico: 36,
        exigeLoteCompleto: true,
      },
    ],
  },

  // ----------------------------------------------------------
  {
    id: 'bloco-pre-molde',
    nome: 'Bloco / Pré-molde (Células)',
    descricao:
      'Torneamento em célula de blocos, com acabamento em centros verticais e furação Vertiflow.',
    origem: 'OS 12563/001 — PRÉ-MOLDE GFA. CERVEJA 600ML 420GR ART. 25M006 FOFO 96A (lote de 72)',
    revisaoPendente: false,
    operacoes: [
      { codigoTipoServico: 36, observacoes: 'PROGRAMAR CENTRO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 37, observacoes: 'PROGRAMAR TORNO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 25, observacoes: 'DESBASTE PARA METALIZAÇÃO', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 6, tempoSetupMin: 0, exigeInspecao: false, gatilhoAlertaPecas: 10, avisaEtapaDoCodigoTipoServico: 36 },
      { codigoTipoServico: 26, observacoes: 'ENCAIXE', tempoUnitMin: 7, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 26, observacoes: 'ARREDONDAMENTO / CORTE LATERAL', tempoUnitMin: 8, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 30, observacoes: 'LADO DIANTEIRO', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 30, observacoes: 'LADO TRASEIRO', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 33, observacoes: 'CHAVETA', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 23, observacoes: 'VERTFLOW / GRAVAÇÃO', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 33, observacoes: 'REBAIXO / FLECHA', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 13, observacoes: 'POLIMENTO / REBARBAÇÃO / EMBALAGEM', tempoUnitMin: 5, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 18, observacoes: 'INSPEÇÃO FINAL / VOLUME / RELATÓRIOS', tempoUnitMin: 5, tempoSetupMin: 0, exigeInspecao: true },
    ],
  },

  // ----------------------------------------------------------
  {
    id: 'forma-dupla',
    nome: 'Forma Dupla (Célula DC + 5 Eixos)',
    descricao:
      'Usinagem em célula de Formas DC e centros de 5 eixos, com furação convencional (inclinada e de vácuo).',
    origem: 'Roteiro "forma dupla" exportado do GRV (processos 184466-184480, lote de 12)',
    revisaoPendente: false,
    operacoes: [
      { codigoTipoServico: 36, observacoes: 'PROGRAMAR CENTRO', tempoUnitMin: 2, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 37, observacoes: 'PROGRAMAR TORNO', tempoUnitMin: 2, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 25, observacoes: 'DESBASTE PARA METALIZAÇÃO', tempoUnitMin: 55, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false, gatilhoAlertaPecas: 10, avisaEtapaDoCodigoTipoServico: 36 },
      { codigoTipoServico: 34, observacoes: 'ACABAMENTO CAVIDADE E ENCAIXE', tempoUnitMin: 212, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 22, observacoes: 'FACEAMENTO TOPO E FURAÇÕES', tempoUnitMin: 70, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 29, observacoes: 'TORNEAMENTO EXTERNO', tempoUnitMin: 40, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 34, observacoes: 'CHAVETA TRASEIRA / FUROS ROSCADOS / CORTE LATERAL', tempoUnitMin: 37, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 22, observacoes: 'REBAIXO / GRAVAÇÃO / CÓDIGO DE PONTOS', tempoUnitMin: 65, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 11, observacoes: 'FURAÇÃO INCLINADA DA CAVIDADE', tempoUnitMin: 37, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 11, observacoes: 'FURAÇÃO DE VÁCUO', tempoUnitMin: 32, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 13, observacoes: 'POLIMENTO', tempoUnitMin: 10, tempoSetupMin: 1, exigeInspecao: false },
      { codigoTipoServico: 13, observacoes: 'REBARBAÇÃO', tempoUnitMin: 10, tempoSetupMin: 1, exigeInspecao: false },
      { codigoTipoServico: 14, observacoes: 'MONTAGEM E AJUSTES FINAIS', tempoUnitMin: 30, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 18, observacoes: 'INSPEÇÃO FINAL / VOLUME', tempoUnitMin: 20, tempoSetupMin: 0, exigeInspecao: true },
    ],
  },

  // ----------------------------------------------------------
  {
    id: 'forma-centros-verticais',
    nome: 'Forma — Acabamento em Centros Verticais',
    descricao:
      'Torneamento em célula de formas, com acabamento em centros verticais, 4º eixo e PH400. Roteiro mais longo (18 operações).',
    origem:
      'OS do GRV (processos 191809-191826). Observações inferidas de foto parcialmente legível — CONFERIR COM O PCP.',
    revisaoPendente: true,
    operacoes: [
      { codigoTipoServico: 36, observacoes: 'PROGRAMAR CENTRO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 37, observacoes: 'PROGRAMAR TORNO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 25, observacoes: 'DESBASTE PARA METALIZAÇÃO', tempoUnitMin: 40, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 50, tempoSetupMin: 0, exigeInspecao: false, gatilhoAlertaPecas: 10, avisaEtapaDoCodigoTipoServico: 36 },
      { codigoTipoServico: 26, observacoes: 'ENCAIXE', tempoUnitMin: 24, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 26, observacoes: 'ARREDONDAMENTO', tempoUnitMin: 22, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 29, observacoes: 'LADO DIANTEIRO', tempoUnitMin: 15, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 29, observacoes: 'LADO TRASEIRO', tempoUnitMin: 30, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 33, observacoes: 'REBAIXO', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 33, observacoes: 'CHAVETA', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 27, observacoes: 'CORTE LATERAL', tempoUnitMin: 10, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 23, observacoes: 'VERTFLOW / GRAVAÇÃO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 22, observacoes: 'ACABAMENTO', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 33, observacoes: 'REBAIXO / FLECHA', tempoUnitMin: 15, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 29, observacoes: 'LADO DIANTEIRO (ACABAMENTO)', tempoUnitMin: 12, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 29, observacoes: 'ACABAMENTO FINAL', tempoUnitMin: 15, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 13, observacoes: 'POLIMENTO', tempoUnitMin: 25, tempoSetupMin: 0, exigeInspecao: false },
      { codigoTipoServico: 18, observacoes: 'INSPEÇÃO FINAL', tempoUnitMin: 5, tempoSetupMin: 0, exigeInspecao: true },
    ],
  },
];

/** Passo de numeração da sequência (10, 20, 30...), igual ao padrão do GRV. */
export const PASSO_SEQUENCIA = 10;

export function buscarRoteiroPadrao(id: string): RoteiroPadrao | undefined {
  return ROTEIROS_PADRAO.find((r) => r.id === id);
}
