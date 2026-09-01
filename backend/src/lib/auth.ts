import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from './env.js';

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
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
