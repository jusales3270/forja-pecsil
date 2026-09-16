import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrilhaRoteiro } from '../src/components/TrilhaRoteiro';
import type { PassoRoteiro } from '../src/hooks/useDashboard';

const passo = (estacao: string, estado: PassoRoteiro['estado'], extra: Partial<PassoRoteiro> = {}): PassoRoteiro => ({
  opLoteId: estacao, codigoOp: '10', tipoServico: estacao.toUpperCase(), estacao, etapaId: estacao,
  status: 'na_fila', estado, concluidas: 0, disponiveis: 0, ...extra,
});

test('trilha mostra as estações na ordem recebida, com a posição atual e a contagem', () => {
  const html = renderToStaticMarkup(
    <TrilhaRoteiro
      quantidadePecas={100}
      passos={[
        passo('Engenharia', 'concluido'),
        passo('Fundição', 'atual', { tipoServico: 'SERRA', concluidas: 4, disponiveis: 96 }),
        passo('Torno', 'futuro'),
      ]}
    />,
  );
  const ordem = ['Engenharia', 'Fundição', 'Torno'].map((e) => html.indexOf(e));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'Segue a ordem do roteiro.');
  assert.match(html, /✓<\/span><span>Engenharia/);
  assert.match(html, /●<\/span><span>Fundição<\/span><span class="text-xs opacity-75">\(SERRA\)<\/span><span class="text-xs tabular-nums">4\/100/);
  assert.match(html, /○<\/span><span>Torno/);
  assert.equal((html.match(/→/g) ?? []).length, 2);
  assert.ok(!html.includes('(TORNO)'), 'Não repete o serviço quando é igual à estação.');
});

test('envio externo aparece como fora da fábrica', () => {
  const html = renderToStaticMarkup(<TrilhaRoteiro quantidadePecas={10} passos={[passo('Metalização', 'externo', { concluidas: 0, disponiveis: 10 })]} />);
  assert.match(html, /⇄<\/span><span>Metalização<\/span>.*fora/);
  assert.match(html, /em envio externo/);
});
