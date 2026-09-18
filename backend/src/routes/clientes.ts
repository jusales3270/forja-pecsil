// ============================================================
// Forja - Rotas de Clientes
// ============================================================
//
//   GET    /api/clientes      — lista clientes ativos, ordenados por nome
//   POST   /api/clientes      — cadastra (ou reativa, se o nome já existiu)
//   DELETE /api/clientes/:id  — exclui; com OS ou artigos, só desativa
//
// O PCP cadastra e remove clientes direto da Nova OS. Excluir não pode
// apagar histórico: cliente com OS ou artigos sai do dropdown (ativo=false)
// e continua nas OS antigas. Tolerâncias também seguram o cliente (cascata).
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { pessoaTemModulo } from '../lib/acessos.js';

const criarClienteSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

const selectCliente = { id: true, nome: true, observacoes: true } as const;

/** Quem abre OS ou cadastra artigos também mantém a lista de clientes. */
async function podeGerenciarClientes(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
  }
  const id = request.user.pessoaId;
  if (!(await pessoaTemModulo(id, 'ordens_servico')) && !(await pessoaTemModulo(id, 'artigos'))) {
    return reply.code(403).send({ error: 'forbidden', message: 'Seu usuário não pode cadastrar ou excluir clientes.' });
  }
}

export async function clientesRoutes(app: FastifyInstance) {
  app.get(
    '/clientes',
    { onRequest: [app.authenticate] },
    async () => {
      const clientes = await prisma.cliente.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: selectCliente,
      });

      return { data: clientes };
    }
  );

  // ---------------- CADASTRAR ----------------
  app.post('/clientes', { onRequest: [podeGerenciarClientes] }, async (request, reply) => {
    const parsed = criarClienteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos',
      });
    }
    const { nome, observacoes } = parsed.data;

    const existente = await prisma.cliente.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } },
      orderBy: { ativo: 'desc' },
    });
    if (existente?.ativo) {
      return reply.code(409).send({ error: 'duplicate_name', message: `O cliente "${existente.nome}" já está cadastrado.` });
    }
    // Excluído antes com histórico: volta a aparecer, mantendo as OS antigas
    if (existente) {
      const reativado = await prisma.cliente.update({
        where: { id: existente.id },
        data: { ativo: true, nome, ...(observacoes !== undefined ? { observacoes } : {}) },
        select: selectCliente,
      });
      return reply.code(200).send({ data: reativado, meta: { reativado: true } });
    }

    const cliente = await prisma.cliente.create({
      data: { nome, observacoes: observacoes ?? null },
      select: selectCliente,
    });
    return reply.code(201).send({ data: cliente, meta: { reativado: false } });
  });

  // ---------------- EXCLUIR ----------------
  app.delete('/clientes/:id', { onRequest: [podeGerenciarClientes] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id: params.data.id },
      select: { id: true, nome: true, ativo: true, _count: { select: { oses: true, artigos: true, toleranciasGerais: true } } },
    });
    if (!cliente || !cliente.ativo) {
      return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado' });
    }

    const { oses, artigos, toleranciasGerais } = cliente._count;
    if (oses > 0 || artigos > 0 || toleranciasGerais > 0) {
      await prisma.cliente.update({ where: { id: cliente.id }, data: { ativo: false } });
      return {
        data: { id: cliente.id, excluido: false, desativado: true },
        message: `"${cliente.nome}" tem ${oses} OS, ${artigos} artigo(s) e ${toleranciasGerais} tolerância(s) cadastradas: saiu da lista, mas o histórico foi mantido.`,
      };
    }

    await prisma.cliente.delete({ where: { id: cliente.id } });
    return { data: { id: cliente.id, excluido: true, desativado: false }, message: `"${cliente.nome}" foi excluído.` };
  });
}
