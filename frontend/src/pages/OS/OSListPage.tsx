// ============================================================
// Forja - Lista de OS (Ordens de Serviço)
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../lib/theme-store';
import { useAuth } from '../../lib/auth-store';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  useOSList,
  useCancelarOS,
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
import { temCapacidade } from '../../lib/permissions';

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
  const { claro } = useTheme();
  const pessoa = useAuth((s) => s.pessoa);
  const ehAdmin = temCapacidade(pessoa, 'excluir_dados');

  const [busca, setBusca] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [criando, setCriando] = useState(false);
  const [osParaExcluir, setOsParaExcluir] = useState<OS | null>(null);

  const cancelarOS = useCancelarOS();

  const { data: clientesData } = useClientes();
  const clientes = clientesData ?? [];

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

  // Paleta por tema
  const T = claro
    ? {
        bg: 'bg-slate-100',
        texto: 'text-slate-900',
        sub: 'text-slate-500',
        voltarBtn: 'text-slate-500 hover:text-slate-900',
        titulo: 'text-forja-600',
        tituloSub: 'text-slate-500',
        filtrosBg: 'bg-white border-slate-200',
        filtroBg: 'bg-slate-50 border-slate-200 text-slate-900',
        filtroLabel: 'text-slate-500',
        resumoBg: 'bg-white border-slate-200',
        resumoLabel: 'text-slate-500',
        resumoValor: 'text-slate-900',
        tabelaBg: 'bg-white border-slate-200',
        tabelaHeader: 'bg-slate-50 text-slate-500',
        tabelaDivide: 'divide-slate-200',
        tabelaHover: 'hover:bg-slate-50',
        tabelaTexto: 'text-slate-800',
        tabelaSub: 'text-slate-500',
        monoTexto: 'text-slate-900',
        forjaTexto: 'text-forja-600',
      }
    : {
        bg: 'bg-neutral-950',
        texto: 'text-neutral-100',
        sub: 'text-neutral-500',
        voltarBtn: 'text-neutral-400 hover:text-neutral-100',
        titulo: 'text-forja-50',
        tituloSub: 'text-neutral-400',
        filtrosBg: 'bg-neutral-900 border-neutral-800',
        filtroBg: 'bg-neutral-800 border-neutral-700 text-sm',
        filtroLabel: 'text-neutral-400',
        resumoBg: 'bg-neutral-900 border-neutral-800',
        resumoLabel: 'text-neutral-400',
        resumoValor: 'text-neutral-100',
        tabelaBg: 'bg-neutral-900 border-neutral-800',
        tabelaHeader: 'bg-neutral-950/50 text-neutral-400',
        tabelaDivide: 'divide-neutral-800',
        tabelaHover: 'hover:bg-neutral-800/50',
        tabelaTexto: 'text-neutral-300',
        tabelaSub: 'text-neutral-500',
        monoTexto: 'text-neutral-100',
        forjaTexto: 'text-forja-400',
      };

  return (
    <div className={`min-h-screen ${T.bg} ${T.texto} ${claro ? 'theme-light' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          className={`text-sm transition-colors mb-3 flex items-center gap-1 ${T.voltarBtn}`}
        >
          <span className="text-base leading-none">←</span> Voltar para o início
        </button>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${T.titulo}`}>Ordens de Serviço</h1>
            <p className={`mt-1 ${T.tituloSub}`}>
              Gerencie as OS abertas, em produção e finalizadas.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        {/* Filtros */}
        <div className={`border rounded-xl p-4 mb-6 ${T.filtrosBg}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs font-medium uppercase tracking-wide mb-1 ${T.filtroLabel}`}>
                Buscar
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código GRV, artigo..."
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-forja-500 focus:outline-none ${T.filtroBg}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium uppercase tracking-wide mb-1 ${T.filtroLabel}`}>
                Cliente
              </label>
              <select
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-forja-500 focus:outline-none ${T.filtroBg}`}
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
              <label className={`block text-xs font-medium uppercase tracking-wide mb-1 ${T.filtroLabel}`}>
                Status
              </label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:border-forja-500 focus:outline-none ${T.filtroBg}`}
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
            <div className={`border rounded-xl p-4 ${T.resumoBg}`}>
              <div className={`text-xs uppercase tracking-wide ${T.resumoLabel}`}>
                Total de OS
              </div>
              <div className={`text-2xl font-bold mt-1 ${T.resumoValor}`}>{filtradas.length}</div>
            </div>
            <div className={`border rounded-xl p-4 ${T.resumoBg}`}>
              <div className={`text-xs uppercase tracking-wide ${T.resumoLabel}`}>
                Em produção
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-400">
                {filtradas.filter((o) => o.status === 'em_producao').length}
              </div>
            </div>
            <div className={`border rounded-xl p-4 ${T.resumoBg}`}>
              <div className={`text-xs uppercase tracking-wide ${T.resumoLabel}`}>
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
            <div className={`border rounded-xl p-4 ${T.resumoBg}`}>
              <div className={`text-xs uppercase tracking-wide ${T.resumoLabel}`}>
                Valor total
              </div>
              <div className="text-2xl font-bold mt-1 text-forja-400">
                {formatarMoeda(totalGeral)}
              </div>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className={`border rounded-xl overflow-hidden ${T.tabelaBg}`}>
          {isLoading && (
            <div className={`p-12 text-center ${T.sub}`}>Carregando OS...</div>
          )}
          {isError && (
            <div className="p-12 text-center text-red-400">
              Erro ao carregar OS. Tenta de novo.
            </div>
          )}
          {!isLoading && !isError && filtradas.length === 0 && (
            <div className={`p-12 text-center ${T.sub}`}>
              Nenhuma OS encontrada.
            </div>
          )}
          {!isLoading && !isError && filtradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`${T.tabelaHeader} text-xs uppercase tracking-wide`}>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Código GRV</th>
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">Artigo</th>
                    <th className="px-4 py-3 text-center font-medium">Qtd</th>
                    <th className="px-4 py-3 text-left font-medium">Prazo</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-center font-medium">Obs</th>
                    {ehAdmin && (
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className={T.tabelaDivide}>
                  {filtradas.map((os) => (
                    <OSRow
                      key={os.id}
                      os={os}
                      ehAdmin={ehAdmin}
                      onExcluir={(item) => setOsParaExcluir(item)}
                      onClick={() => navigate(`/os/${os.id}`)}
                      T={T}
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

      {/* Confirmação de Exclusão da OS */}
      <ConfirmDialog
        open={osParaExcluir !== null}
        title={`Excluir OS ${osParaExcluir?.codigoGrv ?? ''}`}
        message={
          osParaExcluir?.status === 'cancelada'
            ? `Esta OS já está cancelada. Deseja excluí-la definitivamente do banco de dados? Todos os lotes, OPs e registros vinculados serão apagados permanentemente.`
            : `Tem certeza que deseja cancelar e excluir a Ordem de Serviço "${osParaExcluir?.codigoGrv}"? Esta ação só pode ser realizada pelo Administrador.`
        }
        confirmLabel={osParaExcluir?.status === 'cancelada' ? 'Excluir Definitivamente' : 'Excluir / Cancelar'}
        loading={cancelarOS.isPending}
        onConfirm={async () => {
          if (!osParaExcluir) return;
          try {
            await cancelarOS.mutateAsync({
              id: osParaExcluir.id,
              force: osParaExcluir.status === 'cancelada',
            });
            setOsParaExcluir(null);
          } catch (err: any) {
            alert(err?.response?.data?.message || 'Erro ao excluir OS');
          }
        }}
        onCancel={() => setOsParaExcluir(null)}
      />
    </div>
  );
}

function OSRow({
  os,
  onClick,
  ehAdmin,
  onExcluir,
  T,
}: {
  os: OS;
  onClick: () => void;
  ehAdmin: boolean;
  onExcluir: (os: OS) => void;
  T: Record<string, string>;
}) {
  const dias = diasAtePrazo(os.prazoEntrega);
  const isUrgente = os.prioridade === 'urgente';

  return (
    <tr
      onClick={onClick}
      className={`${T.tabelaHover} cursor-pointer transition`}
    >
      <td className="px-4 py-3 font-mono text-sm">
        <div className="flex items-center gap-2">
          {isUrgente && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 text-xs font-bold">
              !
            </span>
          )}
          <span className={T.forjaTexto}>{os.codigoGrv}</span>
        </div>
      </td>
      <td className={`px-4 py-3 ${T.tabelaTexto}`}>{os.cliente?.nome ?? '—'}</td>
      <td className="px-4 py-3">
        <div className={`font-medium ${T.monoTexto}`}>
          {os.artigo?.codigo ?? '—'}
        </div>
        <div className={`text-xs ${T.tabelaSub}`}>{os.artigo?.descricao ?? ''}</div>
      </td>
      <td className={`px-4 py-3 text-center font-mono ${T.monoTexto}`}>{os.quantidadeTotal}</td>
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
      <td className={`px-4 py-3 text-right font-mono ${T.tabelaTexto}`}>
        {formatarMoeda(os.valorTotal)}
      </td>
      <td className="px-4 py-3 text-center">
        {os.observacoes && <ObservacaoBadge texto={os.observacoes} />}
      </td>
      {ehAdmin && (
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onExcluir(os)}
            className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:text-red-300"
            title="Excluir Ordem de Serviço"
          >
            Excluir
          </button>
        </td>
      )}
    </tr>
  );
}
