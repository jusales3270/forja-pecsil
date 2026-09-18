// ============================================================
// Forja - Mapa de permissões por papel
// Fonte única da verdade pra controle de acesso no frontend.
// Backend tem sua própria validação (ver auth checks nas rotas).
// ============================================================

import { modulosDaPessoa, PAPEIS_ACESSO_CONFIGURAVEL, type ModuloAcesso } from '@forja/shared';

export type Papel =
  | 'admin'
  | 'chefe'
  | 'pcp'
  | 'engenharia'
  | 'programador'
  | 'operador'
  | 'inspetor'
  | 'embalador'
  | 'estacao';

// ============================================================
// Capacidades (o que cada papel pode FAZER no sistema)
// ============================================================

export type Capacidade =
  // Backoffice geral
  | 'backoffice_acessar'
  // Cadastros
  | 'cadastros_tipos_servico'
  | 'cadastros_motivos_parada'
  | 'cadastros_tolerancias'
  | 'cadastros_artigos'
  | 'cadastros_clientes'
  | 'cadastros_estacoes'
  // OS
  | 'os_listar'
  | 'os_criar'
  | 'os_editar'
  | 'os_cancelar'
  | 'excluir_dados'
  // Tótem
  | 'totem_acessar'
  | 'totem_iniciar_op'
  | 'totem_encerrar_op'
  // Operador (Sprint 4)
  | 'operador_apontar_turno'
  // Inspeção (Sprint 5)
  | 'inspecao_realizar'
  // Embalagem (Sprint 7)
  | 'embalagem_confirmar'
  // Cadastro de usuários e contas de estação
  | 'cadastros_pessoas'
  // Admin
  | 'admin_configurar_sistema'
  // Lotes Fantasmas (Sprint 4 - Bloco D)
  | 'fantasmas_ver'
  // Dashboard do chefe (Sprint 6)
  | 'dashboard_chefe';

const MAPA: Record<Papel, Capacidade[]> = {
  admin: [
    'backoffice_acessar',
    'cadastros_estacoes',
    'cadastros_tipos_servico',
    'cadastros_motivos_parada',
    'cadastros_tolerancias',
    'cadastros_artigos',
    'cadastros_clientes',
    'cadastros_pessoas',
    'os_listar',
    'os_criar',
    'os_editar',
    'os_cancelar',
    'excluir_dados',
    'totem_acessar',
    'totem_iniciar_op',
    'totem_encerrar_op',
    'operador_apontar_turno',
    'inspecao_realizar',
    'embalagem_confirmar',
    'admin_configurar_sistema',
    'fantasmas_ver',
    'dashboard_chefe',
  ],

  chefe: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
    'cadastros_motivos_parada',
    'cadastros_tolerancias',
    'cadastros_artigos',
    'cadastros_clientes',
    'os_listar',
    'os_criar',
    'os_editar',
    'totem_acessar',
    'fantasmas_ver',
    'dashboard_chefe',
  ],

  pcp: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
    'cadastros_motivos_parada',
    'cadastros_tolerancias',
    'cadastros_artigos',
    'cadastros_clientes',
    'os_listar',
    'os_criar',
    'os_editar',
    'totem_acessar',
    'totem_iniciar_op',
    'totem_encerrar_op',
    'fantasmas_ver',
    // Exclui dados como o admin (usuários continuam só com o admin)
    'excluir_dados',
  ],

  engenharia: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
    'cadastros_motivos_parada',
    'cadastros_tolerancias',
    'cadastros_artigos',
    'os_listar',
    'totem_acessar',
  ],

  programador: [
    'totem_acessar',
    'totem_iniciar_op',
    'totem_encerrar_op',
  ],

  // Conta do posto de trabalho. Acessa o tótem de todas as estações, mas só
  // OPERA a sua — quem decide isso é podeOperarEstacao(), porque depende da
  // etapa aberta e não só do papel.
  estacao: [
    'totem_acessar',
    'totem_iniciar_op',
    'totem_encerrar_op',
  ],

  operador: [
    'totem_acessar',
    'operador_apontar_turno',
  ],

  inspetor: [
    'totem_acessar',
    'inspecao_realizar',
  ],

  embalador: [
    'totem_acessar',
    'embalagem_confirmar',
  ],
};

// ============================================================
// API pública
// ============================================================

// ============================================================
// Acessos por usuário (área administrativa)
// ============================================================
// O admin libera ou retira módulos de cada pessoa (PessoasPage). Cada módulo
// corresponde a um conjunto de capacidades; o que não é módulo continua
// decidido só pelo papel (ex.: excluir dados, inspeção).

const CAPACIDADES_DO_MODULO: Record<ModuloAcesso, Capacidade[]> = {
  tipos_servico: ['cadastros_tipos_servico'],
  motivos_parada: ['cadastros_motivos_parada'],
  tolerancias: ['cadastros_tolerancias'],
  artigos: ['cadastros_artigos', 'cadastros_clientes'],
  estacoes: ['cadastros_estacoes'],
  usuarios: ['cadastros_pessoas'],
  ordens_servico: ['os_listar', 'os_criar', 'os_editar'],
  totem: ['totem_acessar', 'totem_iniciar_op', 'totem_encerrar_op'],
  painel_producao: ['dashboard_chefe'],
  lotes_fantasmas: ['fantasmas_ver'],
};
const CAPACIDADES_DE_MODULO = new Set(Object.values(CAPACIDADES_DO_MODULO).flat());

/** Papel sozinho (padrão) ou a pessoa logada, com os acessos personalizados. */
export type SujeitoPermissao =
  | Papel
  | { papel?: Papel | string | null; acessos?: readonly string[] | null }
  | undefined
  | null;

export function capacidadesDe(sujeito: SujeitoPermissao): Set<Capacidade> {
  const pessoa = typeof sujeito === 'string' ? { papel: sujeito } : sujeito;
  const papel = pessoa?.papel as Papel | undefined;
  if (!papel) return new Set();
  const doPapel = MAPA[papel] ?? [];
  if (!pessoa?.acessos || !PAPEIS_ACESSO_CONFIGURAVEL.includes(papel)) return new Set(doPapel);
  const liberadas = modulosDaPessoa({ papel, acessos: pessoa.acessos }).flatMap((m) => CAPACIDADES_DO_MODULO[m]);
  return new Set([...doPapel.filter((c) => !CAPACIDADES_DE_MODULO.has(c)), ...liberadas]);
}

export function temCapacidade(sujeito: SujeitoPermissao, capacidade: Capacidade): boolean {
  return capacidadesDe(sujeito).has(capacidade);
}

export function temAlgumaCapacidade(sujeito: SujeitoPermissao, capacidades: Capacidade[]): boolean {
  const caps = capacidadesDe(sujeito);
  return capacidades.some((c) => caps.has(c));
}

/**
 * Para onde a pessoa deve ir depois do login.
 * Papéis "de chão de fábrica" vão direto pro tótem;
 * papéis de gestão vão pra HomePage.
 */
export function rotaInicialPorPapel(sujeito: SujeitoPermissao): string {
  if (!sujeito || (typeof sujeito === 'object' && !sujeito.papel)) return '/login';
  if (temCapacidade(sujeito, 'backoffice_acessar')) return '/';
  if (temCapacidade(sujeito, 'totem_acessar')) return '/totem';
  return '/';
}

// ============================================================
// Permissão por ESTAÇÃO
// ============================================================
// Espelha backend/src/lib/permissoes-estacao.ts. O mapa de capacidades acima
// diz o que o papel pode fazer; esta função diz ONDE — sem ela, a conta da
// fundição operaria o torno.
//
// O backend valida de novo em toda ação. Aqui é só pra tela não oferecer
// botão que vai tomar 403.

const SEM_ACESSO_AO_TOTEM: Papel[] = [
  'chefe',
  'operador',
  'inspetor',
  'embalador',
  'engenharia',
];

export function podeOperarEstacao(
  pessoa: { papel?: Papel | null; etapaId?: string | null } | null | undefined,
  etapaId: string | null | undefined,
): boolean {
  const papel = pessoa?.papel;
  if (!papel || !etapaId) return false;

  if (papel === 'admin' || papel === 'pcp') return true;
  if (SEM_ACESSO_AO_TOTEM.includes(papel)) return false;

  if (papel === 'estacao') return pessoa?.etapaId === etapaId;

  if (papel === 'programador') {
    // Sem vínculo, opera tudo — é o comportamento de antes das contas de estação.
    return pessoa?.etapaId == null || pessoa?.etapaId === etapaId;
  }

  return false;
}
