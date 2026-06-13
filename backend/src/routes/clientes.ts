// ============================================================
// Forja - Rotas de Clientes (read-only por enquanto)
// Cadastro/edição vem em outra fase. Aqui só pra dropdowns.
// ============================================================
//
//   GET /api/clientes — lista clientes ativos, ordenados por nome
// ============================================================

import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma.js';

export async function clientesRoutes(app: FastifyInstance) {
  app.get(
    '/clientes',
    { onRequest: [app.authenticate] },
    async () => {
      const clientes = await prisma.cliente.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          observacoes: true,
        },
      });

      return { data: clientes };
    }
  );
}
