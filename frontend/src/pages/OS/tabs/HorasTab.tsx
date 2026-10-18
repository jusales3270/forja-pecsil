// ============================================================
// Forja - Aba "Previsto × realizado" do detalhe da OS (P-03)
// ============================================================
// Previsto = setup + tempo por peça × peças do lote. Realizado = tempo dos
// carimbos da OP (com as paradas; o carimbo aberto conta até agora). A
// comparação justa é a das OPs concluídas; terceiros e esperas ficam fora.
// ============================================================

import { useOSHoras } from '../../../hooks/useOS';
import { useTheme } from '../../../lib/theme-store';
import { formatarHoras, nivelDesvio, textoDesvio } from '../../../lib/horas';

const STATUS_OP: Record<string, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Qualidade',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

export function HorasTab({ osId }: { osId: string }) {
  const { claro } = useTheme();
  const { data, isLoading, isError } = useOSHoras(osId);
  const sub = claro ? 'text-slate-500' : 'text-neutral-400';
  const forte = claro ? 'text-slate-900' : 'text-neutral-100';
  const corDesvio = {
    sem: sub,
    ok: claro ? 'text-emerald-700' : 'text-emerald-400',
    atencao: claro ? 'text-amber-700' : 'text-amber-400',
    estourou: claro ? 'text-red-700' : 'text-red-400',
  } as const;

  if (isLoading) return <div className={`card text-center ${sub}`}>Carregando as horas…</div>;
  if (isError || !data) return <div className="card error-message">Não foi possível carregar as horas desta OS.</div>;
  if (!data.linhas.length) return <div className={`card text-center ${sub}`}>Esta OS ainda não tem lotes nem OPs.</div>;

  const t = data.totais;
  const cartoes = [
    { rotulo: 'Previsto da OS', valor: formatarHoras(t.previstoMin) },
    { rotulo: 'Gasto até agora', valor: formatarHoras(t.realizadoMin) },
    { rotulo: 'Falta (previsto)', valor: formatarHoras(t.faltaPrevistoMin) },
    {
      rotulo: `Desvio das concluídas (${t.concluidas})`,
      valor: textoDesvio(t.desvioConcluidasPct),
      cor: corDesvio[nivelDesvio(t.desvioConcluidasPct)],
      detalhe: [
        t.concluidas ? `${formatarHoras(t.realizadoConcluidasMin)} de ${formatarHoras(t.previstoConcluidasMin)}` : 'nenhuma OP concluída e medida',
        t.semMedicao ? `${t.semMedicao} sem medição` : '',
      ].filter(Boolean).join(' · '),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="card py-3">
            <div className={`text-xs ${sub}`}>{c.rotulo}</div>
            <div className={`text-2xl font-bold font-mono ${c.cor ?? forte}`}>{c.valor}</div>
            {c.detalhe && <div className={`text-xs ${sub}`}>{c.detalhe}</div>}
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-100 text-slate-500' : 'bg-neutral-950 text-neutral-400'}`}>
            <tr>
              <th className="text-left px-3 py-3">Lote</th>
              <th className="text-left px-3 py-3">OP</th>
              <th className="text-left px-3 py-3">Serviço</th>
              <th className="text-left px-3 py-3">Situação</th>
              <th className="text-right px-3 py-3">Previsto</th>
              <th className="text-right px-3 py-3">Realizado</th>
              <th className="text-right px-3 py-3">Desvio</th>
            </tr>
          </thead>
          <tbody className={claro ? 'divide-y divide-slate-200' : 'divide-y divide-neutral-800'}>
            {data.linhas.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 font-mono whitespace-nowrap">{l.loteNumero} <span className={sub}>· {l.quantidade} pç</span></td>
                <td className="px-3 py-2 font-mono">{l.codigoOp}</td>
                <td className="px-3 py-2">{l.tipoServico}<span className={`block text-xs ${sub}`}>{l.etapa}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{STATUS_OP[l.status] ?? l.status}{l.emAndamento && <span className={`ml-1 text-xs ${corDesvio.atencao}`}>● agora</span>}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                  {l.foraDaComparacao ? <span className={sub}>{l.foraDaComparacao === 'terceiros' ? 'terceiros' : 'espera'}</span> : formatarHoras(l.previstoMin)}
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formatarHoras(l.realizadoMin)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${corDesvio[nivelDesvio(l.desvioPct)]}`}>
                  {l.semMedicao ? <span className={`text-xs font-normal ${sub}`} title="Concluída sem o tempo real no carimbo">sem medição</span> : textoDesvio(l.desvioPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`text-xs ${sub}`}>
        Previsto = setup + tempo por peça × peças do lote, do roteiro. Realizado = tempo dos carimbos da OP, com as paradas.
        O desvio só aparece nas OPs concluídas; as encerradas com menos de 1 minuto de carimbo ficam como "sem medição".
        Terceiros e esperas (cura, resfriamento) ficam fora da conta.
      </p>
    </div>
  );
}
