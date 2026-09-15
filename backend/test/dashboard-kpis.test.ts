import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasAtePrazo, montarIndicadores } from '../src/lib/dashboard-kpis.js';

const agora = new Date('2026-09-15T15:00:00Z');
function ordem(id: string, status: string, prazo: string, fim?: string, tipo = 'forma', cliente = 'c1') {
  return { id, status, prazoEntrega: new Date(prazo), cliente: { id: cliente, nome: cliente }, artigo: { tipoProduto: tipo }, eventos: fim ? [{ timestamp: new Date(fim) }] : [] };
}
test('prazo de hoje continua em dia até terminar o dia da fábrica', () => {
  assert.equal(diasAtePrazo(new Date('2026-09-15'), new Date('2026-09-16T02:59:59Z')), 0);
  assert.equal(diasAtePrazo(new Date('2026-09-15'), new Date('2026-09-16T03:00:00Z')), -1);
});
test('carteira calcula atraso por prazo e exclui finalizadas e canceladas', () => {
  const d = montarIndicadores([
    ordem('a', 'em_producao', '2026-09-14'), ordem('b', 'aberta', '2026-09-15'),
    ordem('c', 'cancelada', '2026-08-01'), ordem('d', 'finalizada', '2026-08-01'),
  ], agora, 90);
  assert.deepEqual(d.carteira, { total: 2, emDia: 1, atrasadas: 1, emDiaIds: ['b'], atrasadasIds: ['a'] });
  assert.equal(d.historico.semDataConclusao, 1);
});
test('histórico usa conclusão real, respeita período e agrupa cliente/tipo', () => {
  const d = montarIndicadores([
    ordem('a', 'finalizada', '2026-09-10', '2026-09-12T20:00:00Z'),
    ordem('b', 'finalizada', '2026-09-12', '2026-09-12T20:00:00Z', 'bloco', 'c2'),
    ordem('c', 'finalizada', '2026-04-01', '2026-04-04T20:00:00Z'),
    ordem('d', 'em_producao', '2026-09-10'),
  ], agora, 30);
  assert.equal(d.historico.total, 2);
  assert.equal(d.historico.pontualidade, 50);
  assert.equal(d.historico.atrasadas, 1);
  assert.deepEqual(d.historico.porCliente[0].osIds, ['a']);
  assert.equal(d.historico.porCliente[0].mediaDiasAtraso, 2);
  assert.equal(d.historico.porTipo[0].nome, 'forma');
  assert.deepEqual(d.historico.evolucao.at(-1), { mes: '2026-09', emDia: 1, atrasadas: 1 });
});
test('sem histórico não inventa taxa de pontualidade', () => {
  const d = montarIndicadores([], agora, 90);
  assert.equal(d.historico.pontualidade, null);
  assert.equal(d.historico.total, 0);
  assert.equal(d.historico.evolucao.length, 4);
});
