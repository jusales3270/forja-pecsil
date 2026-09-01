import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';

const loginSchema = z.object({
  codigo_pessoal: z.string().min(1, 'Código pessoal é obrigatório'),
  pin: z.string().min(4, 'PIN deve ter ao menos 4 dígitos'),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Dados inválidos',
        details: parsed.error.flatten(),
      });
    }

    const { codigo_pessoal, pin } = parsed.data;

    const pessoa = await prisma.pessoa.findUnique({
      where: { codigoPessoal: codigo_pessoal },
      include: { etapa: { select: { id: true, nome: true } } },
    });

    if (!pessoa || !pessoa.ativo) {
      return reply.code(401).send({
        error: 'invalid_credentials',
        message: 'Código ou PIN inválidos',
      });
    }

    const pinOk = await bcrypt.compare(pin, pessoa.pinHash);

    if (!pinOk) {
      return reply.code(401).send({
        error: 'invalid_credentials',
        message: 'Código ou PIN inválidos',
      });
    }

    // etapaId vai no token pra decidir permissão de estação sem ir ao banco
    // a cada apontamento de peça.
    const token = app.jwt.sign({
      pessoaId: pessoa.id,
      papel: pessoa.papel,
      nome: pessoa.nome,
      etapaId: pessoa.etapaId,
    });

    return {
      data: {
        token,
        pessoa: {
          id: pessoa.id,
          nome: pessoa.nome,
          papel: pessoa.papel,
          ativo: pessoa.ativo,
          etapaId: pessoa.etapaId,
          etapa: pessoa.etapa,
        },
      },
    };
  });

  // GET /auth/me - retorna dados do usuário logado
  app.get(
    '/auth/me',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { pessoaId } = request.user;

      const pessoa = await prisma.pessoa.findUnique({
        where: { id: pessoaId },
        select: {
          id: true,
          nome: true,
          papel: true,
          ativo: true,
          codigoPessoal: true,
          etapaId: true,
          etapa: { select: { id: true, nome: true } },
        },
      });

      if (!pessoa) {
        throw new Error('Pessoa não encontrada');
      }

      return { data: pessoa };
    }
  );
}
