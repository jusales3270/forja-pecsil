// ============================================================
// Forja - Lista de OS (Ordens de Serviço)
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOSList,
  LABELS_STATUS_OS,
  CORES_STATUS_OS,
  STATUS_OS,
  type OS,
  formatarPrazo,
  corPrazo,
  diasAtePrazo,
} from '../../hooks/useOS';
import { useClientesList as useClientes } from '../../hooks/useClientes';
import { ObservacaoBadge } from '../../components/ObservacaoBadge';
import { NovaOSModal } from './NovaOSModal';

function formatarMoeda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OSListPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [criando, setCriando] = useState(false);

  const { data: clientesData } = useClientes();
  const clientes = clientesData?.data ?? [];

  const { data: osData, isLoading, isError } = useOSList({
    clienteId: clienteFiltro || undefined,
    status: (statusFiltro as any) || undefined,
    busca: busca || undefined,
  });

  const oses = osData?.data ?? [];

  const filtradas = useMemo(() => {
    return oses;
  }, [oses]);

  const totalGeral = useMemo(() => {
    return filtradas.reduce((acc, os) => {
      const v = os.valorTotal ? parseFloat(os.valorTotal) : 0;
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [filtradas]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors mb-3 flex items-center gap-1"
        >
          <span className="text-base leading-none">←</span> Voltar para o início
        </button>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-forja-50">Ordens de Serviço</h1>
            <p className="text-neutral-400 mt-1">
              Gerencie as OS abertas, em produção e finalizadas.
            </p>
          </div>
          <button
            onClick={() => setCriando(true)}
            className="px-4 py-2 bg-forja-500 hover:bg-forja-600 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova OS
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código GRV, artigo..."
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                Cliente
              </label>
              <select
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                Status
              </label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {STATUS_OS.map((s) => (
                  <option key={s} value={s}>
                    {LABELS_STATUS_OS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resumo */}
        {!isLoading && !isError && filtradas.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                Total de OS
              </div>
              <div className="text-2xl font-bold mt-1">{filtradas.length}</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                Em produção
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-400">
                {filtradas.filter((o) => o.status === 'em_producao').length}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                Atrasadas
              </div>
              <div className="text-2xl font-bold mt-1 text-red-400">
                {
                  filtradas.filter(
                    (o) =>
                      o.status !== 'finalizada' &&
                      o.status !== 'cancelada' &&
                      diasAtePrazo(o.prazoEntrega) < 0,
                  ).length
                }
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                Valor total
              </div>
              <div className="text-2xl font-bold mt-1 text-forja-400">
                {formatarMoeda(totalGeral)}
              </div>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {isLoading && (
            <div className="p-12 text-center text-neutral-400">Carregando OS...</div>
          )}
          {isError && (
            <div className="p-12 text-center text-red-400">
              Erro ao carregar OS. Tenta de novo.
            </div>
          )}
          {!isLoading && !isError && filtradas.length === 0 && (
            <div className="p-12 text-center text-neutral-400">
              Nenhuma OS encontrada.
            </div>
          )}
          {!isLoading && !isError && filtradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-950/50 text-neutral-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Código GRV</th>
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">Artigo</th>
                    <th className="px-4 py-3 text-center font-medium">Qtd</th>
                    <th className="px-4 py-3 text-left font-medium">Prazo</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-center font-medium">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filtradas.map((os) => (
                    <OSRow
                      key={os.id}
                      os={os}
                      onClick={() => navigate(`/os/${os.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {criando && (
        <NovaOSModal
          onClose={() => setCriando(false)}
          onCreated={(id) => {
            setCriando(false);
            navigate(`/os/${id}`);
          }}
        />
      )}
    </div>
  );
}

function OSRow({ os, onClick }: { os: OS; onClick: () => void }) {
  const dias = diasAtePrazo(os.prazoEntrega);
  const isUrgente = os.prioridade === 'urgente';

  return (
    <tr
      onClick={onClick}
      className="hover:bg-neutral-800/50 cursor-pointer transition"
    >
      <td className="px-4 py-3 font-mono text-sm">
        <div className="flex items-center gap-2">
          {isUrgente && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 text-xs font-bold">
              !
            </span>
          )}
          <span className="text-forja-400">{os.codigoGrv}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-300">{os.cliente?.nome ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="text-neutral-100 font-medium">
          {os.artigo?.codigo ?? '—'}
        </div>
        <div className="text-xs text-neutral-500">{os.artigo?.descricao ?? ''}</div>
      </td>
      <td className="px-4 py-3 text-center font-mono">{os.quantidadeTotal}</td>
      <td className={`px-4 py-3 font-medium ${corPrazo(os.prazoEntrega, os.status)}`}>
        <div>{formatarPrazo(os.prazoEntrega)}</div>
        {dias >= 0 && os.status !== 'finalizada' && os.status !== 'cancelada' && (
          <div className="text-xs opacity-75">em {dias} dias</div>
        )}
        {dias < 0 && os.status !== 'finalizada' && os.status !== 'cancelada' && (
          <div className="text-xs opacity-75">{Math.abs(dias)} dias atrasada</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded border ${CORES_STATUS_OS[os.status]}`}
        >
          {LABELS_STATUS_OS[os.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-neutral-300">
        {formatarMoeda(os.valorTotal)}
      </td>
      <td className="px-4 py-3 text-center">
        {os.observacoes && <ObservacaoBadge texto={os.observacoes} />}
      </td>
    </tr>
  );
}
