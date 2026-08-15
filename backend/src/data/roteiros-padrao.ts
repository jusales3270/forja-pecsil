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
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 6, tempoSetupMin: 0, exigeInspecao: false },
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
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 60, tempoSetupMin: 0, exigeInspecao: false },
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
      { codigoTipoServico: 10, observacoes: 'DESCRIÇÃO DO PÓ: _____________\nQUANTIDADE POR PEÇA (KG): _____________', tempoUnitMin: 50, tempoSetupMin: 0, exigeInspecao: false },
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
