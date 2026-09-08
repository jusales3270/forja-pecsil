import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';

const loginSchema = z.object({
  codigo_pessoal: z.string().min(1, 'Código pessoal é obrigatório'),
  pin: z.string().min(1, 'Senha é obrigatória'),
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
        message: 'Código ou senha inválidos',
      });
    }

    const pinOk = await bcrypt.compare(pin, pessoa.pinHash);

    if (!pinOk) {
      return reply.code(401).send({
        error: 'invalid_credentials',
        message: 'Código ou senha inválidos',
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
          codigoPessoal: pessoa.codigoPessoal,
          papel: pessoa.papel,
          ativo: pessoa.ativo,
          etapaId: pessoa.etapaId,
          etapa: pessoa.etapa,
        },
      },
    };
  });

  // GET /auth/me
  app.get(
    '/auth/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { pessoaId } = request.user;

      const pessoa = await prisma.pessoa.findUnique({
        where: { id: pessoaId },
        select: {
          id: true,
          nome: true,
          codigoPessoal: true,
          papel: true,
          ativo: true,
          etapaId: true,
          etapa: { select: { id: true, nome: true } },
        },
      });

      if (!pessoa || !pessoa.ativo) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Usuário não encontrado',
        });
      }

      return { data: pessoa };
    }
  );

  const updateMeSchema = z.object({
    nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(120).optional(),
    codigoPessoal: z
      .string()
      .min(2, 'Login deve ter ao menos 2 caracteres')
      .max(40)
      .regex(/^[a-z0-9_-]+$/i, 'Login deve conter apenas letras, números, hífen e underline')
      .optional(),
    pin: z.string().min(1, 'Senha não pode ser vazia').optional(),
  });

  // PUT /auth/me - atualiza dados do próprio usuário (nome, login e senha)
  app.put(
    '/auth/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { pessoaId } = request.user;

      const parsed = updateMeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_input',
          message: 'Dados inválidos',
          details: parsed.error.flatten(),
        });
      }

      const pessoaAtual = await prisma.pessoa.findUnique({
        where: { id: pessoaId },
      });

      if (!pessoaAtual || !pessoaAtual.ativo) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Usuário não encontrado',
        });
      }

      if (
        parsed.data.codigoPessoal &&
        parsed.data.codigoPessoal !== pessoaAtual.codigoPessoal
      ) {
        const duplicado = await prisma.pessoa.findUnique({
          where: { codigoPessoal: parsed.data.codigoPessoal },
        });
        if (duplicado) {
          return reply.code(409).send({
            error: 'duplicate_codigo',
            message: `Já existe um usuário com o login "${parsed.data.codigoPessoal}"`,
          });
        }
      }

      const updateData: Record<string, any> = {};
      if (parsed.data.nome) updateData.nome = parsed.data.nome.trim();
      if (parsed.data.codigoPessoal) updateData.codigoPessoal = parsed.data.codigoPessoal.trim();
      if (parsed.data.pin && parsed.data.pin.trim()) {
        updateData.pinHash = await bcrypt.hash(parsed.data.pin.trim(), 10);
      }

      const pessoaAtualizada = await prisma.pessoa.update({
        where: { id: pessoaId },
        data: updateData,
        select: {
          id: true,
          nome: true,
          codigoPessoal: true,
          papel: true,
          ativo: true,
          etapaId: true,
          etapa: { select: { id: true, nome: true } },
        },
      });

      const token = app.jwt.sign({
        pessoaId: pessoaAtualizada.id,
        papel: pessoaAtualizada.papel,
        nome: pessoaAtualizada.nome,
        etapaId: pessoaAtualizada.etapaId,
      });

      return {
        data: {
          token,
          pessoa: pessoaAtualizada,
        },
      };
    }
  );
}
