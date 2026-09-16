// ============================================================
// Forja - Matemática de zoom/arraste do popup de desenho
// Funções puras: a imagem é desenhada com
//   transform: translate(x, y) scale(escala), transform-origin 0 0
// ============================================================

export interface Vista {
  escala: number;
  x: number;
  y: number;
}

export interface Tamanho {
  largura: number;
  altura: number;
}

/** Zoom máximo em relação ao tamanho natural da imagem renderizada. */
export const ESCALA_MAX_NATURAL = 8;
/** Zoom mínimo em relação à escala de encaixe. */
export const FRACAO_MIN_ENCAIXE = 0.5;
/** Quanto do desenho precisa continuar visível ao arrastar (px). */
const MARGEM_VISIVEL = 80;

/** Vista que mostra o desenho inteiro, centralizado na caixa. */
export function vistaEncaixe(caixa: Tamanho, imagem: Tamanho): Vista {
  if (imagem.largura <= 0 || imagem.altura <= 0) return { escala: 1, x: 0, y: 0 };
  const escala = Math.min(caixa.largura / imagem.largura, caixa.altura / imagem.altura);
  return {
    escala,
    x: (caixa.largura - imagem.largura * escala) / 2,
    y: (caixa.altura - imagem.altura * escala) / 2,
  };
}

export function limitesEscala(caixa: Tamanho, imagem: Tamanho): { min: number; max: number } {
  const encaixe = vistaEncaixe(caixa, imagem).escala;
  return {
    min: encaixe * FRACAO_MIN_ENCAIXE,
    max: Math.max(ESCALA_MAX_NATURAL, encaixe),
  };
}

/** Impede que o desenho saia totalmente da caixa. */
export function limitarPosicao(vista: Vista, caixa: Tamanho, imagem: Tamanho): Vista {
  const w = imagem.largura * vista.escala;
  const h = imagem.altura * vista.escala;
  const mx = Math.min(MARGEM_VISIVEL, w);
  const my = Math.min(MARGEM_VISIVEL, h);
  return {
    escala: vista.escala,
    x: Math.min(Math.max(vista.x, mx - w), caixa.largura - mx),
    y: Math.min(Math.max(vista.y, my - h), caixa.altura - my),
  };
}

/**
 * Aplica um fator de zoom mantendo fixo o ponto (px, py) da caixa —
 * o ponto do desenho sob o cursor continua sob o cursor.
 */
export function zoomNoPonto(
  vista: Vista,
  fator: number,
  px: number,
  py: number,
  caixa: Tamanho,
  imagem: Tamanho,
): Vista {
  const { min, max } = limitesEscala(caixa, imagem);
  const escala = Math.min(Math.max(vista.escala * fator, min), max);
  const real = escala / vista.escala;
  return limitarPosicao(
    { escala, x: px - (px - vista.x) * real, y: py - (py - vista.y) * real },
    caixa,
    imagem,
  );
}

/** Fator de zoom a partir do deltaY da roda do mouse. */
export function fatorRoda(deltaY: number, deltaMode = 0): number {
  // deltaMode 1 = linhas (Firefox), 0 = pixels
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaY;
  return Math.exp(-pixels * 0.0015);
}
