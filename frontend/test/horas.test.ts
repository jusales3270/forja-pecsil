import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarHoras, nivelDesvio, textoDesvio } from '../src/lib/horas';

test('horas no formato do chão de fábrica', () => {
  assert.equal(formatarHoras(null), '—');
  assert.equal(formatarHoras(0), '—');
  assert.equal(formatarHoras(0.4), '<1min');
  assert.equal(formatarHoras(45), '45min');
  assert.equal(formatarHoras(150), '2h30');
  assert.equal(formatarHoras(1500), '25h');
});

test('desvio: até +10% ok, até +30% atenção, acima estourou; adiantado até 30% é ok', () => {
  assert.equal(nivelDesvio(null), 'sem');
  assert.equal(nivelDesvio(-20), 'ok');
  assert.equal(nivelDesvio(-60), 'atencao', 'muito mais rápido: o tempo do roteiro está alto');
  assert.equal(nivelDesvio(10), 'ok');
  assert.equal(nivelDesvio(25), 'atencao');
  assert.equal(nivelDesvio(31), 'estourou');
  assert.equal(textoDesvio(25), '+25%');
  assert.equal(textoDesvio(-8), '-8%');
  assert.equal(textoDesvio(null), '—');
});
