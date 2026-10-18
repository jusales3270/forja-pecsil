// ============================================================
// Forja - Formatação das horas previstas × realizadas (P-03)
// ============================================================

/** 0 -> "—" / 45 -> "45min" / 150 -> "2h30" / 1500 -> "25h" */
export function formatarHoras(min: number | null | undefined): string {
  if (min == null) return '—';
  const total = Math.round(min);
  if (total <= 0) return min > 0 ? '<1min' : '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Desvio do realizado sobre o previsto. Até +10% é normal; até +30%, atenção;
 * acima disso, estourou. Muito mais rápido que o previsto (abaixo de −30%)
 * também pede atenção: o tempo do roteiro provavelmente está alto.
 */
export function nivelDesvio(pct: number | null | undefined): 'sem' | 'ok' | 'atencao' | 'estourou' {
  if (pct == null) return 'sem';
  if (pct > 30) return 'estourou';
  if (pct > 10 || pct < -30) return 'atencao';
  return 'ok';
}

export function textoDesvio(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
