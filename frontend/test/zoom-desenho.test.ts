import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCALA_MAX_NATURAL,
  fatorRoda,
  limitarPosicao,
  vistaEncaixe,
  zoomNoPonto,
} from '../src/lib/zoom-desenho';

// Prancha A3 paisagem renderizada a 4096 px numa caixa de tablet em retrato
const imagem = { largura: 4096, altura: 2896 };
const caixa = { largura: 800, altura: 1200 };

test('encaixe mostra o desenho inteiro e centralizado', () => {
  const v = vistaEncaixe(caixa, imagem);
  assert.equal(v.escala, 800 / 4096);
  assert.equal(v.x, 0);
  const alturaVisivel = imagem.altura * v.escala;
  assert.ok(alturaVisivel <= caixa.altura);
  assert.ok(Math.abs(v.y - (caixa.altura - alturaVisivel) / 2) < 1e-9);
});

test('zoom no ponto mantém o mesmo ponto do desenho sob o cursor', () => {
  const v = vistaEncaixe(caixa, imagem);
  const px = 300;
  const py = 650;
  const antesX = (px - v.x) / v.escala;
  const antesY = (py - v.y) / v.escala;
  const z = zoomNoPonto(v, 3, px, py, caixa, imagem);
  assert.ok(Math.abs(z.escala - v.escala * 3) < 1e-9);
  assert.ok(Math.abs((px - z.x) / z.escala - antesX) < 1e-6);
  assert.ok(Math.abs((py - z.y) / z.escala - antesY) < 1e-6);
});

test('escala respeita mínimo e máximo', () => {
  const v = vistaEncaixe(caixa, imagem);
  const longe = zoomNoPonto(v, 0.0001, 400, 600, caixa, imagem);
  assert.ok(Math.abs(longe.escala - v.escala * 0.5) < 1e-9);
  const perto = zoomNoPonto(v, 1e6, 400, 600, caixa, imagem);
  assert.equal(perto.escala, ESCALA_MAX_NATURAL);
});

test('arraste não deixa o desenho sumir da caixa', () => {
  const v = { escala: 1, x: -99999, y: 99999 };
  const l = limitarPosicao(v, caixa, imagem);
  assert.ok(l.x + imagem.largura * l.escala >= 80);
  assert.ok(l.y <= caixa.altura - 80);
});

test('roda para cima aproxima e para baixo afasta', () => {
  assert.ok(fatorRoda(-100) > 1);
  assert.ok(fatorRoda(100) < 1);
  assert.ok(Math.abs(fatorRoda(-3, 1) - fatorRoda(-48)) < 1e-12);
});
