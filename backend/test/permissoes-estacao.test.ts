// ============================================================
// Forja - Quem opera qual estação (regra pura, sem banco)
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podeOperarEtapa } from '../src/lib/permissoes-estacao.js';

const A = 'etapa-a';
const B = 'etapa-b';
const u = (papel: string, etapaId: string | null = null) => ({ pessoaId: 'x', papel, etapaId });

test('admin e pcp operam qualquer estação', () => {
  for (const papel of ['admin', 'pcp']) {
    assert.equal(podeOperarEtapa(u(papel), A), true);
    assert.equal(podeOperarEtapa(u(papel, B), A), true);
  }
});

test('chefe nunca opera', () => {
  assert.equal(podeOperarEtapa(u('chefe'), A), false);
  assert.equal(podeOperarEtapa(u('chefe', A), A), false);
});

test('operador, engenharia, inspetor, embalador e conta do posto operam só a estação vinculada', () => {
  for (const papel of ['estacao', 'operador', 'engenharia', 'inspetor', 'embalador']) {
    assert.equal(podeOperarEtapa(u(papel, A), A), true, `${papel} na própria`);
    assert.equal(podeOperarEtapa(u(papel, A), B), false, `${papel} em outra`);
    assert.equal(podeOperarEtapa(u(papel), A), false, `${papel} sem vínculo`);
  }
});

test('programador sem vínculo opera todas; com vínculo, só a dele', () => {
  assert.equal(podeOperarEtapa(u('programador'), A), true);
  assert.equal(podeOperarEtapa(u('programador', A), A), true);
  assert.equal(podeOperarEtapa(u('programador', A), B), false);
});
