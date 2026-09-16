// ============================================================
// Forja - Trilha do roteiro de um lote
// ============================================================
// Cada peça segue as operações que o PCP escolheu, na ordem dele — não a
// ordem das colunas do painel. A trilha responde "por onde já passou, onde
// está agora e para onde vai" para o chefe.
//
// Um lote pode estar em mais de um ponto ao mesmo tempo (parte das peças
// seguiu, parte ficou): mais de um passo "atual" é normal.
// ============================================================

export type EstadoPasso = 'concluido' | 'atual' | 'externo' | 'futuro';

export interface OpDaTrilha {
  id: string;
  ordem: number;
  codigoOp: string;
  tipoServico: string;
  status: string;
  quantidadeConcluida: number;
  exigeLoteCompleto: boolean;
  envioExternoEm: Date | null;
  recebimentoExternoEm: Date | null;
  etapa: { id: string; nome: string };
}

export interface PassoTrilha {
  opLoteId: string;
  codigoOp: string;
  tipoServico: string;
  estacao: string;
  etapaId: string;
  status: string;
  estado: EstadoPasso;
  concluidas: number;
  /** Peças paradas neste passo agora. */
  disponiveis: number;
}

/**
 * Monta a trilha de um lote. `disponiveis` vem de calcularFluxoDePecas.
 * As ops podem vir em qualquer ordem; a trilha segue `ordem` + `codigoOp`.
 */
export function montarTrilha(
  ops: OpDaTrilha[],
  disponiveis: (opLoteId: string) => number,
): PassoTrilha[] {
  const ordenadas = [...ops].sort((a, b) => a.ordem - b.ordem || a.codigoOp.localeCompare(b.codigoOp) || a.id.localeCompare(b.id));

  // Mesma trava do kanban: depois de uma operação que exige lote completo e
  // ainda não concluiu, nada adiante está liberado.
  let travado = false;

  return ordenadas.map((op) => {
    const externo = !!op.envioExternoEm && !op.recebimentoExternoEm;
    const pecas = disponiveis(op.id);

    let estado: EstadoPasso;
    if (op.status === 'concluida') estado = 'concluido';
    else if (externo) estado = 'externo';
    else if (travado) estado = 'futuro';
    else if (op.status !== 'na_fila' || pecas > 0) estado = 'atual';
    else estado = 'futuro';

    if (op.exigeLoteCompleto && op.status !== 'concluida') travado = true;

    return {
      opLoteId: op.id,
      codigoOp: op.codigoOp,
      tipoServico: op.tipoServico,
      estacao: op.etapa.nome,
      etapaId: op.etapa.id,
      status: op.status,
      estado,
      concluidas: op.quantidadeConcluida,
      disponiveis: estado === 'futuro' ? 0 : pecas,
    };
  });
}

/** Operação anterior e seguinte de uma OP dentro da trilha do lote. */
export function vizinhosNaTrilha(trilha: PassoTrilha[], opLoteId: string) {
  const i = trilha.findIndex((p) => p.opLoteId === opLoteId);
  if (i < 0) return { veioDe: null, proxima: null };
  const resumo = (p?: PassoTrilha) => (p ? { estacao: p.estacao, tipoServico: p.tipoServico } : null);
  return { veioDe: resumo(trilha[i - 1]), proxima: resumo(trilha[i + 1]) };
}
