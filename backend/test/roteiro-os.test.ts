import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTrilha, vizinhosNaTrilha, type OpDaTrilha } from '../src/lib/roteiro-os.js';

function op(id: string, ordem: number, estacao: string, extra: Partial<OpDaTrilha> = {}): OpDaTrilha {
  return {
    id, ordem, codigoOp: String(ordem * 10), tipoServico: `SERV ${estacao}`, status: 'na_fila',
    quantidadeConcluida: 0, exigeLoteCompleto: false, envioExternoEm: null, recebimentoExternoEm: null,
    etapa: { id: estacao, nome: estacao }, ...extra,
  };
}

test('trilha segue a ordem do PCP, não a ordem das estações', () => {
  // Metalização → Desbaste → Fundição, entregues fora de ordem
  const trilha = montarTrilha(
    [op('c', 3, 'Fundição'), op('a', 1, 'Metalização', { status: 'concluida', quantidadeConcluida: 10 }), op('b', 2, 'Desbaste')],
    (id) => (id === 'b' ? 10 : 0),
  );
  assert.deepEqual(trilha.map((p) => [p.estacao, p.estado, p.disponiveis]), [
    ['Metalização', 'concluido', 0],
    ['Desbaste', 'atual', 10],
    ['Fundição', 'futuro', 0],
  ]);
});

test('lote parcial fica em dois pontos ao mesmo tempo', () => {
  const trilha = montarTrilha(
    [op('a', 1, 'Fundição', { status: 'na_fila', quantidadeConcluida: 3 }), op('b', 2, 'Torno', { status: 'em_processo' })],
    (id) => (id === 'a' ? 9 : 3),
  );
  assert.deepEqual(trilha.map((p) => p.estado), ['atual', 'atual']);
});

test('trava de lote completo segura as operações seguintes; envio externo aparece como externo', () => {
  const trilha = montarTrilha(
    [
      op('tt', 1, 'Fundição', { status: 'em_processo', exigeLoteCompleto: true, quantidadeConcluida: 4 }),
      op('desb', 2, 'Desbaste'),
      op('met', 3, 'Metalização', { status: 'bloqueada', envioExternoEm: new Date(), recebimentoExternoEm: null }),
    ],
    () => 4,
  );
  assert.deepEqual(trilha.map((p) => [p.estado, p.disponiveis]), [['atual', 4], ['futuro', 0], ['externo', 4]]);
});

test('vizinhos devolvem de onde veio e para onde vai', () => {
  const trilha = montarTrilha([op('a', 1, 'Metalização'), op('b', 2, 'Desbaste'), op('c', 3, 'Fundição')], () => 0);
  assert.deepEqual(vizinhosNaTrilha(trilha, 'b'), {
    veioDe: { estacao: 'Metalização', tipoServico: 'SERV Metalização' },
    proxima: { estacao: 'Fundição', tipoServico: 'SERV Fundição' },
  });
  assert.deepEqual(vizinhosNaTrilha(trilha, 'a').veioDe, null);
  assert.deepEqual(vizinhosNaTrilha(trilha, 'c').proxima, null);
  assert.deepEqual(vizinhosNaTrilha(trilha, 'x'), { veioDe: null, proxima: null });
});
