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
  // ----------------------------------------------------------
  {
    id: 'fundicao',
    nome: 'Fundição',
    descricao:
      'Fluxo interno da fundição, do pedido ao forno. Inclui as esperas obrigatórias (cura e resfriamento, 12h cada) e a rebarbação, que é feita fora. O tratamento térmico fecha o ciclo: só libera para o desbaste com o lote inteiro tratado.',
    origem:
      'Reuniões com o PCP (Rafael), incluindo a caminhada pela fábrica de 29/08. Sequência e tempos de espera definidos por ele; o OK de cada operação é do Guilherme. Tempos de execução a levantar com a fundição.',
    revisaoPendente: true,
    operacoes: [
      {
        codigoTipoServico: 20,
        observacoes:
          'MODELAÇÃO — conferir se a coquilha serve e se o modelo precisa de alteração ou manutenção.\nSem coquilha pronta: fabricar em madeira ou 3D e fundir antes de seguir.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
      },
      { codigoTipoServico: 15, observacoes: 'MOLDAGEM', tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false },
      {
        codigoTipoServico: 51,
        observacoes: 'CURA DO MOLDE — 12h no mínimo, às vezes 1 dia. Só depois monta na linha.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
        esperaHoras: 12,
      },
      { codigoTipoServico: 17, observacoes: 'VAZAMENTO — fundir as peças, na linha.', tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false },
      {
        codigoTipoServico: 52,
        observacoes: 'RESFRIAMENTO NA AREIA — 12h dentro do molde. Só depois desmolda, descarta a areia e tira a peça.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
        esperaHoras: 12,
      },
      {
        codigoTipoServico: 7,
        observacoes:
          'REBARBAÇÃO — FEITA FORA. Sai de empilhadeira, vai de caminhão pro terceiro e volta.\nAntigamente era interna. Registrar envio e retorno, não abre máquina.\nPRAZO A LEVANTAR: o Rafael descreveu o trajeto mas não disse quanto tempo leva.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
        terceirizada: true,
      },
      {
        codigoTipoServico: 53,
        observacoes: 'JATO DE GRANALHA — interno, assim que a peça volta da rebarbação. Depois desce pro forno.',
        tempoUnitMin: 0, tempoSetupMin: 0, exigeInspecao: false,
      },
      {
        codigoTipoServico: 50,
        observacoes:
          'TRATAMENTO TÉRMICO — início e fim. Forno fica embaixo.\nCiclo de 2 a 3 dias (tempo de forno, não por peça).\nA engenharia é avisada na entrada e usa esse tempo pra programar o desbaste.\nNÃO libera pro desbaste com lote parcialmente tratado.',
        tempoUnitMin: 0,
        tempoSetupMin: 0,
        exigeInspecao: false,
        // Ao apontar a entrada no forno, a engenharia é avisada na hora e usa
        // os ~3 dias de ciclo pra deixar o programa de desbaste pronto.
        avisaAoIniciar: true,
        avisaEtapaDoCodigoTipoServico: 36,
        // Regra do Rafael: o que sai do forno parcial não desce pro desbaste.
        exigeLoteCompleto: true,
      },
    ],
  },

  // ----------------------------------------------------------
  {
    id: 'bloco-pre-molde',
    nome: 'Bloco / Pré-molde',
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
    nome: 'Forma Dupla',
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
    nome: 'Forma — acabamento em centros verticais',
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
