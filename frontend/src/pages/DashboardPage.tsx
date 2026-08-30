// ============================================================
// Forja - Dashboard do Chefe (Sprint 6) - visao TV
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard, type KanbanCard } from '../hooks/useDashboard';
import { useTheme } from '../lib/theme-store';
import { PipelineEtapa } from '../components/PipelineEtapa';
import { tempoNaFase, type PipelineEtapa as PipelineEtapaData } from '../hooks/usePipelineEtapa';

const LABELS_STATUS_OS: Record<string, string> = {
  aberta: 'Abertas',
  em_producao: 'Em produção',
  finalizada: 'Finalizadas',
  atrasada: 'Atrasadas',
  cancelada: 'Canceladas',
};

function corSemaforo(s: string): string {
  if (s === 'vermelho') return '#E24B4A';
  if (s === 'amarelo') return '#EF9F27';
  return '#1D9E75';
}

function cardBate(c: KanbanCard, termo: string, etapaNome: string): boolean {
  if (!termo) return true;
  const t = termo.toLowerCase();
  if ((t === 'atrasada' || t === 'atrasadas' || t === 'atrasado' || t === 'atrasados') && c.diasAtePrazo < 0) return true;
  if ((t === 'urgente' || t === 'urgentes') && c.prioridade === 'urgente') return true;
  const campos = [c.codigoGrv, c.codigoOp, c.cliente, c.artigo, c.status, c.operador || '', c.programador || '', c.maquina || '', etapaNome].join(' ').toLowerCase();
  return campos.includes(t);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDashboard();
  const [busca, setBusca] = useState('');
  const { claro, toggleTema } = useTheme();
  const [modal, setModal] = useState<{ titulo: string; tipo: 'lista' | 'os'; itens?: any[]; os?: any } | null>(null);
  const kanbanFiltrado = useMemo(() => {
    if (!data) return [];
    return data.data.kanban.map((et) => ({ ...et, cards: et.cards.filter((c) => cardBate(c, busca.trim(), et.nome)) }));
  }, [data, busca]);

  if (isLoading) return <div className="p-6 text-neutral-400">Carregando...</div>;
  if (isError || !data) return <div className="p-6 error-message">Erro ao carregar o dashboard.</div>;

  const d = data.data;

  // paleta por tema
  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        card: 'bg-white border border-slate-200 rounded-xl p-4',
        coluna: 'bg-slate-200/50',
        colTitulo: 'text-slate-700',
        colBadge: 'bg-slate-300 text-slate-700',
        cardK: 'bg-slate-50 border border-slate-200',
        cardKHover: 'hover:bg-slate-100',
        cardKTexto: 'text-slate-900',
        cardKSub: 'text-slate-500',
        divisor: 'border-slate-200',
        input: 'w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400',
        btn: 'text-slate-600 hover:text-slate-900 border border-slate-300',
        modalBg: 'bg-white border border-slate-200',
        modalTexto: 'text-slate-900',
        modalSub: 'text-slate-500',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-500',
        card: 'card',
        coluna: 'bg-transparent',
        colTitulo: 'text-neutral-100',
        colBadge: 'bg-neutral-700/50 text-neutral-300',
        cardK: 'bg-neutral-800/40',
        cardKHover: 'hover:bg-neutral-800/70',
        cardKTexto: 'text-neutral-100',
        cardKSub: 'text-neutral-300',
        divisor: 'border-neutral-800',
        input: 'input w-full',
        btn: 'text-neutral-400 hover:text-neutral-200 border border-neutral-800',
        modalBg: 'bg-neutral-900 border border-neutral-700',
        modalTexto: 'text-neutral-100',
        modalSub: 'text-neutral-500',
      };

  return (
    <div className={`min-h-screen p-6 space-y-6 ${T.bg} ${T.texto}`}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${T.texto}`}>Painel de Produção</h1>
          <p className={`text-sm ${T.sub} mt-1`}>
            Atualiza sozinho a cada 30s · {new Date(d.geradoEm).toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toggleTema()}
            className={`px-3 py-2 text-sm rounded-lg ${T.btn}`}
            title="Alternar tema"
          >
            {claro ? 'Escuro' : 'Claro'}
          </button>
          <button
            onClick={() => navigate('/')}
            className={`px-4 py-2 text-sm rounded-lg ${T.btn}`}
          >
            ← Voltar
          </button>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: cliente, OS, etapa, operador, atrasadas..."
          className={T.input}
        />
        {busca.trim() && (
          <button className="text-xs text-forja-400 hover:underline mt-1" onClick={() => setBusca('')}>limpar busca</button>
        )}
      </div>

      {/* Cards de status de OS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(LABELS_STATUS_OS).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setModal({ titulo: label, tipo: 'lista', itens: d.osPorStatusLista[k] ?? [] })}
            className={`${T.card} text-center hover:border-forja-500/50 transition-colors cursor-pointer`}
          >
            <div className={`text-3xl font-bold ${T.texto}`}>{d.osPorStatus[k] ?? 0}</div>
            <div className={`text-xs ${T.sub} mt-1`}>{label}</div>
          </button>
        ))}
      </div>

      {/* Paradas de máquina */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${T.card} ${d.paradas.ativas.length > 0 ? 'border-red-500/40' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-sm font-semibold ${T.texto}`}>Máquinas paradas agora</h2>
            <span className="badge bg-red-500/15 text-red-500 border-red-500/30">{d.paradas.ativas.length}</span>
          </div>
          {d.paradas.ativas.length === 0 ? (
            <p className={`text-xs ${T.sub}`}>Nenhuma parada em aberto.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {d.paradas.ativas.map((p) => (
                <div key={p.id} className={`flex justify-between border-b ${T.divisor} py-1`}>
                  <span className={T.cardKSub}>
                    {p.maquina ?? '—'} · {p.codigoGrv} ({p.etapa}) — {p.motivo}
                    {p.planejado ? ' · planejada' : ''}
                  </span>
                  <span className="text-red-500 font-semibold">{p.minutosParado}min</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={T.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-sm font-semibold ${T.texto}`}>Tempo parado hoje, por motivo</h2>
          </div>
          {Object.keys(d.paradas.porMotivoHoje).length === 0 ? (
            <p className={`text-xs ${T.sub}`}>Nenhuma parada registrada hoje.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {Object.entries(d.paradas.porMotivoHoje)
                .sort(([, a], [, b]) => b.minutos - a.minutos)
                .map(([motivo, info]) => (
                  <div key={motivo} className={`flex justify-between border-b ${T.divisor} py-1`}>
                    <span className={T.cardKSub}>
                      {motivo}
                      {info.planejado ? ' · planejada' : ''} ({info.ocorrencias}x)
                    </span>
                    <span className={`font-semibold ${info.planejado ? 'text-blue-500' : 'text-amber-500'}`}>
                      {info.minutos}min
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Lotes Fantasmas v2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${T.card} ${d.fantasmas.opsParadas.length > 0 ? 'border-amber-500/40' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-sm font-semibold ${T.texto}`}>OPs paradas (4h+)</h2>
            <span className="badge bg-amber-500/15 text-amber-500 border-amber-500/30">{d.fantasmas.opsParadas.length}</span>
          </div>
          {d.fantasmas.opsParadas.length === 0 ? (
            <p className={`text-xs ${T.sub}`}>Nenhuma OP parada.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {d.fantasmas.opsParadas.map((op, i) => (
                <div key={i} className={`flex justify-between border-b ${T.divisor} py-1`}>
                  <span className={T.cardKSub}>{op.codigoGrv} · {op.codigoOp} ({op.etapa})</span>
                  <span className="text-amber-500 font-semibold">{op.horasParado}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`${T.card} ${d.fantasmas.turnosNaoFechados.length > 0 ? 'border-blue-500/40' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-sm font-semibold ${T.texto}`}>Turnos não fechados (ontem)</h2>
            <span className="badge bg-blue-500/15 text-blue-500 border-blue-500/30">{d.fantasmas.turnosNaoFechados.length}</span>
          </div>
          {d.fantasmas.turnosNaoFechados.length === 0 ? (
            <p className={`text-xs ${T.sub}`}>Todos fecharam.</p>
          ) : (
            <div className={`space-y-1 text-xs ${T.cardKSub}`}>
              {d.fantasmas.turnosNaoFechados.map((t, i) => (
                <div key={i} className={`border-b ${T.divisor} py-1`}>{t.operador}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Etapas com operações internas (fundição): o kanban geral mostra só
          "está na fundição"; aqui o chefe vê em qual das 5 fases cada OS está. */}
      {d.pipelines?.map((p) => (
        <DetalheEtapaInterna key={p.etapaId} pipeline={p} claro={claro} T={T} />
      ))}

      {/* Kanban: mapa de lotes por etapa */}
      <div>
        <h2 className={`text-lg font-semibold ${T.texto} mb-3`}>Onde está cada lote</h2>
        {kanbanFiltrado.every((et) => et.cards.length === 0) ? (
          <div className={T.card}><p className={`text-sm ${T.sub}`}>Nenhum lote em produção.</p></div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {kanbanFiltrado.map((et) => (
              <div key={et.etapaId} className={`min-w-[260px] w-[260px] flex-shrink-0 rounded-lg p-2 ${T.coluna}`}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`font-medium ${T.colTitulo}`}>{et.nome}</span>
                  <span className={`badge ${T.colBadge}`}>{et.total}</span>
                </div>
                <div className="space-y-2">
                  {et.cards.map((c) => (
                    <div
                      key={c.opLoteId}
                      onClick={() => setModal({ titulo: c.codigoGrv, tipo: 'os', os: c })}
                      className={`rounded-lg border-l-4 p-3 cursor-pointer ${T.cardK} ${T.cardKHover}`}
                      style={{ borderLeftColor: corSemaforo(c.semaforo) }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-semibold ${T.cardKTexto}`}>{c.codigoGrv}</span>
                        {c.prioridade === 'urgente' && (
                          <span className="text-[10px] uppercase text-red-500 font-bold">urgente</span>
                        )}
                      </div>
                      <div className={`text-sm ${T.cardKSub} mt-0.5`}>{c.cliente} · {c.artigo}</div>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className={T.sub}>OP {c.codigoOp} · Lote {c.numeroLote}</span>
                        <span className="font-semibold" style={{ color: corSemaforo(c.semaforo) }}>
                          {c.diasAtePrazo < 0 ? Math.abs(c.diasAtePrazo) + 'd atrasado' : c.diasAtePrazo + 'd'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspecao */}
      <div className={T.card}>
        <h2 className={`text-lg font-semibold ${T.texto} mb-3`}>Inspeção</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-500">{d.inspecao['aprovado'] ?? 0}</div>
            <div className={`text-xs ${T.sub}`}>Aprovadas</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-500">{d.inspecao['com_observacoes'] ?? 0}</div>
            <div className={`text-xs ${T.sub}`}>Com observações</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">{d.inspecao['reprovado'] ?? 0}</div>
            <div className={`text-xs ${T.sub}`}>Reprovadas</div>
          </div>
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className={`${T.modalBg} rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${T.modalTexto}`}>{modal.titulo}</h2>
              <button onClick={() => setModal(null)} className={`${T.modalSub} hover:opacity-70 text-xl leading-none`}>x</button>
            </div>

            {modal.tipo === 'lista' && (
              modal.itens && modal.itens.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className={`${T.modalSub} text-left`}>
                    <tr>
                      <th className="py-1 pr-3">OS</th>
                      <th className="py-1 pr-3">Cliente</th>
                      <th className="py-1 pr-3">Artigo</th>
                      <th className="py-1 pr-3">Qtd</th>
                      <th className="py-1 pr-3">Prazo</th>
                    </tr>
                  </thead>
                  <tbody className={T.modalTexto}>
                    {modal.itens.map((os) => (
                      <tr key={os.id} className={`border-t ${T.divisor}`}>
                        <td className="py-1.5 pr-3 font-mono">{os.codigoGrv}</td>
                        <td className="py-1.5 pr-3">{os.cliente.nome}</td>
                        <td className="py-1.5 pr-3">{os.artigo.codigo}</td>
                        <td className="py-1.5 pr-3">{os.quantidadeTotal}</td>
                        <td className="py-1.5 pr-3">{new Date(os.prazoEntrega).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={`text-sm ${T.modalSub}`}>Nenhuma OS neste status.</p>
              )
            )}

            {modal.tipo === 'os' && modal.os && (
              <div className="space-y-2 text-sm">
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>Cliente</span>
                  <span className={T.modalTexto}>{modal.os.cliente}</span>
                </div>
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>Artigo</span>
                  <span className={T.modalTexto}>{modal.os.artigo}</span>
                </div>
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>Lote</span>
                  <span className={T.modalTexto}>{modal.os.numeroLote}</span>
                </div>
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>OP</span>
                  <span className={T.modalTexto}>{modal.os.codigoOp}</span>
                </div>
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>Status</span>
                  <span className={T.modalTexto}>{modal.os.status}</span>
                </div>
                <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                  <span className={T.modalSub}>Prazo</span>
                  <span className={T.modalTexto}>{modal.os.diasAtePrazo < 0 ? Math.abs(modal.os.diasAtePrazo) + 'd atrasado' : modal.os.diasAtePrazo + 'd restantes'}</span>
                </div>
                {modal.os.operador && (
                  <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                    <span className={T.modalSub}>Operador</span>
                    <span className={T.modalTexto}>{modal.os.operador}</span>
                  </div>
                )}
                {modal.os.programador && (
                  <div className={`flex justify-between border-b ${T.divisor} pb-2`}>
                    <span className={T.modalSub}>Programador</span>
                    <span className={T.modalTexto}>{modal.os.programador}</span>
                  </div>
                )}
                {modal.os.maquina && (
                  <div className="flex justify-between">
                    <span className={T.modalSub}>Maquina</span>
                    <span className={T.modalTexto}>{modal.os.maquina}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Detalhe de uma etapa com operações internas (fundição)
// ============================================================
// A faixa de fluxo é a mesma peça que o tótem usa, então o que o chefe vê no
// painel é literalmente o que o pessoal vê no chão de fábrica.
function DetalheEtapaInterna({
  pipeline,
  claro,
  T,
}: {
  pipeline: PipelineEtapaData;
  claro: boolean;
  T: Record<string, string>;
}) {
  // Operações configuradas pra avisar outra etapa — na fundição, o tratamento
  // térmico. É o ciclo longo que dá (ou tira) previsibilidade do desbaste.
  const cicloLongo = pipeline.fases
    .flatMap((f) => f.cards)
    .filter((c) => c.etapaAvisada !== null);
  const nomesDoCiclo = [...new Set(cicloLongo.map((c) => c.tipoServico))];

  return (
    <div className={T.card}>
      <h2 className={`text-lg font-semibold ${T.texto} mb-3`}>
        {pipeline.etapaNome} em detalhe
      </h2>

      <PipelineEtapa pipeline={pipeline} variante="compacta" claro={claro} />

      {cicloLongo.length > 0 && (
        <div>
          <h3 className={`text-sm font-semibold ${T.texto} mb-2`}>
            Ciclo de {nomesDoCiclo.join(' / ')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className={`${T.sub} text-left`}>
                <tr>
                  <th className="py-1 pr-3 font-medium">OS</th>
                  <th className="py-1 pr-3 font-medium">Artigo</th>
                  <th className="py-1 pr-3 font-medium">Cliente</th>
                  <th className="py-1 pr-3 font-medium">No ciclo há</th>
                  <th className="py-1 pr-3 font-medium">Avisou</th>
                </tr>
              </thead>
              <tbody className={T.cardKTexto}>
                {cicloLongo.map((c) => (
                  <tr key={c.opLoteId} className={`border-t ${T.divisor}`}>
                    <td className="py-1.5 pr-3 font-mono">
                      {c.codigoGrv}
                      {c.prioridade === 'urgente' && (
                        <span className="ml-1 text-[10px] uppercase text-red-500 font-bold">
                          urgente
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">{c.artigo}</td>
                    <td className="py-1.5 pr-3">{c.cliente}</td>
                    <td className="py-1.5 pr-3">
                      {c.desdeQuando ? (
                        tempoNaFase(c.desdeQuando)
                      ) : (
                        <span className={T.sub}>ainda na fila</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {c.alertaInicioEm ? (
                        <span className="text-emerald-500">
                          {c.etapaAvisada} · há {tempoNaFase(c.alertaInicioEm)}
                        </span>
                      ) : (
                        <span className={T.sub}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
