import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from './env.js';
import { prisma } from '../db/prisma.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      pessoaId: string;
      papel: string;
      nome: string;
      /** Estação vinculada à conta. Nulo = sem vínculo com estação. */
      etapaId?: string | null;
    };
  }
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '12h',
    },
  });

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
    }
  });

  app.decorate('requireAdmin', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
    }
    if (request.user?.papel !== 'admin') {
      return reply.code(403).send({ error: 'forbidden', message: 'Apenas administradores têm permissão para excluir dados do sistema' });
    }
  });

  // Excluir dados (artigos, OS, operações, cadastros): administrador e PCP.
  // O papel vem do banco — um JWT antigo não mantém a permissão de quem mudou
  // de papel. Usuários continuam só com o admin (requireAdmin).
  app.decorate('requireExcluir', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
    }
    const pessoa = await prisma.pessoa.findUnique({
      where: { id: request.user?.pessoaId },
      select: { papel: true, ativo: true },
    });
    if (!pessoa?.ativo || !PAPEIS_QUE_EXCLUEM.includes(pessoa.papel)) {
      return reply.code(403).send({ error: 'forbidden', message: 'Apenas administradores e PCP têm permissão para excluir dados do sistema' });
    }
  });
}

/** Papéis que excluem dados. Espelha a capacidade `excluir_dados` do frontend. */
export const PAPEIS_QUE_EXCLUEM: string[] = ['admin', 'pcp'];

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
    requireExcluir: (request: any, reply: any) => Promise<void>;
  }
}
