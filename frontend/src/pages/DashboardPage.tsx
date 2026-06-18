// ============================================================
// Forja - Dashboard do Chefe (Sprint 6) - visao TV
// ============================================================

import { useDashboard } from '../hooks/useDashboard';

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

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) return <div className="p-6 text-neutral-400">Carregando...</div>;
  if (isError || !data) return <div className="p-6 error-message">Erro ao carregar o dashboard.</div>;

  const d = data.data;
  const totalAtrasadas = d.osAtrasadas.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-100">Painel de Produção</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Atualiza sozinho a cada 30s · {new Date(d.geradoEm).toLocaleTimeString('pt-BR')}
        </p>
      </div>

      {/* Cards de status de OS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(LABELS_STATUS_OS).map(([k, label]) => (
          <div key={k} className="card text-center">
            <div className="text-3xl font-bold text-neutral-100">{d.osPorStatus[k] ?? 0}</div>
            <div className="text-xs text-neutral-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* OS atrasadas em destaque */}
      <div className={totalAtrasadas > 0 ? 'card border-red-500/40 bg-red-500/5' : 'card'}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-100">OS atrasadas</h2>
          <span className={totalAtrasadas > 0 ? 'badge bg-red-500/15 text-red-400 border-red-500/30' : 'badge'}>
            {totalAtrasadas}
          </span>
        </div>
        {totalAtrasadas === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma OS atrasada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-400 text-left">
                <tr>
                  <th className="py-2 pr-4">OS</th>
                  <th className="py-2 pr-4">Cliente / Artigo</th>
                  <th className="py-2 pr-4">Prazo</th>
                  <th className="py-2 pr-4">Atraso</th>
                  <th className="py-2 pr-4">Prioridade</th>
                </tr>
              </thead>
              <tbody className="text-neutral-200">
                {d.osAtrasadas.map((os) => (
                  <tr key={os.id} className="border-t border-neutral-800">
                    <td className="py-2 pr-4 font-mono">{os.codigoGrv}</td>
                    <td className="py-2 pr-4">{os.cliente.nome} · {os.artigo.codigo}</td>
                    <td className="py-2 pr-4">{new Date(os.prazoEntrega).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 pr-4 text-red-400 font-semibold">{diasAtraso(os.prazoEntrega)}d</td>
                    <td className="py-2 pr-4">
                      {os.prioridade === 'urgente' ? (
                        <span className="text-red-400">urgente</span>
                      ) : (
                        <span className="text-neutral-400">normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kanban: OPs por etapa */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-100 mb-3">Produção por etapa</h2>
        {d.kanban.length === 0 ? (
          <div className="card"><p className="text-sm text-neutral-500">Nenhuma OP em produção.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {d.kanban.map((et) => (
              <div key={et.etapaId} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-neutral-100">{et.nome}</span>
                  <span className="text-2xl font-bold text-forja-400">{et.total}</span>
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(et.porStatus).map(([s, n]) => (
                    <div key={s} className="flex justify-between text-neutral-400">
                      <span>{LABELS_STATUS_OP[s] ?? s}</span>
                      <span className="text-neutral-200">{n}</span>
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
    </div>
  );
}
