// ============================================================
// Forja - Rotas de Pessoas e contas de estação
// ============================================================
//   GET    /api/pessoas       — lista (filtros: papel, ativo)
//   POST   /api/pessoas       — cria (admin)
//   PUT    /api/pessoas/:id   — atualiza; PIN só se vier preenchido (admin)
//   DELETE /api/pessoas/:id   — desativa, não apaga (admin)
//
// Uma CONTA DE ESTAÇÃO é uma Pessoa com papel `estacao` e `etapaId` da sua
// etapa: login do posto de trabalho, compartilhado por quem estiver ali. Ela
// opera a própria estação e enxerga as demais sem poder alterar nada.
//
// Quem realmente executou continua sendo o operador escolhido no modal de
// iniciar a OP — a conta da estação não apaga a assinatura individual.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma, Papel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';

const PAPEIS = [
  'admin',
  'chefe',
  'pcp',
  'engenharia',
  'programador',
  'operador',
  'inspetor',
  'embalador',
  'estacao',
] as const;

const listaQuerySchema = z.object({
  papel: z.enum(PAPEIS).optional(),
  ativo: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const criarPessoaSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  codigoPessoal: z
    .string()
    .min(2, 'Código deve ter ao menos 2 caracteres')
    .max(40)
    .regex(/^[a-z0-9_-]+$/i, 'Use apenas letras, números, hífen e underline'),
  pin: z.string().min(1, 'Senha é obrigatória'),
  papel: z.enum(PAPEIS),
  /** Estação que a conta opera. Obrigatória quando o papel é `estacao`. */
  etapaId: z.string().uuid('etapaId inválido').nullable().optional(),
  ativo: z.boolean().optional(),
});

const atualizarPessoaSchema = criarPessoaSchema
  .partial()
  // No update o PIN/senha é opcional: vazio significa "não mexer na senha".
  .extend({ pin: z.string().min(1).nullable().optional() });

const SELECT_PESSOA = {
  id: true,
  nome: true,
  codigoPessoal: true,
  papel: true,
  ativo: true,
  etapaId: true,
  etapa: { select: { id: true, nome: true } },
} satisfies Prisma.PessoaSelect;

function ehAdmin(request: any): boolean {
  return (request.user as any)?.papel === 'admin';
}

export async function pessoasRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get('/pessoas', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = listaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Filtros inválidos',
        details: parsed.error.flatten(),
      });
    }

    const where: Prisma.PessoaWhereInput = {};
    if (parsed.data.papel) where.papel = parsed.data.papel as Papel;
    if (parsed.data.ativo !== undefined) where.ativo = parsed.data.ativo;

    const pessoas = await prisma.pessoa.findMany({
      where,
      orderBy: [{ papel: 'asc' }, { nome: 'asc' }],
      select: SELECT_PESSOA,
    });

    return { data: pessoas };
  });

  // ---------------- CRIAR ----------------
  app.post('/pessoas', { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!ehAdmin(request)) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Apenas o admin cadastra usuários e contas de estação',
      });
    }

    const parsed = criarPessoaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Dados inválidos',
        details: parsed.error.flatten(),
      });
    }

    const erro = await validarVinculo(parsed.data.papel, parsed.data.etapaId ?? null);
    if (erro) return reply.code(400).send(erro);

    const duplicado = await prisma.pessoa.findUnique({
      where: { codigoPessoal: parsed.data.codigoPessoal },
    });
    if (duplicado) {
      return reply.code(409).send({
        error: 'duplicate_codigo',
        message: `Já existe um usuário com o código "${parsed.data.codigoPessoal}"`,
      });
    }

    const pessoa = await prisma.pessoa.create({
      data: {
        nome: parsed.data.nome,
        codigoPessoal: parsed.data.codigoPessoal,
        pinHash: await bcrypt.hash(parsed.data.pin, 10),
        papel: parsed.data.papel as Papel,
        etapaId: parsed.data.etapaId ?? null,
        ativo: parsed.data.ativo ?? true,
      },
      select: SELECT_PESSOA,
    });

    return reply.code(201).send({ data: pessoa });
  });

  // ---------------- ATUALIZAR ----------------
  app.put('/pessoas/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!ehAdmin(request)) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Apenas o admin edita usuários e contas de estação',
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    }

    const parsed = atualizarPessoaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Dados inválidos',
        details: parsed.error.flatten(),
      });
    }

    const atual = await prisma.pessoa.findUnique({ where: { id: params.data.id } });
    if (!atual) {
      return reply.code(404).send({ error: 'not_found', message: 'Usuário não encontrado' });
    }

    const papelFinal = parsed.data.papel ?? atual.papel;
    const etapaFinal =
      parsed.data.etapaId !== undefined ? parsed.data.etapaId : atual.etapaId;
    const erro = await validarVinculo(papelFinal, etapaFinal);
    if (erro) return reply.code(400).send(erro);

    if (parsed.data.codigoPessoal && parsed.data.codigoPessoal !== atual.codigoPessoal) {
      const duplicado = await prisma.pessoa.findUnique({
        where: { codigoPessoal: parsed.data.codigoPessoal },
      });
      if (duplicado) {
        return reply.code(409).send({
          error: 'duplicate_codigo',
          message: `Já existe um usuário com o código "${parsed.data.codigoPessoal}"`,
        });
      }
    }

    const pessoa = await prisma.pessoa.update({
      where: { id: params.data.id },
      data: {
        ...(parsed.data.nome !== undefined ? { nome: parsed.data.nome } : {}),
        ...(parsed.data.codigoPessoal !== undefined
          ? { codigoPessoal: parsed.data.codigoPessoal }
          : {}),
        ...(parsed.data.papel !== undefined ? { papel: parsed.data.papel as Papel } : {}),
        ...(parsed.data.etapaId !== undefined ? { etapaId: parsed.data.etapaId } : {}),
        ...(parsed.data.ativo !== undefined ? { ativo: parsed.data.ativo } : {}),
        // PIN em branco = mantém o atual. Trocar senha é ação deliberada.
        ...(parsed.data.pin ? { pinHash: await bcrypt.hash(parsed.data.pin, 10) } : {}),
      },
      select: SELECT_PESSOA,
    });

    return { data: pessoa };
  });

  // ---------------- DESATIVAR OU EXCLUIR ----------------
  app.delete('/pessoas/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    if (!ehAdmin(request)) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Apenas o admin gerencia usuários',
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    }

    if (params.data.id === (request.user as any).pessoaId) {
      return reply.code(400).send({
        error: 'auto_desativacao',
        message: 'Você não pode desativar ou excluir a própria conta',
      });
    }

    const query = z
      .object({
        hard: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((v) => v === 'true'),
      })
      .safeParse(request.query);

    const hardDelete = query.success && query.data.hard;

    if (hardDelete) {
      try {
        await prisma.pessoa.delete({
          where: { id: params.data.id },
        });
        return { data: { id: params.data.id, excluido: true }, message: 'Usuário excluído com sucesso' };
      } catch (err: any) {
        // Se houver histórico de produção vinculado (FKs), desativa em vez de falhar
        const pessoa = await prisma.pessoa.update({
          where: { id: params.data.id },
          data: { ativo: false },
          select: SELECT_PESSOA,
        });
        return reply.code(200).send({
          data: pessoa,
          message: 'Usuário possui histórico de produção vinculado e foi desativado para preservar os registros.',
        });
      }
    }

    const pessoa = await prisma.pessoa.update({
      where: { id: params.data.id },
      data: { ativo: false },
      select: SELECT_PESSOA,
    });

    return { data: pessoa };
  });
}

/**
 * Conta de estação sem estação não opera nada — seria um login inútil.
 * Os demais papéis podem ter estação (restringe o programador a um posto)
 * ou não.
 */
async function validarVinculo(
  papel: string,
  etapaId: string | null,
): Promise<{ error: string; message: string } | null> {
  if (papel === 'estacao' && !etapaId) {
    return {
      error: 'estacao_obrigatoria',
      message: 'Conta de estação precisa estar vinculada a uma estação',
    };
  }

  if (etapaId) {
    const etapa = await prisma.etapa.findUnique({ where: { id: etapaId } });
    if (!etapa) {
      return { error: 'etapa_not_found', message: 'Estação informada não existe' };
    }
  }

  return null;
}
