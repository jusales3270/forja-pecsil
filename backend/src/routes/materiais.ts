// ============================================================
// Forja - Lista de materiais do Artigo (Sprint 6c, Bloco A)
// ============================================================
// Endpoints:
//   GET    /api/materiais-catalogo?busca=        — busca no catálogo do Almoxarifado
//   GET    /api/artigos/:artigoId/materiais      — lista do artigo (por peça)
//   POST   /api/artigos/:artigoId/materiais      — incluir
//   PUT    /api/artigos/:artigoId/materiais/:id  — alterar
//   DELETE /api/artigos/:artigoId/materiais/:id  — retirar
//
// O catálogo vem do Business OS (Almoxarifado › Materiais, código do GRV) e
// só é lido aqui. A lista é por peça; a OS copia na liberação, com o total.
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { exigirModulo } from '../lib/acessos.js';
import { textoDeBusca } from '../lib/materiais-busca.js';

const materialSchema = z.object({
  materialCodigo: z.string().trim().max(30).nullable().optional(),
  descricao: z.string().trim().min(1, 'Informe o material').max(200),
  quantidade: z.number().positive('Quantidade deve ser maior que zero').max(1e9),
  unidade: z.string().trim().min(1, 'Informe a unidade').max(8),
  observacoes: z.string().trim().max(500).nullable().optional(),
});

export async function materiaisRoutes(app: FastifyInstance) {
  // ---------------- CATÁLOGO ----------------
  app.get('/materiais-catalogo', { onRequest: [app.authenticate] }, async (request) => {
    const q = z.object({ busca: z.string().max(80).optional(), limite: z.coerce.number().int().min(1).max(100).default(30) }).parse(request.query ?? {});
    const termo = textoDeBusca(q.busca ?? '');
    const palavras = termo.split(' ').filter(Boolean);
    const compacto = termo.replace(/[^0-9A-Z]/g, '');
    const where: Prisma.MaterialCatalogoWhereInput = {
      ativo: true,
      ...(palavras.length ? { OR: [
        ...(compacto ? [{ busca: { startsWith: compacto } }] : []),
        { AND: palavras.map((p) => ({ busca: { contains: p } })) },
      ] } : {}),
    };
    const lista = await prisma.materialCatalogo.findMany({ where, orderBy: { codigo: 'asc' }, take: 200, select: { codigo: true, descricao: true, unidade: true, familia: true, grupo: true } });
    // Código que começa com o digitado primeiro; depois o resto, em ordem de código.
    const ordenada = compacto ? [...lista].sort((a, b) => Number(!a.codigo.replace(/[^0-9A-Z]/gi, '').toUpperCase().startsWith(compacto)) - Number(!b.codigo.replace(/[^0-9A-Z]/gi, '').toUpperCase().startsWith(compacto))) : lista;
    return { data: ordenada.slice(0, q.limite) };
  });

  // ---------------- LISTA DO ARTIGO ----------------
  app.get('/artigos/:artigoId/materiais', { onRequest: [app.authenticate] }, async (request, reply) => {
    const p = z.object({ artigoId: z.string().uuid() }).safeParse(request.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    const data = await prisma.materialArtigo.findMany({ where: { artigoId: p.data.artigoId }, orderBy: { ordem: 'asc' } });
    return { data };
  });

  app.post('/artigos/:artigoId/materiais', { onRequest: [exigirModulo('artigos')] }, async (request, reply) => {
    const p = z.object({ artigoId: z.string().uuid() }).safeParse(request.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    const b = materialSchema.safeParse(request.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_input', message: b.error.issues[0]?.message ?? 'Dados inválidos', details: b.error.flatten() });
    const artigo = await prisma.artigo.findUnique({ where: { id: p.data.artigoId }, select: { id: true } });
    if (!artigo) return reply.code(404).send({ error: 'not_found', message: 'Artigo não encontrado' });
    if (b.data.materialCodigo) {
      const doCatalogo = await prisma.materialCatalogo.findUnique({ where: { codigo: b.data.materialCodigo } });
      if (!doCatalogo) return reply.code(400).send({ error: 'material_fora_do_catalogo', message: `O material ${b.data.materialCodigo} não está no catálogo.` });
    }
    const ultima = await prisma.materialArtigo.aggregate({ where: { artigoId: artigo.id }, _max: { ordem: true } });
    const data = await prisma.materialArtigo.create({
      data: { artigoId: artigo.id, materialCodigo: b.data.materialCodigo || null, descricao: b.data.descricao, quantidade: b.data.quantidade, unidade: b.data.unidade.toUpperCase(), observacoes: b.data.observacoes || null, ordem: (ultima._max.ordem ?? 0) + 1 },
    });
    return reply.code(201).send({ data });
  });

  app.put('/artigos/:artigoId/materiais/:id', { onRequest: [exigirModulo('artigos')] }, async (request, reply) => {
    const p = z.object({ artigoId: z.string().uuid(), id: z.string().uuid() }).safeParse(request.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    const b = materialSchema.partial().safeParse(request.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_input', message: b.error.issues[0]?.message ?? 'Dados inválidos' });
    const atual = await prisma.materialArtigo.findFirst({ where: { id: p.data.id, artigoId: p.data.artigoId } });
    if (!atual) return reply.code(404).send({ error: 'not_found', message: 'Material não encontrado' });
    const data = await prisma.materialArtigo.update({
      where: { id: atual.id },
      data: {
        descricao: b.data.descricao, quantidade: b.data.quantidade, unidade: b.data.unidade?.toUpperCase(),
        observacoes: b.data.observacoes === undefined ? undefined : b.data.observacoes || null,
      },
    });
    return { data };
  });

  app.delete('/artigos/:artigoId/materiais/:id', { onRequest: [exigirModulo('artigos')] }, async (request, reply) => {
    const p = z.object({ artigoId: z.string().uuid(), id: z.string().uuid() }).safeParse(request.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_input', message: 'ID inválido' });
    const apagado = await prisma.materialArtigo.deleteMany({ where: { id: p.data.id, artigoId: p.data.artigoId } });
    if (!apagado.count) return reply.code(404).send({ error: 'not_found', message: 'Material não encontrado' });
    return { data: { id: p.data.id, excluido: true } };
  });
}
