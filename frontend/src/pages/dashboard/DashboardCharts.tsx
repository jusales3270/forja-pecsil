import type { DashboardData, GrupoAtraso } from '../../hooks/useDashboard';

export const TIPOS_PECA: Record<string, string> = {
  forma: 'Forma', bloco: 'Bloco', fundo_forma: 'Fundo de forma', fundo_bloco: 'Fundo de bloco', molde: 'Molde',
};
export const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function AtrasosPorGrupo({ titulo, grupos, tipo, onAbrir }: {
  titulo: string; grupos: GrupoAtraso[]; tipo?: boolean; onAbrir: (titulo: string, ids: string[]) => void;
}) {
  const maximo = Math.max(1, ...grupos.map(g => g.atrasadas));
  return <section className="dash-panel">
    <h3 className="font-semibold text-lg">{titulo}</h3>
    <p className="dash-muted text-sm mb-5">OS concluídas com atraso no período · clique para detalhar</p>
    {!grupos.length ? <p className="dash-empty">Sem conclusões registradas neste período.</p> :
      <div className="max-h-60 overflow-y-auto space-y-4 pr-2">
        {grupos.map(g => <button key={g.id} onClick={() => onAbrir(titulo + ' — ' + (tipo ? TIPOS_PECA[g.nome] ?? g.nome : g.nome), g.osIds)}
          className="w-full text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
          <div className="flex justify-between gap-3 text-sm mb-1.5">
            <span className="truncate">{tipo ? TIPOS_PECA[g.nome] ?? g.nome : g.nome}</span>
            <strong className="whitespace-nowrap">{g.atrasadas} <span className="dash-muted font-normal">/ {g.total} OS</span></strong>
          </div>
          <div className="h-2.5 rounded-full dash-track overflow-hidden" aria-hidden="true"><div className="h-full rounded-full bg-rose-500" style={{ width: `${g.atrasadas / maximo * 100}%` }} /></div>
          <p className="dash-muted text-xs mt-1">{g.atrasadas ? `${numero(g.mediaDiasAtraso)} dias de atraso médio entre as atrasadas` : 'Todas concluídas no prazo'}</p>
        </button>)}
      </div>}
  </section>;
}

export function DashboardCharts({ data: d, onAbrir }: { data: DashboardData; onAbrir: (titulo: string, ids: string[]) => void }) {
  const { carteira: c, historico: h } = d.indicadores;
  const maxMes = Math.max(1, ...h.evolucao.map(m => m.emDia + m.atrasadas));
  const maxCarga = Math.max(1, ...d.gargalos.map(g => g.horasPlanejadas));
  return <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="dash-panel">
        <h3 className="font-semibold text-lg">Prazos da carteira atual</h3>
        <p className="dash-muted text-sm">OS ativas · vencimentos de hoje ainda estão em dia</p>
        <div className="flex items-baseline gap-2 mt-6"><strong className="text-4xl tabular-nums">{c.total}</strong><span className="dash-muted">OS ativas</span></div>
        <div className="flex h-7 rounded-lg overflow-hidden dash-track my-4" role="img" aria-label={`${c.emDia} OS em dia e ${c.atrasadas} atrasadas`}>
          <div className="bg-emerald-500" style={{ width: `${c.total ? c.emDia / c.total * 100 : 0}%` }} />
          <div className="bg-rose-500" style={{ width: `${c.total ? c.atrasadas / c.total * 100 : 0}%` }} />
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <button className="underline decoration-emerald-500 underline-offset-4" onClick={() => onAbrir('OS em dia', c.emDiaIds)}>● Em dia: {c.emDia}</button>
          <button className="underline decoration-rose-500 underline-offset-4" onClick={() => onAbrir('OS atrasadas', c.atrasadasIds)}>● Atrasadas: {c.atrasadas}</button>
        </div>
      </section>
      <section className="dash-panel">
        <div className="flex justify-between gap-4">
          <div><h3 className="font-semibold text-lg">Pontualidade das conclusões</h3><p className="dash-muted text-sm">Últimos {h.dias} dias · por mês de conclusão</p></div>
          <div className="text-right"><strong className="text-3xl tabular-nums">{h.pontualidade === null ? '—' : `${h.pontualidade}%`}</strong><p className="dash-muted text-xs">concluídas no prazo</p></div>
        </div>
        {h.total === 0 ? <p className="dash-empty">Sem conclusões registradas neste período.</p> : <>
          <div className="flex gap-3 items-end h-36 mt-5 overflow-x-auto" role="img" aria-label={h.evolucao.map(m => `${m.mes}: ${m.emDia} no prazo, ${m.atrasadas} atrasadas`).join('; ')}>
            {h.evolucao.map(m => <div key={m.mes} className="min-w-9 flex-1 flex flex-col justify-end h-full text-center">
              <span className="text-xs tabular-nums mb-1">{m.emDia + m.atrasadas}</span>
              <div className="flex flex-col justify-end h-24">
                <div className="bg-rose-500 rounded-t-sm" style={{ height: `${m.atrasadas / maxMes * 100}%` }} title={`${m.atrasadas} atrasadas`} />
                <div className="bg-emerald-500" style={{ height: `${m.emDia / maxMes * 100}%` }} title={`${m.emDia} no prazo`} />
              </div>
              <span className="dash-muted text-xs mt-2">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
            </div>)}
          </div>
          <p className="text-xs dash-muted mt-3"><span className="text-emerald-500">●</span> No prazo: {h.emDia} <span className="text-rose-500 ml-4">●</span> Com atraso: {h.atrasadas}</p>
        </>}
        {h.semDataConclusao > 0 && <p className="text-xs dash-muted mt-3">{h.semDataConclusao} OS finalizada(s) sem data de conclusão registrada não entram no histórico.</p>}
        <p className="text-xs dash-muted mt-3">Conclusão registrada comparada ao prazo atualmente cadastrado na OS.</p>
      </section>
      <AtrasosPorGrupo titulo="Histórico de atrasos por cliente" grupos={h.porCliente} onAbrir={onAbrir} />
      <AtrasosPorGrupo titulo="Histórico de atrasos por tipo de peça" grupos={h.porTipo} tipo onAbrir={onAbrir} />
    </div>
    <section className="dash-panel">
      <h3 className="font-semibold text-lg">Gargalos · carga pendente por estação</h3>
      <p className="dash-muted text-sm mb-5">Horas planejadas das peças disponíveis em cada posto. Envios externos ficam fora desta carga.</p>
      {!d.gargalos.some(g => g.operacoes) ? <p className="dash-empty">Nenhuma operação disponível nas estações.</p> :
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 max-h-72 overflow-y-auto pr-2">
          {d.gargalos.filter(g => g.operacoes).map(g => <button key={g.etapaId} onClick={() => onAbrir(g.nome + ' — OS na estação', g.osIds)} className="text-left rounded-lg">
            <div className="flex justify-between gap-4 text-sm mb-1"><span>{g.nome}</span><strong className="whitespace-nowrap">{numero(g.horasPlanejadas)} h</strong></div>
            <div className="h-2.5 rounded-full dash-track overflow-hidden" aria-hidden="true"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${g.horasPlanejadas / maxCarga * 100}%` }} /></div>
            <p className="dash-muted text-xs mt-1">{g.operacoes} OPs · {g.pecas} peças nas operações · {g.osAtrasadas} OS atrasadas</p>
          </button>)}
        </div>}
      <p className="text-xs dash-muted mt-4">Concentração de trabalho planejado, sem descontar peças ainda não encerradas. Não mede capacidade nem comprova a causa do atraso.</p>
    </section>
  </div>;
}
