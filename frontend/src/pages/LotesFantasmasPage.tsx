// ============================================================
// Forja - Painel de Lotes Fantasmas v1 (Sprint 4 - Bloco D)
// Visibilidade de gaps de apontamento para PCP e Chefe
// ============================================================

import { useState } from 'react';
import { useLotesFantasmas } from '../hooks/useLotesFantasmas';

const OPCOES_HORAS = [2, 4, 6, 8, 12];

function Card({
  titulo,
  cor,
  count,
  children,
}: {
  titulo: string;
  cor: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-neutral-100">{titulo}</h2>
        <span className={`badge ${cor}`}>{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function LotesFantasmasPage() {
  const [horas, setHoras] = useState(4);
  const { data, isLoading, isError, refetch, isFetching } = useLotesFantasmas(horas);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">👻 Lotes Fantasmas</h1>
          <p className="text-sm text-neutral-400 mt-1">
            OPs sem movimentação, máquinas sem registro e turnos não fechados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-400">Limite:</label>
          <select
            className="input w-auto"
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
          >
            {OPCOES_HORAS.map((h) => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-neutral-400">Carregando…</p>}
      {isError && <p className="error-message">Erro ao carregar o painel.</p>}

      {data && (
        <div className="space-y-6">
          <Card
            titulo="OPs paradas (carimbo aberto)"
            cor="bg-red-500/15 text-red-400 border-red-500/30"
            count={data.resumo.opsParadas}
          >
            {data.opsParadas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma OP parada além do limite. 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-neutral-400 text-left">
                    <tr>
                      <th className="py-2 pr-4">OP</th>
                      <th className="py-2 pr-4">OS / Cliente</th>
                      <th className="py-2 pr-4">Etapa</th>
                      <th className="py-2 pr-4">Máquina</th>
                      <th className="py-2 pr-4">Programador</th>
                      <th className="py-2 pr-4">Parado há</th>
                      <th className="py-2 pr-4">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-200">
                    {data.opsParadas.map((op) => (
                      <tr key={op.carimboId} className="border-t border-neutral-800">
                        <td className="py-2 pr-4 font-mono">{op.codigoOp}</td>
                        <td className="py-2 pr-4">
                          {op.codigoGrv} · {op.cliente}
                        </td>
                        <td className="py-2 pr-4">{op.etapa}</td>
                        <td className="py-2 pr-4">{op.maquina ?? '—'}</td>
                        <td className="py-2 pr-4">{op.programador ?? '—'}</td>
                        <td className="py-2 pr-4 text-red-400 font-semibold">
                          {op.horasParado}h
                        </td>
                        <td className="py-2 pr-4">{op.quantidadeConcluida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            titulo="Máquinas sem registro"
            cor="bg-amber-500/15 text-amber-400 border-amber-500/30"
            count={data.resumo.maquinasSemRegistro}
          >
            {data.maquinasSemRegistro.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma máquina rodando sem registro.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-neutral-400 text-left">
                    <tr>
                      <th className="py-2 pr-4">OP</th>
                      <th className="py-2 pr-4">Máquina</th>
                      <th className="py-2 pr-4">Operador</th>
                      <th className="py-2 pr-4">Rodando há</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-200">
                    {data.maquinasSemRegistro.map((m) => (
                      <tr key={m.processamentoId} className="border-t border-neutral-800">
                        <td className="py-2 pr-4 font-mono">{m.codigoOp}</td>
                        <td className="py-2 pr-4">{m.maquina}</td>
                        <td className="py-2 pr-4">{m.operador}</td>
                        <td className="py-2 pr-4 text-amber-400 font-semibold">{m.horasRodando}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            titulo="Turnos não fechados (ontem)"
            cor="bg-blue-500/15 text-blue-400 border-blue-500/30"
            count={data.resumo.turnosNaoFechados}
          >
            {data.turnosNaoFechados.length === 0 ? (
              <p className="text-sm text-neutral-500">Todos os turnos de ontem foram fechados.</p>
            ) : (
              <ul className="space-y-1 text-sm text-neutral-200">
                {data.turnosNaoFechados.map((t) => (
                  <li key={t.operadorId} className="border-t border-neutral-800 py-2">
                    {t.operador}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
