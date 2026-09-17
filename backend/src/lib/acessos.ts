// ============================================================
// Forja - Acessos por usuário
// ============================================================
// O papel dá o padrão; o admin personaliza os módulos de cada pessoa da área
// administrativa (routes/pessoas.ts). Consulta o banco a cada checagem: um
// JWT antigo não mantém acesso retirado.
// ============================================================

import { modulosDaPessoa, type ModuloAcesso, type Papel } from '@forja/shared';
import { prisma } from '../db/prisma.js';

/** Converte o registro do banco para o formato público (null = padrão do papel). */
export function acessosPublicos(p: { acessos: string[]; acessosPersonalizados: boolean }): string[] | null {
  return p.acessosPersonalizados ? p.acessos : null;
}

export async function pessoaTemModulo(pessoaId: string, modulo: ModuloAcesso): Promise<boolean> {
  const p = await prisma.pessoa.findUnique({
    where: { id: pessoaId },
    select: { papel: true, ativo: true, acessos: true, acessosPersonalizados: true },
  });
  if (!p?.ativo) return false;
  return modulosDaPessoa({ papel: p.papel as Papel, acessos: acessosPublicos(p) }).includes(modulo);
}

/** onRequest do Fastify: exige login e o módulo liberado para a pessoa. */
export function exigirModulo(modulo: ModuloAcesso) {
  return async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
    }
    if (!(await pessoaTemModulo(request.user.pessoaId, modulo))) {
      return reply.code(403).send({ error: 'forbidden', message: 'Seu usuário não tem acesso a este módulo. Fale com o administrador.' });
    }
  };
}
