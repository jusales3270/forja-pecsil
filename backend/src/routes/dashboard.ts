// ============================================================
// Forja - Dashboard do Chefe (Sprint 6)
// Agregacao de producao: OS por status, OPs por etapa,
// OS atrasadas, resumo de inspecao.
// ============================================================

import { FastifyInstance } from 'fastify';
import { isPcp } from '@forja/shared';
import { prisma } from '../db/prisma.js';
import { z } from 'zod';
import { calcularFluxoDePecas } from '../lib/fluxo-pecas.js';
import { diasAtePrazo, montarIndicadores } from '../lib/dashboard-kpis.js';
import { montarPipelineEtapa, listarEtapasComFases } from '../lib/pipeline-etapa.js';
import { montarTrilha, vizinhosNaTrilha, type PassoTrilha } from '../lib/roteiro-os.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard  -> visao macro pro chefe
  app.get('/dashboard', { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = z.object({
      clienteId: z.string().uuid().optional(),
      tipoProduto: z.enum(['forma', 'bloco', 'fundo_forma', 'fundo_bloco', 'molde']).optional(),
      dias: z.coerce.number().refine(n => [30, 90, 180, 365].includes(n)).default(90),
    }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: 'Filtros inválidos.' });
    const { clienteId, tipoProduto, dias } = parsed.data;
    const filtro = { ...(clienteId ? { clienteId } : {}), ...(tipoProduto ? { artigo: { tipoProduto } } : {}) };
    const agora = new Date();

    // OS por status
    const todasOS = await prisma.oS.findMany({
      where: filtro,
      select: {
        id: true,
        codigoGrv: true,
        prazoEntrega: true,
        prioridade: true,
        status: true,
        quantidadeTotal: true,
        cliente: { select: { id: true, nome: true } },
        artigo: { select: { codigo: true, descricao: true, tipoProduto: true } },
        eventos: { where: { tipo: 'os_finalizada' }, orderBy: { timestamp: 'desc' }, take: 1, select: { timestamp: true } },
      },
      orderBy: { prazoEntrega: 'asc' },
    });
    const osPorStatus: Record<string, number> = {};
    const osPorStatusLista: Record<string, typeof todasOS> = {};
    for (const os of todasOS) {
      osPorStatus[os.status] = (osPorStatus[os.status] ?? 0) + 1;
      (osPorStatusLista[os.status] ??= []).push(os);
    }

    // OS atrasadas: prazo vencido e nao finalizada/cancelada
    const osAtrasadas = todasOS.filter(os => !['finalizada', 'cancelada'].includes(os.status) && diasAtePrazo(os.prazoEntrega, agora) < 0);
    // Atraso é calculado pelo prazo, não pelo status gravado na OS.
    osPorStatus.atrasada = osAtrasadas.length;
    osPorStatusLista.atrasada = osAtrasadas;
    const indicadores = montarIndicadores(todasOS, agora, dias);
    const clientes = await prisma.cliente.findMany({ where: { oses: { some: {} } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } });

    // OPs por etapa x status (Kanban)
    // Kanban: lotes reais por etapa (cada OP vira um card), exceto concluidas
    const etapas = (await prisma.etapa.findMany({
      select: { id: true, nome: true, ordemPadrao: true },
      orderBy: { ordemPadrao: 'asc' },
    })).filter(et => !isPcp(et.nome)); // PCP é estação só de mensagens

    const opsAtivas = await prisma.oPLote.findMany({
      where: { status: { notIn: ['concluida'] }, lote: { os: { ...filtro, status: { notIn: ['finalizada', 'cancelada'] } } } },
      select: {
        id: true,
        codigoOp: true,
        etapaId: true,
        loteId: true,
        ordem: true,
        tipoServico: true,
        tempoUnitPlanejado: true,
        exigeLoteCompleto: true,
        envioExternoEm: true,
        recebimentoExternoEm: true,
        quantidadeEnvioExterno: true,
        fornecedor: true,
        status: true,
        criadoEm: true,
        carimbos: {
          where: { timestampSaida: null },
          orderBy: { timestampEntrada: 'desc' },
          take: 1,
          select: {
            maquina: { select: { nome: true } },
            timestampEntrada: true,
            operadorResponsavel: { select: { nome: true } },
            programador: { select: { nome: true } },
          },
        },
        lote: {
          select: {
            numeroLote: true,
            quantidadePecas: true,
            os: {
              select: {
                id: true,
                codigoGrv: true,
                prazoEntrega: true,
                prioridade: true,
                cliente: { select: { nome: true } },
                artigo: { select: { codigo: true, descricao: true, tipoProduto: true } },
              },
            },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    // Roteiro completo de cada lote ativo (inclui operações já concluídas):
    // cada peça segue a ordem do PCP, e o chefe precisa ver o caminho inteiro.
    const lotesAtivos = await prisma.lote.findMany({
      where: { os: { ...filtro, status: { notIn: ['finalizada', 'cancelada'] } } },
      select: {
        id: true,
        numeroLote: true,
        quantidadePecas: true,
        status: true,
        os: {
          select: {
            id: true, codigoGrv: true, prazoEntrega: true, prioridade: true, status: true,
            cliente: { select: { nome: true } },
            artigo: { select: { codigo: true, descricao: true } },
          },
        },
        opsLote: {
          select: {
            id: true, ordem: true, codigoOp: true, tipoServico: true, status: true, quantidadeConcluida: true,
            exigeLoteCompleto: true, envioExternoEm: true, recebimentoExternoEm: true,
            etapa: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: [{ os: { prazoEntrega: 'asc' } }, { numeroLote: 'asc' }],
    });
    const fluxo = await calcularFluxoDePecas([...new Set([...opsAtivas.map(o => o.loteId), ...lotesAtivos.map(l => l.id)])]);
    const trilhaPorLote = new Map<string, PassoTrilha[]>(
      lotesAtivos.map(l => [l.id, montarTrilha(l.opsLote, id => fluxo.get(id)?.disponiveis ?? 0)]),
    );
    const roteirosPorOS = new Map<string, {
      osId: string; codigoGrv: string; cliente: string; artigo: string; descricao: string; prioridade: string;
      prazoEntrega: Date; diasAtePrazo: number; semaforo: 'verde' | 'amarelo' | 'vermelho';
      lotes: { loteId: string; numeroLote: number; quantidadePecas: number; passos: PassoTrilha[] }[];
    }>();
    for (const l of lotesAtivos) {
      if (l.status === 'concluido') continue;
      const dias = diasAtePrazo(l.os.prazoEntrega, agora);
      const r = roteirosPorOS.get(l.os.id) ?? {
        osId: l.os.id, codigoGrv: l.os.codigoGrv, cliente: l.os.cliente.nome, artigo: l.os.artigo.codigo,
        descricao: l.os.artigo.descricao, prioridade: l.os.prioridade, prazoEntrega: l.os.prazoEntrega, diasAtePrazo: dias,
        semaforo: dias < 3 ? 'vermelho' as const : dias < 7 ? 'amarelo' as const : 'verde' as const,
        lotes: [],
      };
      r.lotes.push({ loteId: l.id, numeroLote: l.numeroLote, quantidadePecas: l.quantidadePecas, passos: trilhaPorLote.get(l.id)! });
      roteirosPorOS.set(l.os.id, r);
    }
    const roteiros = [...roteirosPorOS.values()].sort((a, b) =>
      Number(b.prioridade === 'urgente') - Number(a.prioridade === 'urgente') || a.diasAtePrazo - b.diasAtePrazo);
    const emExterno = (op: typeof opsAtivas[number]) => !!op.envioExternoEm && !op.recebimentoExternoEm;
    const travas = new Map<string, number>();
    for (const op of opsAtivas) if (op.exigeLoteCompleto) travas.set(op.loteId, Math.min(travas.get(op.loteId) ?? Infinity, op.ordem));
    const opsVisiveis = opsAtivas.filter(op => {
      if (op.status !== 'na_fila') return true;
      const travada = (travas.get(op.loteId) ?? Infinity) < op.ordem;
      return !travada && (fluxo.get(op.id)?.disponiveis ?? 0) > 0;
    });
    const enviosExternos = opsAtivas.filter(emExterno).map(op => ({
      opLoteId: op.id, osId: op.lote.os.id, codigoGrv: op.lote.os.codigoGrv,
      codigoOp: op.codigoOp, tipoServico: op.tipoServico, numeroLote: op.lote.numeroLote,
      cliente: op.lote.os.cliente.nome, artigo: op.lote.os.artigo.codigo, descricao: op.lote.os.artigo.descricao,
      tipoProduto: op.lote.os.artigo.tipoProduto, fornecedor: op.fornecedor,
      quantidade: op.quantidadeEnvioExterno, enviadoEm: op.envioExternoEm,
      diasFora: Math.floor((agora.getTime() - op.envioExternoEm!.getTime()) / 86_400_000),
      prazoEntrega: op.lote.os.prazoEntrega, diasAtePrazo: diasAtePrazo(op.lote.os.prazoEntrega, agora),
    })).sort((a, b) => b.diasFora - a.diasFora);

    const gargalos = etapas.map(et => {
      const ops = opsVisiveis.filter(op => op.etapaId === et.id && !emExterno(op));
      const pecas = ops.reduce((sum, op) => sum + (fluxo.get(op.id)?.disponiveis ?? 0), 0);
      const cargaMinutos = ops.reduce((sum, op) => sum + (fluxo.get(op.id)?.disponiveis ?? 0) * op.tempoUnitPlanejado, 0);
      return { etapaId: et.id, nome: et.nome, operacoes: ops.length, pecas,
        horasPlanejadas: Math.round(cargaMinutos / 60 * 10) / 10,
        osAtrasadas: new Set(ops.filter(o => diasAtePrazo(o.lote.os.prazoEntrega, agora) < 0).map(o => o.lote.os.id)).size,
        osIds: [...new Set(ops.map(o => o.lote.os.id))] };
    }).sort((a, b) => b.horasPlanejadas - a.horasPlanejadas || b.operacoes - a.operacoes);

    const kanban = etapas.map((et) => {
      const cards = opsVisiveis
        .filter((op) => op.etapaId === et.id)
        .map((op) => {
          const prazo = op.lote.os.prazoEntrega;
          const dias = diasAtePrazo(prazo, agora);
          let semaforo: 'verde' | 'amarelo' | 'vermelho' = 'verde';
          if (dias < 3) semaforo = 'vermelho';
          else if (dias < 7) semaforo = 'amarelo';
          const carimbo = op.carimbos[0];
          return {
            opLoteId: op.id,
            osId: op.lote.os.id,
            externo: emExterno(op),
            fornecedor: op.fornecedor,
            quantidade: emExterno(op) ? op.quantidadeEnvioExterno ?? 0 : fluxo.get(op.id)?.disponiveis ?? 0,
            codigoOp: op.codigoOp,
            codigoGrv: op.lote.os.codigoGrv,
            numeroLote: op.lote.numeroLote,
            cliente: op.lote.os.cliente.nome,
            artigo: op.lote.os.artigo.codigo,
            status: op.status,
            prioridade: op.lote.os.prioridade,
            diasAtePrazo: dias,
            semaforo,
            operador: carimbo?.operadorResponsavel?.nome ?? null,
            programador: carimbo?.programador?.nome ?? null,
            maquina: carimbo?.maquina?.nome ?? null,
            // De onde a OS veio e para onde vai: a ordem é a do roteiro do PCP
            ...vizinhosNaTrilha(trilhaPorLote.get(op.loteId) ?? [], op.id),
          };
        });
      return { etapaId: et.id, nome: et.nome, ordemPadrao: et.ordemPadrao, total: cards.length, cards };
    });

    // Resumo de inspecao (ultimas concluidas)
    const inspecaoRaw = await prisma.inspecaoOP.groupBy({
      by: ['resultado'],
      where: { resultado: { not: null }, opLote: { lote: { os: filtro } } },
      _count: { _all: true },
    });
    const inspecao: Record<string, number> = {};
    for (const r of inspecaoRaw) if (r.resultado) inspecao[r.resultado] = r._count._all;

    // Lotes Fantasmas v2: gaps de apontamento (limite fixo de 4h pro painel TV)
    const limite4h = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const carimbosParados = await prisma.carimbo.findMany({
      where: {
        timestampSaida: null,
        timestampEntrada: { lt: limite4h },
        opLote: { status: 'em_processo', envioExternoEm: null, lote: { os: { ...filtro, status: { notIn: ['finalizada', 'cancelada'] } } } },
      },
      include: {
        opLote: { include: { lote: { include: { os: true } } } },
        etapa: true,
      },
      orderBy: { timestampEntrada: 'asc' },
      take: 20,
    });
    const opsParadas = carimbosParados.map((c) => ({
      codigoOp: c.opLote.codigoOp,
      codigoGrv: c.opLote.lote.os.codigoGrv,
      etapa: c.etapa.nome,
      horasParado: Math.floor((Date.now() - c.timestampEntrada.getTime()) / 3_600_000),
    }));

    // Paradas ativas agora — o que está parado, desde quando e por quê
    const paradasAtivasRaw = await prisma.paradaMaquina.findMany({
      where: { fim: null, carimbo: { opLote: { lote: { os: { ...filtro, status: { notIn: ['finalizada', 'cancelada'] } } } } } },
      include: {
        motivoParada: { select: { id: true, nome: true, planejado: true } },
        carimbo: {
          select: {
            maquina: { select: { id: true, nome: true, codigoInterno: true } },
            opLote: {
              select: {
                codigoOp: true,
                etapa: { select: { nome: true } },
                lote: {
                  select: {
                    os: {
                      select: {
                        codigoGrv: true,
                        cliente: { select: { nome: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { inicio: 'asc' },
    });
    const paradasAtivas = paradasAtivasRaw.map((p) => ({
      id: p.id,
      motivo: p.motivoParada.nome,
      planejado: p.motivoParada.planejado,
      maquina: p.carimbo.maquina?.nome ?? null,
      codigoOp: p.carimbo.opLote.codigoOp,
      etapa: p.carimbo.opLote.etapa.nome,
      codigoGrv: p.carimbo.opLote.lote.os.codigoGrv,
      cliente: p.carimbo.opLote.lote.os.cliente.nome,
      inicio: p.inicio,
      minutosParado: Math.floor((agora.getTime() - p.inicio.getTime()) / 60_000),
    }));

    // Paradas de hoje, agregadas por motivo (disponibilidade de máquina)
    const inicioHoje = new Date(agora);
    inicioHoje.setHours(0, 0, 0, 0);
    const paradasHojeRaw = await prisma.paradaMaquina.findMany({
      where: { inicio: { gte: inicioHoje }, carimbo: { opLote: { lote: { os: filtro } } } },
      select: {
        inicio: true,
        fim: true,
        motivoParada: { select: { nome: true, planejado: true } },
      },
    });
    const paradasPorMotivoHoje: Record<
      string,
      { minutos: number; ocorrencias: number; planejado: boolean }
    > = {};
    for (const p of paradasHojeRaw) {
      const fim = p.fim ?? agora;
      const minutos = Math.max(0, Math.round((fim.getTime() - p.inicio.getTime()) / 60_000));
      const key = p.motivoParada.nome;
      if (!paradasPorMotivoHoje[key]) {
        paradasPorMotivoHoje[key] = { minutos: 0, ocorrencias: 0, planejado: p.motivoParada.planejado };
      }
      paradasPorMotivoHoje[key].minutos += minutos;
      paradasPorMotivoHoje[key].ocorrencias += 1;
    }

    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);
    const fimOntem = new Date(ontem);
    fimOntem.setHours(23, 59, 59, 999);
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
      .map((o) => ({ operador: o.nome }));

    // Etapas com operações internas (hoje só a fundição): o chefe acompanha
    // fase a fase, não só "está na fundição". Mesma função que serve o tótem.
    const idsComFases = await listarEtapasComFases();
    const pipelines = (
      await Promise.all(idsComFases.map((id) => montarPipelineEtapa(id)))
    ).filter((p): p is NonNullable<typeof p> => p !== null && p.temFases);
    const idsOS = new Set(todasOS.filter(o => !['finalizada', 'cancelada'].includes(o.status)).map(o => o.id));
    for (const p of pipelines) {
      p.semFase = p.semFase.filter(c => idsOS.has(c.osId));
      for (const fase of p.fases) {
        fase.cards = fase.cards.filter(c => idsOS.has(c.osId));
        fase.total = fase.cards.length;
        fase.naFila = fase.cards.filter(c => c.status === 'na_fila').length;
        fase.emProcesso = fase.cards.filter(c => c.status === 'em_processo').length;
        fase.parado = fase.cards.filter(c => c.paradaAtiva).length;
      }
    }

    return {
      data: {
        geradoEm: agora,
        clientes,
        indicadores,
        gargalos,
        enviosExternos,
        totalOSExternas: new Set(enviosExternos.map(e => e.osId)).size,
        osPorStatus,
        osPorStatusLista,
        osAtrasadas,
        kanban,
        roteiros,
        pipelines,
        inspecao,
        paradas: {
          ativas: paradasAtivas,
          porMotivoHoje: paradasPorMotivoHoje,
        },
        fantasmas: {
          opsParadas,
          turnosNaoFechados,
        },
      },
    };
  });
}
