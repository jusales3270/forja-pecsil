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
  | 'embalador';

// ============================================================
// Capacidades (o que cada papel pode FAZER no sistema)
// ============================================================

export type Capacidade =
  // Backoffice geral
  | 'backoffice_acessar'
  // Cadastros
  | 'cadastros_tipos_servico'
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
  // Admin
  | 'admin_configurar_sistema';

const MAPA: Record<Papel, Capacidade[]> = {
  admin: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
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
    'operador_apontar_turno',
    'inspecao_realizar',
    'embalagem_confirmar',
    'admin_configurar_sistema',
  ],

  chefe: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
    'cadastros_tolerancias',
    'cadastros_artigos',
    'cadastros_clientes',
    'os_listar',
    'os_criar',
    'os_editar',
    'os_cancelar',
    'totem_acessar',
  ],

  pcp: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
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
  ],

  engenharia: [
    'backoffice_acessar',
    'cadastros_tipos_servico',
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
