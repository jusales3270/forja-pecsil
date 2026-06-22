// ============================================================
// Forja - Dashboard do Chefe (Sprint 6) - visao TV
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard, type KanbanCard } from '../hooks/useDashboard';

const LABELS_STATUS_OS: Record<string, string> = {
  aberta: 'Abertas',
  em_producao: 'Em produção',
  finalizada: 'Finalizadas',
  atrasada: 'Atrasadas',
  cancelada: 'Canceladas',
};

const LABELS_STATUS_OP: Record<string, string> = {
  na_fila: 'Na fila',
  em_processo: 'Em processo',
  aguardando_qualidade: 'Aguard. qualidade',
  concluida: 'Concluídas',
  bloqueada: 'Bloqueadas',
};

function diasAtraso(prazo: string): number {
  return Math.floor((Date.now() - new Date(prazo).getTime()) / 86_400_000);
}

function corSemaforo(s: string): string {
  if (s === 'vermelho') return '#E24B4A';
  if (s === 'amarelo') return '#EF9F27';
  return '#1D9E75';
}

function textoPrazo(c: KanbanCard): string {
  if (c.diasAtePrazo < 0) return Math.abs(c.diasAtePrazo) + 'd atraso';
  return c.diasAtePrazo + 'd';
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
  const [modal, setModal] = useState<{ titulo: string; tipo: 'lista' | 'os'; itens?: any[]; os?: any } | null>(null);
  const kanbanFiltrado = useMemo(() => {
    if (!data) return [];
    return data.data.kanban.map((et) => ({ ...et, cards: et.cards.filter((c) => cardBate(c, busca.trim(), et.nome)) }));
  }, [data, busca]);

  if (isLoading) return <div className="p-6 text-neutral-400">Carregando...</div>;
  if (isError || !data) return <div className="p-6 error-message">Erro ao carregar o dashboard.</div>;

  const d = data.data;
  const totalAtrasadas = d.osAtrasadas.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-100">Painel de Produção</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Atualiza sozinho a cada 30s · {new Date(d.geradoEm).toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-lg"
        >
          ← Voltar
        </button>
      </div>

      <div>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: cliente, OS, etapa, operador, atrasadas..."
          className="input w-full"
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
            className="card text-center hover:border-forja-500/50 transition-colors cursor-pointer"
          >
            <div className="text-3xl font-bold text-neutral-100">{d.osPorStatus[k] ?? 0}</div>
            <div className="text-xs text-neutral-500 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Lotes Fantasmas v2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={d.fantasmas.opsParadas.length > 0 ? 'card border-amber-500/40 bg-amber-500/5' : 'card'}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-100">OPs paradas (4h+)</h2>
            <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/30">{d.fantasmas.opsParadas.length}</span>
          </div>
          {d.fantasmas.opsParadas.length === 0 ? (
            <p className="text-xs text-neutral-500">Nenhuma OP parada.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {d.fantasmas.opsParadas.map((op, i) => (
                <div key={i} className="flex justify-between border-b border-neutral-800 py-1">
                  <span className="text-neutral-300">{op.codigoGrv} · {op.codigoOp} ({op.etapa})</span>
                  <span className="text-amber-400 font-semibold">{op.horasParado}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={d.fantasmas.turnosNaoFechados.length > 0 ? 'card border-blue-500/40 bg-blue-500/5' : 'card'}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-100">Turnos não fechados (ontem)</h2>
            <span className="badge bg-blue-500/15 text-blue-400 border-blue-500/30">{d.fantasmas.turnosNaoFechados.length}</span>
          </div>
          {d.fantasmas.turnosNaoFechados.length === 0 ? (
            <p className="text-xs text-neutral-500">Todos fecharam.</p>
          ) : (
            <div className="space-y-1 text-xs text-neutral-300">
              {d.fantasmas.turnosNaoFechados.map((t, i) => (
                <div key={i} className="border-b border-neutral-800 py-1">{t.operador}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kanban: mapa de lotes por etapa */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">Onde está cada lote</h2>
        {kanbanFiltrado.every((et) => et.cards.length === 0) ? (
          <div className="card"><p className="text-sm text-neutral-500">Nenhum lote em produção.</p></div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {kanbanFiltrado.map((et) => (
              <div key={et.etapaId} className="min-w-[260px] w-[260px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="font-medium text-neutral-100">{et.nome}</span>
                  <span className="badge bg-neutral-700/50 text-neutral-300">{et.total}</span>
                </div>
                <div className="space-y-2">
                  {et.cards.map((c) => (
                    <div
                      key={c.opLoteId}
                      onClick={() => setModal({ titulo: c.codigoGrv, tipo: 'os', os: c })}
                      className={
                        'rounded-lg border-l-4 bg-neutral-800/40 p-3 cursor-pointer hover:bg-neutral-800/70 ' +
                        (c.semaforo === 'vermelho'
                          ? 'border-red-500'
                          : c.semaforo === 'amarelo'
                          ? 'border-amber-500'
                          : 'border-emerald-500')
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-neutral-100">{c.codigoGrv}</span>
                        {c.prioridade === 'urgente' && (
                          <span className="text-[10px] uppercase text-red-400 font-bold">urgente</span>
                        )}
                      </div>
                      <div className="text-sm text-neutral-300 mt-0.5">{c.cliente} · {c.artigo}</div>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-neutral-500">OP {c.codigoOp} · Lote {c.numeroLote}</span>
                        <span
                          className={
                            c.semaforo === 'vermelho'
                              ? 'text-red-400 font-semibold'
                              : c.semaforo === 'amarelo'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {c.diasAtePrazo < 0 ? `${Math.abs(c.diasAtePrazo)}d atrasado` : `${c.diasAtePrazo}d`}
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
      <div className="card">
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">Inspeção</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-400">{d.inspecao['aprovado'] ?? 0}</div>
            <div className="text-xs text-neutral-500">Aprovadas</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{d.inspecao['com_observacoes'] ?? 0}</div>
            <div className="text-xs text-neutral-500">Com observações</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{d.inspecao['reprovado'] ?? 0}</div>
            <div className="text-xs text-neutral-500">Reprovadas</div>
          </div>
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-100">{modal.titulo}</h2>
              <button onClick={() => setModal(null)} className="text-neutral-500 hover:text-neutral-200 text-xl leading-none">x</button>
            </div>

            {modal.tipo === 'lista' && (
              modal.itens && modal.itens.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-neutral-400 text-left">
                    <tr>
                      <th className="py-1 pr-3">OS</th>
                      <th className="py-1 pr-3">Cliente</th>
                      <th className="py-1 pr-3">Artigo</th>
                      <th className="py-1 pr-3">Qtd</th>
                      <th className="py-1 pr-3">Prazo</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-200">
                    {modal.itens.map((os) => (
                      <tr key={os.id} className="border-t border-neutral-800">
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
                <p className="text-sm text-neutral-500">Nenhuma OS neste status.</p>
              )
            )}

            {modal.tipo === 'os' && modal.os && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">Cliente</span>
                  <span className="text-neutral-200">{modal.os.cliente}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">Artigo</span>
                  <span className="text-neutral-200">{modal.os.artigo}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">Lote</span>
                  <span className="text-neutral-200">{modal.os.numeroLote}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">OP</span>
                  <span className="text-neutral-200">{modal.os.codigoOp}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">Status</span>
                  <span className="text-neutral-200">{modal.os.status}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">Prazo</span>
                  <span className="text-neutral-200">{modal.os.diasAtePrazo < 0 ? Math.abs(modal.os.diasAtePrazo) + 'd atrasado' : modal.os.diasAtePrazo + 'd restantes'}</span>
                </div>
                {modal.os.operador && (
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Operador</span>
                    <span className="text-neutral-200">{modal.os.operador}</span>
                  </div>
                )}
                {modal.os.programador && (
                  <div className="flex justify-between border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Programador</span>
                    <span className="text-neutral-200">{modal.os.programador}</span>
                  </div>
                )}
                {modal.os.maquina && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Maquina</span>
                    <span className="text-neutral-200">{modal.os.maquina}</span>
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
