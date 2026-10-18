// ============================================================
// Forja - Horas previstas × realizadas de uma OS
// ============================================================
// Previsto de cada OP = setup + tempo por peça × peças do lote (o tempo por
// peça é o planejado gravado na OP quando a OS abriu; o setup vem do roteiro
// do artigo). Realizado = soma do tempo dos carimbos da OP, da entrada à
// saída (o carimbo aberto conta até agora). Inclui as paradas: é o tempo que
// a OP de fato ocupou a estação.
//
// Terceiros (contam em dias, fora da fábrica) e esperas (cura, resfriamento)
// não entram na comparação: não têm tempo de máquina previsto. OP concluída
// com menos de 1 minuto de carimbo é "sem medição" (encerrada sem o tempo
// real): mostrar −100% ali faria o roteiro parecer superestimado.
// ============================================================

export interface OPParaComparar {
  id: string;
  loteNumero: number;
  quantidade: number;
  ordem: number;
  codigoOp: string;
  tipoServico: string;
  etapa: string;
  status: string;
  tempoTotalPlanejado: number;
  tempoSetupMin: number;
  terceirizada: boolean;
  esperaHoras: number | null;
  carimbos: { entrada: Date; saida: Date | null }[];
}

export interface LinhaPrevistoRealizado {
  id: string;
  loteNumero: number;
  quantidade: number;
  codigoOp: string;
  tipoServico: string;
  etapa: string;
  status: string;
  /** null = fora da comparação (terceiros ou espera) */
  previstoMin: number | null;
  /** null = ainda não passou pela estação */
  realizadoMin: number | null;
  emAndamento: boolean;
  /** (realizado − previsto) ÷ previsto, só das OPs concluídas e medidas */
  desvioPct: number | null;
  /** Concluída sem tempo real de carimbo (menos de 1 minuto) */
  semMedicao: boolean;
  foraDaComparacao: 'terceiros' | 'espera' | null;
}

const arred = (n: number) => Math.round(n * 10) / 10;
/** Abaixo disso, o carimbo não mediu trabalho de verdade. */
const MINIMO_MEDIDO_MIN = 1;

export function compararPrevistoRealizado(ops: OPParaComparar[], agora = new Date()) {
  const linhas: LinhaPrevistoRealizado[] = [...ops]
    .sort((a, b) => a.loteNumero - b.loteNumero || a.ordem - b.ordem)
    .map((op) => {
      const fora = op.terceirizada ? 'terceiros' : op.esperaHoras != null && op.esperaHoras > 0 ? 'espera' : null;
      const previsto = fora ? null : arred(op.tempoTotalPlanejado + op.tempoSetupMin);
      const realizado = op.carimbos.length
        ? arred(op.carimbos.reduce((s, c) => s + Math.max(0, ((c.saida ?? agora).getTime() - c.entrada.getTime()) / 60_000), 0))
        : null;
      const concluida = op.status === 'concluida';
      const semMedicao = concluida && !fora && (realizado == null || realizado < MINIMO_MEDIDO_MIN);
      return {
        id: op.id, loteNumero: op.loteNumero, quantidade: op.quantidade, codigoOp: op.codigoOp, tipoServico: op.tipoServico,
        etapa: op.etapa, status: op.status, previstoMin: previsto, realizadoMin: realizado,
        emAndamento: op.carimbos.some((c) => !c.saida),
        desvioPct: concluida && !fora && !semMedicao && previsto && realizado != null ? Math.round(((realizado - previsto) / previsto) * 100) : null,
        semMedicao,
        foraDaComparacao: fora,
      };
    });
  const medidas = linhas.filter((l) => l.previstoMin != null);
  const concluidas = medidas.filter((l) => l.status === 'concluida' && !l.semMedicao);
  const soma = (xs: (number | null)[]) => arred(xs.reduce<number>((s, x) => s + (x ?? 0), 0));
  const previstoConcluidas = soma(concluidas.map((l) => l.previstoMin));
  const realizadoConcluidas = soma(concluidas.map((l) => l.realizadoMin));
  return {
    linhas,
    totais: {
      /** Previsto da OS inteira (todas as OPs com tempo de máquina) */
      previstoMin: soma(medidas.map((l) => l.previstoMin)),
      /** Tempo já gasto, inclusive nas OPs em andamento */
      realizadoMin: soma(medidas.map((l) => l.realizadoMin)),
      /** Comparação justa: só as OPs concluídas, previsto × realizado delas */
      concluidas: concluidas.length,
      previstoConcluidasMin: previstoConcluidas,
      realizadoConcluidasMin: realizadoConcluidas,
      desvioConcluidasPct: previstoConcluidas > 0 ? Math.round(((realizadoConcluidas - previstoConcluidas) / previstoConcluidas) * 100) : null,
      /** Previsto das OPs que ainda não terminaram */
      faltaPrevistoMin: soma(medidas.filter((l) => l.status !== 'concluida').map((l) => l.previstoMin)),
      foraDaComparacao: linhas.length - medidas.length,
      /** Concluídas sem tempo real de carimbo: ficam fora do desvio */
      semMedicao: linhas.filter((l) => l.semMedicao).length,
    },
  };
}
