// ============================================================
// Forja - Painel de Lotes Fantasmas v1 (Sprint 4 - Bloco D)
// Visibilidade de gaps de apontamento: causa raiz comportamental
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const querySchema = z.object({
  horas: z.coerce.number().int().min(1).max(72).default(4),
});

export async function lotesFantasmasRoutes(app: FastifyInstance) {
  // GET /api/lotes-fantasmas?horas=4
  app.get('/lotes-fantasmas', { onRequest: [app.authenticate] }, async (request) => {
    const { horas } = querySchema.parse(request.query);
    const limite = new Date(Date.now() - horas * 60 * 60 * 1000);

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);
    const fimOntem = new Date(ontem);
    fimOntem.setHours(23, 59, 59, 999);

    // 1) OPs em processo com carimbo aberto (sem saida) ha > X horas
    const carimbosParados = await prisma.carimbo.findMany({
      where: {
        timestampSaida: null,
        timestampEntrada: { lt: limite },
        opLote: { status: 'em_processo' },
      },
      include: {
        opLote: {
          include: { lote: { include: { os: { include: { cliente: true } } } } },
        },
        etapa: true,
        maquina: true,
        programador: true,
        operadorResponsavel: true,
      },
      orderBy: { timestampEntrada: 'asc' },
    });

    const opsParadas = carimbosParados.map((c) => ({
      carimboId: c.id,
      opLoteId: c.opLoteId,
      codigoOp: c.opLote.codigoOp,
      codigoGrv: c.opLote.lote.os.codigoGrv,
      cliente: c.opLote.lote.os.cliente.nome,
      etapa: c.etapa.nome,
      maquina: c.maquina?.nome ?? null,
      programador: c.programador?.nome ?? null,
      operador: c.operadorResponsavel?.nome ?? null,
      desde: c.timestampEntrada,
      horasParado: Math.floor((Date.now() - c.timestampEntrada.getTime()) / 3_600_000),
      quantidadeConcluida: c.quantidadeConcluida,
    }));

    // 2) Processamentos rodando ha > X horas (operador ativo na maquina)
    const processamentosLongos = await prisma.processamentoMaquina.findMany({
      where: {
        status: 'rodando',
        inicio: { lt: limite },
      },
      include: {
        opLote: true,
        maquina: true,
        operador: true,
      },
      orderBy: { inicio: 'asc' },
    });

    const maquinasSemRegistro = processamentosLongos.map((p) => ({
      processamentoId: p.id,
      opLoteId: p.opLoteId,
      codigoOp: p.opLote.codigoOp,
      maquina: p.maquina.nome,
      operador: p.operador.nome,
      desde: p.inicio,
      horasRodando: Math.floor((Date.now() - p.inicio.getTime()) / 3_600_000),
    }));

    // 3) Turnos nao fechados de ontem
    // (ApontamentoTurno e o registro de fechamento; ausencia = turno nao fechado)
    const operadores = await prisma.pessoa.findMany({
      where: { papel: 'operador', ativo: true },
      select: { id: true, nome: true },
    });

    const turnosOntem = await prisma.apontamentoTurno.findMany({
      where: { data: { gte: ontem, lte: fimOntem } },
      select: { operadorId: true },
    });
    const fecharam = new Set(turnosOntem.map((t) => t.operadorId));

    const turnosNaoFechados = operadores
      .filter((o) => !fecharam.has(o.id))
      .map((o) => ({ operadorId: o.id, operador: o.nome, data: ontem }));

    return {
      parametros: { horas, referenciaTurno: ontem },
      resumo: {
        opsParadas: opsParadas.length,
        maquinasSemRegistro: maquinasSemRegistro.length,
        turnosNaoFechados: turnosNaoFechados.length,
      },
      opsParadas,
      maquinasSemRegistro,
      turnosNaoFechados,
    };
  });
}
