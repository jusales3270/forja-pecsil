// ============================================================
// Forja - Mapa de permissões por papel
// Fonte única da verdade pra controle de acesso no frontend.
// Backend tem sua própria validação (ver auth checks nas rotas).
// ============================================================

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
  // OS
  | 'os_listar'
  | 'os_criar'
  | 'os_editar'
  | 'os_cancelar'
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
    'os_cancelar',
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
    'os_cancelar',
    'totem_acessar',
    'totem_iniciar_op',
    'totem_encerrar_op',
    'fantasmas_ver',
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

export function temCapacidade(
  papel: Papel | undefined | null,
  capacidade: Capacidade,
): boolean {
  if (!papel) return false;
  return MAPA[papel]?.includes(capacidade) ?? false;
}

export function temAlgumaCapacidade(
  papel: Papel | undefined | null,
  capacidades: Capacidade[],
): boolean {
  return capacidades.some((c) => temCapacidade(papel, c));
}

/**
 * Para onde a pessoa deve ir depois do login.
 * Papéis "de chão de fábrica" vão direto pro tótem;
 * papéis de gestão vão pra HomePage.
 */
export function rotaInicialPorPapel(papel: Papel | undefined | null): string {
  if (!papel) return '/login';
  if (temCapacidade(papel, 'backoffice_acessar')) return '/';
  if (temCapacidade(papel, 'totem_acessar')) return '/totem';
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
