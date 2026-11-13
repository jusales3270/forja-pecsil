// ============================================================
// Forja - Tótem: faixa vermelha de falta de peças
// Aparece na estação de onde as peças saíram (a Fundição) enquanto a falta
// conferida no Desbaste estiver aberta. Some sozinha quando as peças chegam
// ou o PCP aceita a falta.
// ============================================================

import { useFaltasChegada } from '../../hooks/useOPLote';

export function FaixaFaltaChegada({ etapaId }: { etapaId?: string }) {
  const { data } = useFaltasChegada(etapaId);
  const faltas = data?.data ?? [];
  if (faltas.length === 0) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border-2 border-red-500 bg-red-600/20 px-5 py-4">
      <div className="text-lg font-bold text-red-300 uppercase tracking-wide">
        ⚠ Falta de peças {faltas.length > 1 ? `em ${faltas.length} lotes` : 'no lote'}
      </div>
      <ul className="mt-2 space-y-1.5">
        {faltas.map((f) => (
          <li key={f.opLoteId} className="text-base text-red-100">
            <strong className="font-mono">OS {f.codigoGrv}</strong> · Lote {f.numeroLote} ({f.artigo}): chegaram{' '}
            <strong>{f.contado} de {f.esperado}</strong> peças no Desbaste —{' '}
            <strong className="text-red-300">faltam {f.faltam}</strong>.
            <span className="text-red-200/80 text-sm">
              {' '}Conferido{f.conferidoPor ? ` por ${f.conferidoPor}` : ''} em{' '}
              {new Date(f.conferidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-red-200/90">
        Confira de onde saíram as peças que faltam. A faixa some quando as peças chegarem ao Desbaste ou o PCP aceitar a falta.
      </p>
    </div>
  );
}
