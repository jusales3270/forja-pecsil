// ============================================================
// Forja - Horas previstas × realizadas (P-03), sem banco
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compararPrevistoRealizado, type OPParaComparar } from '../src/lib/previsto-realizado.js';

const agora = new Date('2026-10-18T12:00:00Z');
const h = (iso: string) => new Date(`2026-10-18T${iso}:00Z`);
const op = (o: Partial<OPParaComparar>): OPParaComparar => ({
  id: 'x', loteNumero: 1, quantidade: 10, ordem: 0, codigoOp: '10', tipoServico: 'TORNO', etapa: 'Usinagem', status: 'na_fila',
  tempoTotalPlanejado: 100, tempoSetupMin: 20, terceirizada: false, esperaHoras: null, carimbos: [], ...o,
});

test('previsto = setup + planejado; realizado = soma dos carimbos; desvio só na concluída', () => {
  const r = compararPrevistoRealizado([
    op({ id: 'a', ordem: 0, status: 'concluida', carimbos: [{ entrada: h('08:00'), saida: h('09:00') }, { entrada: h('10:00'), saida: h('11:30') }] }),
    op({ id: 'b', ordem: 1, status: 'em_processo', carimbos: [{ entrada: h('11:00'), saida: null }] }),
    op({ id: 'c', ordem: 2 }),
  ], agora);
  const [a, b, c] = r.linhas;
  assert.equal(a.previstoMin, 120);
  assert.equal(a.realizadoMin, 150);
  assert.equal(a.desvioPct, 25);
  assert.equal(b.realizadoMin, 60, 'o carimbo aberto conta até agora');
  assert.equal(b.emAndamento, true);
  assert.equal(b.desvioPct, null, 'OP em andamento não tem desvio');
  assert.equal(c.realizadoMin, null);
  assert.equal(r.totais.previstoMin, 360);
  assert.equal(r.totais.realizadoMin, 210);
  assert.equal(r.totais.concluidas, 1);
  assert.equal(r.totais.desvioConcluidasPct, 25);
  assert.equal(r.totais.faltaPrevistoMin, 240);
});

test('terceiros e esperas ficam fora da conta; ordena por lote e ordem', () => {
  const r = compararPrevistoRealizado([
    op({ id: 'z', loteNumero: 2, ordem: 0 }),
    op({ id: 't', loteNumero: 1, ordem: 1, terceirizada: true, status: 'concluida', carimbos: [{ entrada: h('08:00'), saida: h('10:00') }] }),
    op({ id: 'e', loteNumero: 1, ordem: 0, esperaHoras: 12, tempoTotalPlanejado: 0, tempoSetupMin: 0 }),
  ], agora);
  assert.deepEqual(r.linhas.map((l) => l.id), ['e', 't', 'z']);
  assert.equal(r.linhas[0].foraDaComparacao, 'espera');
  assert.equal(r.linhas[1].foraDaComparacao, 'terceiros');
  assert.equal(r.linhas[1].previstoMin, null);
  assert.equal(r.linhas[1].desvioPct, null);
  assert.equal(r.totais.foraDaComparacao, 2);
  assert.equal(r.totais.previstoMin, 120);
  assert.equal(r.totais.concluidas, 0);
  assert.equal(r.totais.desvioConcluidasPct, null);
});

test('concluída com carimbo de segundos é "sem medição": sem desvio e fora da comparação', () => {
  const r = compararPrevistoRealizado([
    op({ id: 'a', status: 'concluida', carimbos: [{ entrada: h('08:00'), saida: new Date(h('08:00').getTime() + 20_000) }] }),
    op({ id: 'b', ordem: 1, status: 'concluida', carimbos: [] }),
    op({ id: 'c', ordem: 2, status: 'concluida', carimbos: [{ entrada: h('09:00'), saida: h('11:00') }] }),
  ], agora);
  assert.equal(r.linhas[0].semMedicao, true);
  assert.equal(r.linhas[0].desvioPct, null);
  assert.equal(r.linhas[1].semMedicao, true);
  assert.equal(r.linhas[2].desvioPct, 0);
  assert.equal(r.totais.semMedicao, 2);
  assert.equal(r.totais.concluidas, 1);
  assert.equal(r.totais.desvioConcluidasPct, 0);
});
