// ============================================================
// Forja - Pipeline de fases dentro de uma etapa
// ============================================================
// A fundição é a única etapa com operações internas (Modelação → Moldagem →
// Vazamento → Rebarbação → Tratamento Térmico). Todas apontam pra MESMA Etapa,
// então sem isto o tótem e o painel mostram um balde só, sem dizer em que fase
// cada OS está.
//
// A ordem vem de TipoServico.ordemNaEtapa — cadastro, não código chumbado.
// Etapa sem nenhum tipo de serviço ordenado devolve temFases: false e o
// consumidor mantém o comportamento de processo único.
//
// Usado pelo tótem (GET /api/etapas/:id/pipeline) e pelo painel do chefe
// (GET /api/dashboard), pra não existirem duas verdades sobre a mesma coisa.
// ============================================================

import { prisma } from '../db/prisma.js';
import { calcularFluxoDePecas } from './fluxo-pecas.js';

export type Semaforo = 'verde' | 'amarelo' | 'vermelho';

export interface CardPipeline {
  opLoteId: string;
  codigoOp: string;
  codigoGrv: string;
  osId: string;
  numeroLote: number;
  cliente: string;
  artigo: string;
  artigoDescricao: string;
  tipoServico: string;
  status: string;
  prioridade: string;
  quantidadeConcluida: number;
  quantidadePecas: number;
  diasAtePrazo: number;
  semaforo: Semaforo;
  /** Entrada do carimbo aberto. Null quando a OP ainda não começou. */
  desdeQuando: Date | null;
  operador: string | null;
  maquina: string | null;
  paradaAtiva: { motivo: string; planejado: boolean; inicio: Date } | null;
  /** Quando o aviso de início foi disparado pra etapa avisada. */
  alertaInicioEm: Date | null;
  etapaAvisada: string | null;
  /** Feita fora da fábrica (rebarbação). */
  terceirizada: boolean;
  fornecedor: string | null;
  prazoPrevistoDias: number | null;
  /** Só tempo (cura, resfriamento). Null = operação normal. */
  esperaHoras: number | null;
  /** Quando a espera termina. Null se não é espera ou ainda não começou. */
  liberaEm: Date | null;
  /** A próxima só começa com o lote inteiro fechado aqui. */
  exigeLoteCompleto: boolean;
  /** Peças esperando nesta operação agora (a anterior liberou, esta não fez). */
  pecasDisponiveis: number;
  /** Quanto a operação anterior liberou — o "de 12" do "3 de 12". */
  liberadasPelaAnterior: number;
}

export interface FasePipeline {
  tipoServicoId: string;
  nome: string;
  ordem: number;
  codigo: number | null;
  naFila: number;
  emProcesso: number;
  parado: number;
  total: number;
  cards: CardPipeline[];
}

export interface PipelineEtapa {
  etapaId: string;
  etapaNome: string;
  temFases: boolean;
  fases: FasePipeline[];
  /** OPs da etapa que não casaram com nenhuma fase cadastrada. */
  semFase: CardPipeline[];
}

/** Mesma regra de semáforo do kanban do painel (dashboard.ts). */
function semaforoDoPrazo(diasAtePrazo: number): Semaforo {
  if (diasAtePrazo < 3) return 'vermelho';
  if (diasAtePrazo < 7) return 'amarelo';
  return 'verde';
}

export async function montarPipelineEtapa(etapaId: string): Promise<PipelineEtapa | null> {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    select: { id: true, nome: true },
  });
  if (!etapa) return null;

  const tiposOrdenados = await prisma.tipoServico.findMany({
    where: { etapaId, ordemNaEtapa: { not: null } },
    orderBy: { ordemNaEtapa: 'asc' },
    select: { id: true, nome: true, codigo: true, ordemNaEtapa: true },
  });

  if (tiposOrdenados.length === 0) {
    return {
      etapaId: etapa.id,
      etapaNome: etapa.nome,
      temFases: false,
      fases: [],
      semFase: [],
    };
  }

  const opsAtivas = await prisma.oPLote.findMany({
    where: { etapaId, status: { notIn: ['concluida'] } },
    select: {
      id: true,
      loteId: true,
      ordem: true,
      codigoOp: true,
      tipoServico: true,
      status: true,
      quantidadeConcluida: true,
      alertaInicioEm: true,
      terceirizada: true,
      fornecedor: true,
      prazoPrevistoDias: true,
      esperaHoras: true,
      exigeLoteCompleto: true,
      operacaoArtigo: { select: { tipoServicoId: true } },
      etapaAvisada: { select: { nome: true } },
      carimbos: {
        where: { timestampSaida: null },
        orderBy: { timestampEntrada: 'desc' },
        take: 1,
        select: {
          timestampEntrada: true,
          maquina: { select: { nome: true } },
          operadorResponsavel: { select: { nome: true } },
          paradas: {
            where: { fim: null },
            orderBy: { inicio: 'desc' },
            take: 1,
            select: {
              inicio: true,
              motivoParada: { select: { nome: true, planejado: true } },
            },
          },
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
              artigo: { select: { codigo: true, descricao: true } },
            },
          },
        },
      },
    },
    orderBy: [{ lote: { os: { prazoEntrega: 'asc' } } }, { ordem: 'asc' }],
  });

  // Onde o lote está é uma pergunta sobre PEÇAS, não sobre OPs. Um lote parcial
  // fica em dois lugares: a modelação fecha 3 de 12 e essas 3 seguem, enquanto
  // 9 continuam esperando lá. A fase mostra o que está parado nela agora.
  const fluxo = await calcularFluxoDePecas([...new Set(opsAtivas.map((o) => o.loteId))]);

  // Duas formas de achar a fase de uma OP: pela FK do roteiro (preenchida pelo
  // aplicar-roteiro) ou, quando ela é nula, pelo nome do tipo de serviço — que
  // é @unique no catálogo. Operações cadastradas na mão caem no segundo caso.
  const idsDeFase = new Set(tiposOrdenados.map((t) => t.id));
  const porNome = new Map(tiposOrdenados.map((t) => [t.nome.trim().toLowerCase(), t.id]));

  const baldes = new Map<string, CardPipeline[]>(tiposOrdenados.map((t) => [t.id, []]));
  const semFase: CardPipeline[] = [];

  for (const op of opsAtivas) {
    const pecas = fluxo.get(op.id);
    const disponiveis = pecas?.disponiveis ?? 0;

    // Fase vazia é fase vazia: OP sem peça esperando e sem ninguém trabalhando
    // não ocupa lugar nenhum. É o que impede a mesma OS de aparecer nas oito
    // caixas só porque as OPs nascem todas na fila.
    if (disponiveis === 0 && op.status !== 'em_processo') continue;

    const prazo = op.lote.os.prazoEntrega;
    const diasAtePrazo = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86_400_000);
    const carimbo = op.carimbos[0];
    const parada = carimbo?.paradas[0];

    const card: CardPipeline = {
      opLoteId: op.id,
      codigoOp: op.codigoOp,
      codigoGrv: op.lote.os.codigoGrv,
      osId: op.lote.os.id,
      numeroLote: op.lote.numeroLote,
      cliente: op.lote.os.cliente.nome,
      artigo: op.lote.os.artigo.codigo,
      artigoDescricao: op.lote.os.artigo.descricao,
      tipoServico: op.tipoServico,
      status: op.status,
      prioridade: op.lote.os.prioridade,
      quantidadeConcluida: op.quantidadeConcluida,
      quantidadePecas: op.lote.quantidadePecas,
      diasAtePrazo,
      semaforo: semaforoDoPrazo(diasAtePrazo),
      desdeQuando: carimbo?.timestampEntrada ?? null,
      operador: carimbo?.operadorResponsavel?.nome ?? null,
      maquina: carimbo?.maquina?.nome ?? null,
      paradaAtiva: parada
        ? {
            motivo: parada.motivoParada.nome,
            planejado: parada.motivoParada.planejado,
            inicio: parada.inicio,
          }
        : null,
      alertaInicioEm: op.alertaInicioEm,
      etapaAvisada: op.etapaAvisada?.nome ?? null,
      terceirizada: op.terceirizada,
      fornecedor: op.fornecedor,
      prazoPrevistoDias: op.prazoPrevistoDias,
      esperaHoras: op.esperaHoras,
      liberaEm:
        op.esperaHoras != null && carimbo?.timestampEntrada
          ? new Date(carimbo.timestampEntrada.getTime() + op.esperaHoras * 3_600_000)
          : null,
      exigeLoteCompleto: op.exigeLoteCompleto,
      pecasDisponiveis: disponiveis,
      liberadasPelaAnterior: pecas?.liberadasPelaAnterior ?? op.lote.quantidadePecas,
    };

    const fkId = op.operacaoArtigo?.tipoServicoId;
    const faseId =
      fkId && idsDeFase.has(fkId)
        ? fkId
        : (porNome.get(op.tipoServico.trim().toLowerCase()) ?? null);

    if (faseId) baldes.get(faseId)!.push(card);
    else semFase.push(card);
  }

  const fases: FasePipeline[] = tiposOrdenados.map((t) => {
    const cards = baldes.get(t.id)!;
    return {
      tipoServicoId: t.id,
      nome: t.nome,
      ordem: t.ordemNaEtapa!,
      codigo: t.codigo,
      naFila: cards.filter((c) => c.status === 'na_fila').length,
      emProcesso: cards.filter((c) => c.status === 'em_processo' && !c.paradaAtiva).length,
      parado: cards.filter((c) => c.paradaAtiva !== null).length,
      total: cards.length,
      cards,
    };
  });

  return {
    etapaId: etapa.id,
    etapaNome: etapa.nome,
    temFases: true,
    fases,
    semFase,
  };
}

/** Etapas que têm fases cadastradas. Hoje é só a fundição. */
export async function listarEtapasComFases(): Promise<string[]> {
  const tipos = await prisma.tipoServico.findMany({
    where: { ordemNaEtapa: { not: null } },
    select: { etapaId: true },
    distinct: ['etapaId'],
  });
  return tipos.map((t) => t.etapaId);
}
