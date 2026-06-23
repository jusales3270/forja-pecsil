// ============================================================
// Forja - Página de Tipos de Serviço
// CRUD via modal, usando React Query
// ============================================================

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useTheme } from '../lib/theme-store';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  useTiposServicoList,
  useCreateTipoServico,
  useUpdateTipoServico,
  useDeleteTipoServico,
  type TipoServico,
} from '../hooks/useTiposServico';
import { useEtapasList } from '../hooks/useEtapas';

export function TiposServicoPage() {
  const { claro } = useTheme();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<TipoServico | null>(null);
  const [criando, setCriando] = useState(false);
  const [deletando, setDeletando] = useState<TipoServico | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { data: tipos, isLoading, isError } = useTiposServicoList(mostrarInativos ? undefined : { ativo: true });
  const deleteMut = useDeleteTipoServico();

  const tiposFiltrados = useMemo(() => {
    if (!tipos) return [];
    if (!busca.trim()) return tipos;
    const termo = busca.toLowerCase();
    return tipos.filter(
      (t) =>
        t.nome.toLowerCase().includes(termo) ||
        t.etapa?.nome.toLowerCase().includes(termo)
    );
  }, [tipos, busca]);

  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    try {
      await deleteMut.mutateAsync(deletando.id);
      setDeletando(null);
    } catch (err) {
      // Erro fica visível via deleteMut.isError
    }
  };

  return (
    <AppLayout title="Tipos de Serviço" voltarPara="/">
      <div className="space-y-6">
        {/* Barra de ações */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <input
            type="text"
            placeholder="Buscar por nome ou etapa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input max-w-md"
          />
          <label className={`flex items-center gap-2 text-sm select-none cursor-pointer ${claro ? 'text-slate-600' : 'text-neutral-300'}`}>
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="w-4 h-4 accent-forja-500"
            />
            Mostrar inativos
          </label>
          <button onClick={() => setCriando(true)} className="btn-primary px-5 py-3">
            + Novo Tipo de Serviço
          </button>
        </div>

        {/* Erro de delete (banner) */}
        {deleteMut.isError && (
          <div className="error-message">
            Erro ao deletar:{' '}
            {(deleteMut.error as any)?.response?.data?.message ??
              'Tente novamente.'}
          </div>
        )}

        {/* Conteúdo */}
        {isLoading && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>Carregando...</div>
        )}

        {isError && (
          <div className="error-message">
            Não foi possível carregar os Tipos de Serviço.
          </div>
        )}

        {!isLoading && !isError && tiposFiltrados.length === 0 && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>
            {busca ? (
              <>Nenhum tipo encontrado para "{busca}".</>
            ) : (
              <>
                Nenhum Tipo de Serviço cadastrado ainda. Clique em "Novo" para
                começar.
              </>
            )}
          </div>
        )}

        {!isLoading && tiposFiltrados.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-50 text-slate-500' : 'bg-neutral-950 text-neutral-400'}`}>
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-left px-4 py-3">Exige Inspeção</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${claro ? 'divide-slate-200' : 'divide-neutral-800'}`}>
                {tiposFiltrados.map((t) => (
                  <tr key={t.id} className={claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/30'}>
                    <td className={`px-4 py-3 font-medium ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>
                      {t.nome}
                    </td>
                    <td className={`px-4 py-3 ${claro ? 'text-slate-600' : 'text-neutral-300'}`}>
                      {t.etapa?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {t.exigeInspecao ? (
                        <span className="badge-forja">Sim</span>
                      ) : (
                        <span className="badge-neutral">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.ativo ? (
                        <span className="badge-forja">Ativo</span>
                      ) : (
                        <span className="badge-neutral">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditando(t)}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletando(t)}
                        className={`btn px-3 py-1.5 text-xs ${claro ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'}`}
                      >
                        Desativar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <TipoServicoModal
        open={criando || editando !== null}
        tipo={editando}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      {/* Confirmação de delete */}
      <ConfirmDialog
        open={deletando !== null}
        title="Desativar Tipo de Serviço"
        message={
          deletando
            ? `Tem certeza que deseja desativar "${deletando.nome}"? O item ficará oculto da lista mas pode ser reativado depois marcando "Mostrar inativos".`
            : ''
        }
        confirmLabel="Desativar"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmarDelete}
        onCancel={() => setDeletando(null)}
      />
    </AppLayout>
  );
}

// ============================================================
// Modal de criar/editar (interno à página)
// ============================================================

interface TipoServicoModalProps {
  open: boolean;
  tipo: TipoServico | null;
  onClose: () => void;
}

function TipoServicoModal({ open, tipo, onClose }: TipoServicoModalProps) {
  const ehEdicao = tipo !== null;

  const [nome, setNome] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [exigeInspecao, setExigeInspecao] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: etapas, isLoading: etapasLoading } = useEtapasList();
  const createMut = useCreateTipoServico();
  const updateMut = useUpdateTipoServico();

  // Reset quando muda o tipo ou abre/fecha (sincroniza props -> state)

  useEffect(() => {
    if (open) {
      setNome(tipo?.nome ?? '');
      setEtapaId(tipo?.etapaId ?? '');
      setExigeInspecao(tipo?.exigeInspecao ?? false);
      setAtivo(tipo?.ativo ?? true);
      setObservacoes(tipo?.observacoes ?? '');
      setErro(null);
    }
  }, [open, tipo]);

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }
    if (!etapaId) {
      setErro('Etapa é obrigatória');
      return;
    }

    try {
      if (ehEdicao && tipo) {
        await updateMut.mutateAsync({
          id: tipo.id,
          input: {
            nome: nome.trim(),
            etapaId,
            exigeInspecao,
            ativo,
            observacoes: observacoes.trim() || null,
          },
        });
      } else {
        await createMut.mutateAsync({
          nome: nome.trim(),
          etapaId,
          exigeInspecao,
          observacoes: observacoes.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      const mensagem =
        err?.response?.data?.message ??
        err?.message ??
        'Erro ao salvar. Tente novamente.';
      setErro(mensagem);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar Tipo de Serviço' : 'Novo Tipo de Serviço'}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="tipo-servico-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="tipo-servico-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder="Ex: CÉLULA DE TORNEAMENTO LADO DIANTEIRO"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Etapa *</label>
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="input"
            disabled={etapasLoading}
          >
            <option value="">Selecione uma etapa...</option>
            {etapas?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="exige-inspecao"
            type="checkbox"
            checked={exigeInspecao}
            onChange={(e) => setExigeInspecao(e.target.checked)}
            className="w-4 h-4 accent-forja-500"
          />
          <label htmlFor="exige-inspecao" className="text-sm text-neutral-300 dark:text-neutral-300">
            Exige inspeção dimensional
          </label>
        </div>

        {ehEdicao && (
          <div className="flex items-center gap-3">
            <input
              id="ativo"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 accent-forja-500"
            />
            <label htmlFor="ativo" className="text-sm text-neutral-300">
              Ativo
            </label>
          </div>
        )}

        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input"
            rows={3}
            placeholder="Opcional"
          />
        </div>
      </form>
    </Modal>
  );
}
