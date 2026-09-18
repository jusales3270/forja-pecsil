import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard, type KanbanCard, type DashboardData, type RoteiroOS } from '../hooks/useDashboard';
import { TrilhaRoteiro } from '../components/TrilhaRoteiro';
import { useTheme } from '../lib/theme-store';
import { Modal } from '../components/Modal';
import { PipelineEtapa } from '../components/PipelineEtapa';
import { DetalhesOPModal } from './Totem/DetalhesOPModal';
import { OSsFaseModal } from './Totem/OSsFaseModal';
import { VisualizadorDesenhoModal } from '../components/VisualizadorDesenhoModal';
import { useOPLoteDetail } from '../hooks/useOPLote';
import type { Desenho } from '../hooks/useDesenhos';
import { DashboardCharts, TIPOS_PECA, numero } from './dashboard/DashboardCharts';
import type { FasePipeline } from '../hooks/usePipelineEtapa';
import './dashboard/dashboard.css';

type Selecao = { tipo: 'externos' } | { tipo: 'lista'; titulo: string; ids: string[] } | { tipo: 'op'; id: string };
const STATUS: Record<string, string> = { na_fila: 'Na fila', em_processo: 'Em processo', aguardando_qualidade: 'Aguardando qualidade', bloqueada: 'Bloqueada', concluida: 'Concluída' };
const dataCurta = (data: string) => new Date(data.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
const prazoTexto = (dias: number) => dias < 0 ? `${Math.abs(dias)}d de atraso` : dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`;
function cardBate(c: KanbanCard, busca: string, etapa: string) {
  const termo = busca.trim().toLocaleLowerCase();
  if (!termo) return true;
  if (/^atrasad[ao]s?$/.test(termo)) return c.diasAtePrazo < 0;
  if (/^extern[ao]s?$/.test(termo)) return c.externo;
  return [c.codigoGrv, c.codigoOp, c.cliente, c.artigo, c.operador, c.programador, c.maquina, etapa, c.prioridade, c.fornecedor]
    .some(v => v?.toLocaleLowerCase().includes(termo));
}

function roteiroBate(r: RoteiroOS, busca: string) {
  const termo = busca.trim().toLocaleLowerCase();
  if (!termo) return true;
  if (/^atrasad[ao]s?$/.test(termo)) return r.diasAtePrazo < 0;
  if (/^extern[ao]s?$/.test(termo)) return r.lotes.some(l => l.passos.some(p => p.estado === 'externo'));
  return [r.codigoGrv, r.cliente, r.artigo, r.descricao, r.prioridade].some(v => v.toLocaleLowerCase().includes(termo))
    || r.lotes.some(l => l.passos.some(p => p.estado !== 'concluido' && [p.estacao, p.tipoServico].some(v => v.toLocaleLowerCase().includes(termo))));
}
const vizinho = (v: KanbanCard['veioDe']) => v ? (v.tipoServico.toLocaleLowerCase() === v.estacao.toLocaleLowerCase() ? v.estacao : `${v.estacao} (${v.tipoServico})`) : null;

export default function DashboardPage() {
  const navigate = useNavigate();
  const { claro, toggleTema } = useTheme();
  const [clienteId, setClienteId] = useState('');
  const [tipoProduto, setTipoProduto] = useState('');
  const [dias, setDias] = useState(90);
  const [busca, setBusca] = useState('');
  const [buscaRoteiro, setBuscaRoteiro] = useState('');
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [faseModal, setFaseModal] = useState<FasePipeline | null>(null);
  const [modalDesenhos, setModalDesenhos] = useState<{
    artigo: { id: string; codigo: string; descricao?: string };
    desenhos: Desenho[];
  } | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useDashboard({ clienteId: clienteId || undefined, tipoProduto: tipoProduto || undefined, dias });
  const d = data?.data;
  const kanban = useMemo(() => d?.kanban.map(et => ({ ...et, cards: et.cards.filter(c => cardBate(c, busca, et.nome)) })) ?? [], [d, busca]);
  const abrirLista = (titulo: string, ids: string[]) => setSelecao({ tipo: 'lista', titulo, ids });
  const todasOS = useMemo(() => new Map(Object.values(d?.osPorStatusLista ?? {}).flat().map(os => [os.id, os])), [d]);
  const roteiros = useMemo(() => d?.roteiros.filter(r => roteiroBate(r, buscaRoteiro)) ?? [], [d, buscaRoteiro]);
  const h = d?.indicadores.historico;
  const tituloModal = selecao?.tipo === 'externos' ? 'OS em envio externo' : selecao?.tipo === 'lista' ? selecao.titulo : '';

  return <main className="dash-page" data-theme={claro ? 'light' : 'dark'}>
    <header className="flex flex-wrap justify-between items-start gap-4">
      <div><p className="text-xs uppercase tracking-widest dash-muted mb-2">Forja · Gestão da fábrica</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Painel de Produção</h1>
        <p className="text-sm dash-muted mt-2">Atualiza a cada 30s{d && ` · ${new Date(d.geradoEm).toLocaleTimeString('pt-BR')}`}{isFetching && ' · Atualizando…'}</p>
      </div>
      <div className="flex gap-2"><button className="dash-button" onClick={toggleTema}>{claro ? 'Escuro' : 'Claro'}</button><button className="dash-button" onClick={() => navigate('/')}>← Voltar</button></div>
    </header>

    <section className="dash-panel flex flex-wrap items-end gap-4" aria-label="Filtros do painel">
      <label className="flex-1 min-w-48 text-sm">Cliente<select className="dash-input mt-1" value={clienteId} onChange={e => setClienteId(e.target.value)}><option value="">Todos os clientes</option>{d?.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label className="flex-1 min-w-44 text-sm">Tipo de peça<select className="dash-input mt-1" value={tipoProduto} onChange={e => setTipoProduto(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(TIPOS_PECA).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
      <label className="flex-1 min-w-44 text-sm">Período do histórico<select className="dash-input mt-1" value={dias} onChange={e => setDias(Number(e.target.value))}>{[30, 90, 180, 365].map(n => <option key={n} value={n}>Últimos {n} dias</option>)}</select></label>
      <button className="dash-button" onClick={() => { setClienteId(''); setTipoProduto(''); setDias(90); setBusca(''); setBuscaRoteiro(''); }}>Limpar filtros</button>
    </section>
    {isLoading && <p role="status" className="dash-empty">Carregando indicadores…</p>}
    {isError && <div role="alert" className="dash-panel text-rose-500">Não foi possível atualizar o painel. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></div>}
    {d && h && <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Resumo label="Abertas" valor={d.osPorStatus.aberta ?? 0} detalhe="Aguardando produção" onClick={() => abrirLista('OS abertas', (d.osPorStatusLista.aberta ?? []).map(o => o.id))} />
        <Resumo label="Em produção" valor={d.osPorStatus.em_producao ?? 0} detalhe="Internas e externas" onClick={() => abrirLista('OS em produção', (d.osPorStatusLista.em_producao ?? []).map(o => o.id))} />
        <Resumo label="Em dia" valor={d.indicadores.carteira.emDia} detalhe="OS ativas dentro do prazo" cor="emerald" onClick={() => abrirLista('OS em dia', d.indicadores.carteira.emDiaIds)} />
        <Resumo label="Atrasadas" valor={d.indicadores.carteira.atrasadas} detalhe="OS ativas com prazo vencido" cor="rose" onClick={() => abrirLista('OS atrasadas', d.indicadores.carteira.atrasadasIds)} />
        <Resumo label="Envio externo" valor={d.totalOSExternas} detalhe={`${d.enviosExternos.length} lotes · ${d.enviosExternos.reduce((s, e) => s + e.quantidade, 0)} peças fora`} cor="sky" onClick={() => setSelecao({ tipo: 'externos' })} />
        <Resumo label="Concluídas" valor={h.total} detalhe={`Nos últimos ${dias} dias`} onClick={() => abrirLista('OS concluídas no período', h.os.map(o => o.id))} />
      </div>
      <p className="dash-muted text-xs -mt-3">Envios externos e prazos detalham a mesma carteira; os quadros não devem ser somados.</p>

      <section className="min-w-0" aria-labelledby="kanban-titulo">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div><h2 id="kanban-titulo" className="text-xl font-semibold">Onde está cada lote</h2><p className="text-sm dash-muted">Operações com peças disponíveis, em execução ou aguardando liberação.</p></div>
          <label className="text-sm w-full sm:w-80">Buscar no kanban<input className="dash-input mt-1" value={busca} onChange={e => setBusca(e.target.value)} placeholder="OS, cliente, estação, externas…" /></label>
        </div>
        <div className="dash-kanban" tabIndex={0} role="region" aria-label="Kanban de produção com rolagem horizontal e vertical">
          <div className="flex gap-4 w-max min-w-full items-start p-4">
            {kanban.map(et => <section key={et.etapaId} className="w-72 flex-shrink-0">
              <header className="dash-column-title sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg px-3 py-3 mb-3"><h3 className="font-semibold">{et.nome}</h3><span className="dash-count">{et.cards.length}</span></header>
              <div className="space-y-3">
                {et.cards.length === 0 && <p className="text-sm dash-muted p-4">Nenhuma OP nesta estação.</p>}
                {et.cards.map(c => <button key={c.opLoteId} className="dash-kanban-card" onClick={() => setSelecao({ tipo: 'op', id: c.opLoteId })} style={{ borderLeftColor: c.externo ? '#0ea5e9' : c.semaforo === 'vermelho' ? '#f43f5e' : c.semaforo === 'amarelo' ? '#f59e0b' : '#10b981' }}>
                  <div className="flex items-start justify-between gap-2"><strong className="font-mono break-all">{c.codigoGrv}</strong>{c.prioridade === 'urgente' && <span className="text-xs font-bold text-rose-500">URGENTE</span>}</div>
                  <p className="text-sm mt-2">{c.cliente}</p><p className="dash-muted text-sm">{c.artigo}</p>
                  <p className="text-xs mt-3">OP {c.codigoOp} · Lote {c.numeroLote} · {c.quantidade} peças</p>
                  <p className="dash-muted text-xs mt-1">{vizinho(c.veioDe) ? `de ${vizinho(c.veioDe)}` : 'início do roteiro'} · {vizinho(c.proxima) ? `próxima ${vizinho(c.proxima)}` : 'última operação'}</p>
                  {c.externo ? <p className="text-sky-500 text-xs font-semibold mt-2">ENVIO EXTERNO · aguardando retorno</p> : <p className="dash-muted text-xs mt-2">{STATUS[c.status] ?? c.status}</p>}
                  <p className={`text-xs mt-2 ${c.diasAtePrazo < 0 ? 'text-rose-500 font-semibold' : 'dash-muted'}`}>{prazoTexto(c.diasAtePrazo)}</p>
                </button>)}
              </div>
            </section>)}
          </div>
        </div>
        <p className="dash-muted text-xs mt-2">Role dentro do quadro para percorrer as estações e os lotes. Clique em uma OP para abrir os detalhes.</p>
      </section>
      <details className="dash-panel">
        <summary className="cursor-pointer text-lg font-semibold">Acompanhamento operacional <span className="dash-muted text-sm font-normal ml-2">Paradas, turnos, inspeções e fases da Fundição</span></summary>
        <Operacional d={d} claro={claro} onAbrir={abrirLista} onVerOSsFase={setFaseModal} onAbrirOP={(opLoteId) => setSelecao({ tipo: 'op', id: opLoteId })} />
      </details>
      <section aria-label="Indicadores de produção"><DashboardCharts data={d} onAbrir={abrirLista} /></section>
      <section className="min-w-0" aria-labelledby="roteiro-titulo">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div><h2 id="roteiro-titulo" className="text-xl font-semibold">Roteiro das OS</h2><p className="text-sm dash-muted">Cada OS na ordem das operações do PCP: ✓ concluída · ● onde está agora · ⇄ envio externo · ○ próximas.</p></div>
          <label className="text-sm w-full sm:w-80">Buscar no roteiro<input className="dash-input mt-1" value={buscaRoteiro} onChange={e => setBuscaRoteiro(e.target.value)} placeholder="OS, cliente, estação atual, atrasadas…" /></label>
        </div>
        <div className="dash-panel max-h-[520px] overflow-auto space-y-4">
          {roteiros.length === 0 && <p className="dash-empty">{buscaRoteiro ? 'Nenhuma OS encontrada.' : 'Nenhuma OS em andamento.'}</p>}
          {roteiros.map(r => <article key={r.osId} className="dash-row pt-4 first:border-0 first:pt-0" style={{ borderLeft: `4px solid ${r.semaforo === 'vermelho' ? '#f43f5e' : r.semaforo === 'amarelo' ? '#f59e0b' : '#10b981'}`, paddingLeft: 12 }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p><strong className="font-mono">{r.codigoGrv}</strong><span className="dash-muted text-sm"> · {r.cliente} · {r.artigo} — {r.descricao}</span>{r.prioridade === 'urgente' && <span className="text-xs font-bold text-rose-500 ml-2">URGENTE</span>}</p>
              <span className={`text-xs ${r.diasAtePrazo < 0 ? 'text-rose-500 font-semibold' : 'dash-muted'}`}>{dataCurta(r.prazoEntrega)} · {prazoTexto(r.diasAtePrazo)}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {r.lotes.map(l => <div key={l.loteId} className="flex gap-3 items-baseline">
                {r.lotes.length > 1 && <span className="dash-muted text-xs whitespace-nowrap">Lote {l.numeroLote}</span>}
                <TrilhaRoteiro passos={l.passos} quantidadePecas={l.quantidadePecas} />
              </div>)}
            </div>
          </article>)}
        </div>
      </section>
    </>}
    {selecao && selecao.tipo !== 'op' && d && <Modal open title={tituloModal} size="xl" onClose={() => setSelecao(null)}>
      <div className="dash-dialog">
        {selecao.tipo === 'externos' && <>
          <p className="dash-muted text-sm mb-4">{d.totalOSExternas} OS · {d.enviosExternos.length} lotes aguardando retorno. A confirmação de recebimento é feita na Metalização.</p>
          {!d.enviosExternos.length && <p className="dash-empty">Nenhuma OS em envio externo.</p>}
          <div className="space-y-4">{d.enviosExternos.map(e => <article key={e.opLoteId} className="dash-panel">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-mono font-bold text-lg">{e.codigoGrv}</h3><span className="text-sky-500 font-semibold">Aguardando retorno · {e.diasFora}d fora</span></div>
            <p className="text-sm mt-2">{e.cliente} · {e.artigo} — {e.descricao}</p>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-4">
              <Dado nome="Operação / lote" valor={`OP ${e.codigoOp} · Lote ${e.numeroLote}`} />
              <Dado nome="Quantidade enviada" valor={`${e.quantidade} peças`} />
              <Dado nome="Fornecedor" valor={e.fornecedor ?? 'Não informado'} />
              <Dado nome="Enviado em" valor={new Date(e.enviadoEm).toLocaleString('pt-BR')} />
              <Dado nome="Prazo da OS" valor={dataCurta(e.prazoEntrega)} />
              <Dado nome="Situação do prazo" valor={prazoTexto(e.diasAtePrazo)} />
            </dl>
          </article>)}</div>
        </>}
        {selecao.tipo === 'lista' && <>
          <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="dash-muted"><tr>{['OS', 'Cliente / artigo', 'Peças', 'Prazo', 'Conclusão / atraso'].map(t => <th key={t} className="py-3 pr-3 font-medium">{t}</th>)}</tr></thead>
            <tbody>{selecao.ids.map(id => {
              const os = todasOS.get(id); if (!os) return null;
              const hist = h?.os.find(o => o.id === id);
              return <tr key={id} className="dash-row"><td className="py-3 pr-3 font-mono">{os.codigoGrv}</td><td className="py-3 pr-3">{os.cliente.nome}<p className="dash-muted text-xs">{os.artigo.codigo} · {TIPOS_PECA[os.artigo.tipoProduto]}</p></td><td className="py-3 pr-3">{os.quantidadeTotal}</td><td className="py-3 pr-3 whitespace-nowrap">{dataCurta(os.prazoEntrega)}</td><td className="py-3 pr-3">{hist ? `${dataCurta(hist.concluidaEm)} · ${hist.diasAtraso ? `${hist.diasAtraso}d de atraso` : 'no prazo'}` : '—'}</td></tr>;
            })}</tbody></table></div>
          {!selecao.ids.length && <p className="dash-empty">Nenhuma OS neste recorte.</p>}
        </>}
      </div>
    </Modal>}
    {selecao?.tipo === 'op' && (
      <DetalhesOPDashboardModal
        opLoteId={selecao.id}
        onClose={() => setSelecao(null)}
        onAbrirDesenhos={(artigo, desenhos) =>
          setModalDesenhos({ artigo, desenhos })
        }
      />
    )}
    {faseModal && (
      <OSsFaseModal
        fase={faseModal}
        onClose={() => setFaseModal(null)}
        onSelecionarOS={(card) => {
          setFaseModal(null);
          setSelecao({ tipo: 'op', id: card.opLoteId });
        }}
      />
    )}
    {modalDesenhos && (
      <VisualizadorDesenhoModal
        open
        artigo={modalDesenhos.artigo}
        desenhos={modalDesenhos.desenhos}
        onClose={() => setModalDesenhos(null)}
      />
    )}
  </main>;
}

function Resumo({ label, valor, detalhe, cor = 'normal', onClick }: { label: string; valor: number; detalhe: string; cor?: string; onClick: () => void }) {
  return <button className="dash-summary" data-accent={cor} onClick={onClick}>
    <span className="text-sm font-medium">{label}</span><strong className="block text-4xl my-3 tabular-nums">{valor}</strong><span className="dash-muted text-xs">{detalhe}</span><span className="block text-xs dash-muted mt-3">Ver OS ↗</span>
  </button>;
}
function Dado({ nome, valor }: { nome: string; valor: string }) { return <div><dt className="dash-muted mb-1">{nome}</dt><dd>{valor}</dd></div>; }

function Operacional({ d, claro, onAbrir, onVerOSsFase, onAbrirOP }: { d: DashboardData; claro: boolean; onAbrir: (titulo: string, ids: string[]) => void; onVerOSsFase: (fase: FasePipeline) => void; onAbrirOP: (opLoteId: string) => void }) {
  return <div className="mt-5 space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="dash-panel"><h3 className="font-semibold">Máquinas paradas agora · {d.paradas.ativas.length}</h3><div className="max-h-48 overflow-y-auto mt-3 text-sm space-y-2">{d.paradas.ativas.map(p => <p key={p.id}>{p.maquina ?? 'Sem máquina'} · {p.codigoGrv} · {p.motivo} <strong className="text-rose-500">{p.minutosParado}min</strong></p>)}{!d.paradas.ativas.length && <p className="dash-muted">Nenhuma parada em aberto.</p>}</div></section>
      <section className="dash-panel"><h3 className="font-semibold">Tempo parado hoje por motivo</h3><div className="max-h-48 overflow-y-auto mt-3 text-sm space-y-2">{Object.entries(d.paradas.porMotivoHoje).map(([motivo, p]) => <p key={motivo}>{motivo} · {p.ocorrencias} ocorrências · <strong>{numero(p.minutos)}min</strong></p>)}{!Object.keys(d.paradas.porMotivoHoje).length && <p className="dash-muted">Nenhuma parada registrada hoje.</p>}</div></section>
      <section className="dash-panel"><h3 className="font-semibold">Operações abertas há mais de 4h · {d.fantasmas.opsParadas.length}</h3><p className="dash-muted text-xs mt-1">Tempo de carimbo aberto; não significa máquina parada.</p><div className="max-h-48 overflow-y-auto mt-3 text-sm space-y-2">{d.fantasmas.opsParadas.map((op, i) => <p key={i}>{op.codigoGrv} · OP {op.codigoOp} · {op.etapa} · {op.horasParado}h</p>)}{!d.fantasmas.opsParadas.length && <p className="dash-muted">Nenhuma operação neste recorte.</p>}</div></section>
      <section className="dash-panel"><h3 className="font-semibold">Turnos não fechados ontem · {d.fantasmas.turnosNaoFechados.length}</h3><p className="dash-muted text-xs mt-1">Equipe completa da fábrica, independente dos filtros de OS.</p><div className="max-h-48 overflow-y-auto mt-3 text-sm">{d.fantasmas.turnosNaoFechados.map((t, i) => <p key={i}>{t.operador}</p>)}{!d.fantasmas.turnosNaoFechados.length && <p className="dash-muted">Todos fecharam.</p>}</div></section>
    </div>
    {d.pipelines.map(p => <section key={p.etapaId} className="dash-panel overflow-hidden"><h3 className="font-semibold mb-4">{p.etapaNome} em detalhe</h3><div className="max-h-96 overflow-auto"><PipelineEtapa pipeline={p} variante="compacta" claro={claro} onVerOSsFase={onVerOSsFase} /></div></section>)}
    <div className="flex flex-wrap gap-5 text-sm"><span>Inspeções aprovadas: <strong>{d.inspecao.aprovado ?? 0}</strong></span><span>Com observações: <strong>{d.inspecao.com_observacoes ?? 0}</strong></span><span>Reprovadas: <strong>{d.inspecao.reprovado ?? 0}</strong></span><button className="underline" onClick={() => onAbrir('OS canceladas', (d.osPorStatusLista.cancelada ?? []).map(o => o.id))}>OS canceladas: {d.osPorStatus.cancelada ?? 0}</button></div>
  </div>;
}

function DetalhesOPDashboardModal({
  opLoteId,
  onClose,
  onAbrirDesenhos,
}: {
  opLoteId: string;
  onClose: () => void;
  onAbrirDesenhos?: (
    artigo: { id: string; codigo: string; descricao?: string },
    desenhos: Desenho[],
  ) => void;
}) {
  const { data: op, isLoading, isError } = useOPLoteDetail(opLoteId);

  if (isLoading) {
    return (
      <Modal open onClose={onClose} title="Detalhes da OP" size="md" forcarEscuro>
        <div className="p-8 text-center text-neutral-400">
          <div className="inline-block w-8 h-8 border-2 border-neutral-600 border-t-forja-500 rounded-full animate-spin mb-3" />
          <p className="text-sm">Buscando informações da OP…</p>
        </div>
      </Modal>
    );
  }

  if (isError || !op) {
    return (
      <Modal open onClose={onClose} title="Detalhes da OP" size="sm" forcarEscuro>
        <div className="p-6 text-center text-neutral-400 space-y-4">
          <p className="text-sm">Não foi possível carregar os detalhes desta OP.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm transition"
          >
            Fechar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <DetalhesOPModal
      op={op}
      onClose={onClose}
      onAbrirDesenhos={onAbrirDesenhos}
    />
  );
}

