// ============================================================
// Forja - Quem pode operar qual estação
// ============================================================
// Até aqui o tótem não sabia de estação nenhuma: qualquer programador
// iniciava, encerrava e apontava peça em qualquer posto. Pior, o
// apontamento peça a peça não tinha checagem alguma — qualquer usuário
// autenticado somava peça em qualquer OP do sistema.
//
// Isso importa porque a contagem de peças alimenta o aviso que a engenharia
// usa pra se programar. Apontamento na estação errada infla o número e
// ninguém descobre de onde veio.
//
// A regra agora:
//   admin, pcp   → operam qualquer estação (o PCP precisa destravar as coisas)
//   chefe        → nunca opera; acompanha pelo painel
//   estacao      → só a própria (a conta do posto de trabalho)
//   programador  → a sua estação, se tiver uma; senão, todas (como era antes)
//   operador, engenharia, inspetor, embalador
//                → só a estação vinculada no cadastro (Pessoas → Estação
//                  Pertencente); sem vínculo, só visualizam
// ============================================================

import { prisma } from '../db/prisma.js';

export interface UsuarioToken {
  pessoaId: string;
  papel: string;
  /** Estação vinculada à conta. Nulo = sem vínculo. */
  etapaId?: string | null;
}

/** Papéis que operam só a estação vinculada no cadastro. */
const OPERAM_A_PROPRIA_ESTACAO = ['estacao', 'operador', 'engenharia', 'inspetor', 'embalador'];

export function podeOperarEtapa(user: UsuarioToken, etapaId: string): boolean {
  if (user.papel === 'admin' || user.papel === 'pcp') return true;

  if (OPERAM_A_PROPRIA_ESTACAO.includes(user.papel)) {
    return user.etapaId != null && user.etapaId === etapaId;
  }

  if (user.papel === 'programador') {
    // Programador preso a uma estação só opera a dele. Sem vínculo, mantém o
    // comportamento antigo — ninguém perde acesso na virada.
    return user.etapaId == null || user.etapaId === etapaId;
  }

  // chefe e qualquer papel novo: não operam
  return false;
}

/**
 * Papel e estação ATUAIS da pessoa, lidos do banco. O token guarda o que valia
 * no login; sem isso, vincular alguém a uma estação só teria efeito depois de
 * sair e entrar de novo. Conta desativada perde o acesso na hora.
 */
export async function usuarioAtual(user: UsuarioToken): Promise<UsuarioToken | null> {
  const pessoa = await prisma.pessoa.findUnique({
    where: { id: user.pessoaId },
    select: { papel: true, etapaId: true, ativo: true },
  });
  if (!pessoa?.ativo) return null;
  return { pessoaId: user.pessoaId, papel: pessoa.papel, etapaId: pessoa.etapaId };
}

/**
 * Mensagem de 403 que diz o que fazer, não só que não pode.
 * `nomeEtapa` é o nome da estação dona da OP.
 */
export function mensagemEstacaoErrada(nomeEtapa: string): string {
  return `Esta OP é da estação ${nomeEtapa}. Entre com a conta dessa estação para operar.`;
}

/**
 * Guard das rotas que agem sobre uma OP: descobre a estação dona e decide.
 * Devolve `null` quando pode seguir, ou o corpo do 403 quando não pode.
 *
 * Fica aqui, e não em cada rota, porque a regra tem que ser a mesma nos quatro
 * pontos do tótem e no apontamento de peça — que hoje não tem checagem nenhuma.
 */
export async function checarEstacaoDaOP(
  user: UsuarioToken,
  opLoteId: string,
): Promise<{ error: string; message: string } | null> {
  const op = await prisma.oPLote.findUnique({
    where: { id: opLoteId },
    select: { envioExternoEm: true, etapaId: true, etapa: { select: { nome: true } } },
  });

  // OP inexistente não é problema de permissão: deixa a rota devolver o 404.
  if (!op) return null;

  const atual = await usuarioAtual(user);
  if (atual && podeOperarEtapa(atual, op.etapaId)) {
    if (op.envioExternoEm) return {
      error: 'envio_externo',
      message: 'Esta OP foi enviada para metalização externa. Use Confirmar recebimento na aba ENVIO EXTERNO.',
    };
    return null;
  }

  return {
    error: 'estacao_incorreta',
    message: mensagemEstacaoErrada(op.etapa?.nome ?? 'outra'),
  };
}
