import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capacidadesDe, rotaInicialPorPapel, temCapacidade } from '../src/lib/permissions';

test('sem personalização, vale o padrão do papel', () => {
  assert.equal(temCapacidade('pcp', 'dashboard_chefe'), false);
  assert.equal(temCapacidade({ papel: 'pcp', acessos: null }, 'os_criar'), true);
  assert.equal(temCapacidade({ papel: 'chefe' }, 'dashboard_chefe'), true);
});

test('PCP personalizado ganha o Painel e perde módulos retirados', () => {
  const pcp = { papel: 'pcp' as const, acessos: ['ordens_servico', 'painel_producao'] };
  assert.equal(temCapacidade(pcp, 'dashboard_chefe'), true);
  assert.equal(temCapacidade(pcp, 'os_listar'), true);
  assert.equal(temCapacidade(pcp, 'cadastros_tipos_servico'), false);
  assert.equal(temCapacidade(pcp, 'totem_acessar'), false);
  assert.equal(temCapacidade(pcp, 'fantasmas_ver'), false);
  assert.equal(temCapacidade(pcp, 'backoffice_acessar'), true, 'Capacidade fora dos módulos continua do papel.');
  assert.equal(rotaInicialPorPapel(pcp), '/');
});

test('acessos não valem para papéis fora da área administrativa', () => {
  const estacao = { papel: 'estacao' as const, acessos: ['painel_producao', 'usuarios'] };
  assert.equal(temCapacidade(estacao, 'dashboard_chefe'), false);
  assert.equal(temCapacidade(estacao, 'cadastros_pessoas'), false);
  assert.equal(temCapacidade(estacao, 'totem_acessar'), true);
});

test('admin pode ter módulos retirados, mas mantém capacidades que não são módulo', () => {
  const caps = capacidadesDe({ papel: 'admin', acessos: ['usuarios'] });
  assert.ok(caps.has('cadastros_pessoas'));
  assert.ok(!caps.has('dashboard_chefe'));
  assert.ok(caps.has('excluir_dados'));
});
