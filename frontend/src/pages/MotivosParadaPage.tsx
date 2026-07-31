// ============================================================
// Forja - Página de Motivos de Parada
// CRUD via modal, usando React Query
// ============================================================

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useTheme } from '../lib/theme-store';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  useMotivosParadaList,
  useCreateMotivoParada,
  useUpdateMotivoParada,
  useDeleteMotivoParada,
  type MotivoParada,
} from '../hooks/useMotivosParada';

export function MotivosParadaPage() {
  const { claro } = useTheme();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<MotivoParada | null>(null);
  const [criando, setCriando] = useState(false);
  const [deletando, setDeletando] = useState<MotivoParada | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { data: motivos, isLoading, isError } = useMotivosParadaList(mostrarInativos ? undefined : { ativo: true });
  const deleteMut = useDeleteMotivoParada();

  const motivosFiltrados = useMemo(() => {
    if (!motivos) return [];
    if (!busca.trim()) return motivos;
    const termo = busca.toLowerCase();
    return motivos.filter((m) => m.nome.toLowerCase().includes(termo));
  }, [motivos, busca]);

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
    <AppLayout title="Motivos de Parada" voltarPara="/">
      <div className="space-y-6">
        {/* Barra de ações */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <input
            type="text"
            placeholder="Buscar por nome..."
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
            + Novo Motivo de Parada
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
            Não foi possível carregar os Motivos de Parada.
          </div>
        )}

        {!isLoading && !isError && motivosFiltrados.length === 0 && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>
            {busca ? (
              <>Nenhum motivo encontrado para "{busca}".</>
            ) : (
              <>
                Nenhum Motivo de Parada cadastrado ainda. Clique em "Novo" para
                começar.
              </>
            )}
          </div>
        )}

        {!isLoading && motivosFiltrados.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-50 text-slate-500' : 'bg-neutral-950 text-neutral-400'}`}>
                <tr>
                  <th className="text-left px-4 py-3 w-20">Código</th>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Planejada</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${claro ? 'divide-slate-200' : 'divide-neutral-800'}`}>
                {motivosFiltrados.map((m) => (
                  <tr key={m.id} className={claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/30'}>
                    <td className={`px-4 py-3 font-mono ${claro ? 'text-slate-500' : 'text-neutral-400'}`}>
                      {m.codigo ?? '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>
                      {m.nome}
                    </td>
                    <td className="px-4 py-3">
                      {m.planejado ? (
                        <span className="badge-forja">Sim</span>
                      ) : (
                        <span className="badge-neutral">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.ativo ? (
                        <span className="badge-forja">Ativo</span>
                      ) : (
                        <span className="badge-neutral">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditando(m)}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletando(m)}
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
      <MotivoParadaModal
        open={criando || editando !== null}
        motivo={editando}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      {/* Confirmação de delete */}
      <ConfirmDialog
        open={deletando !== null}
        title="Desativar Motivo de Parada"
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

interface MotivoParadaModalProps {
  open: boolean;
  motivo: MotivoParada | null;
  onClose: () => void;
}

function MotivoParadaModal({ open, motivo, onClose }: MotivoParadaModalProps) {
  const ehEdicao = motivo !== null;

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [planejado, setPlanejado] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const createMut = useCreateMotivoParada();
  const updateMut = useUpdateMotivoParada();

  useEffect(() => {
    if (open) {
      setCodigo(motivo?.codigo != null ? String(motivo.codigo) : '');
      setNome(motivo?.nome ?? '');
      setPlanejado(motivo?.planejado ?? false);
      setAtivo(motivo?.ativo ?? true);
      setErro(null);
    }
  }, [open, motivo]);

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }
    let codigoNum: number | null = null;
    if (codigo.trim()) {
      codigoNum = parseInt(codigo, 10);
      if (isNaN(codigoNum) || codigoNum <= 0) {
        setErro('Código deve ser um número inteiro positivo');
        return;
      }
    }

    try {
      if (ehEdicao && motivo) {
        await updateMut.mutateAsync({
          id: motivo.id,
          input: {
            codigo: codigoNum,
            nome: nome.trim(),
            planejado,
            ativo,
          },
        });
      } else {
        await createMut.mutateAsync({
          codigo: codigoNum,
          nome: nome.trim(),
          planejado,
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
      title={ehEdicao ? 'Editar Motivo de Parada' : 'Novo Motivo de Parada'}
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
            form="motivo-parada-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="motivo-parada-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div>
          <label className="label">Código</label>
          <input
            type="number"
            min="1"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="input"
            placeholder="Ex: 3 (opcional — referência do sistema legado)"
          />
        </div>

        <div>
          <label className="label">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input"
            placeholder="Ex: QUEBRA DE MÁQUINA"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="planejado"
            type="checkbox"
            checked={planejado}
            onChange={(e) => setPlanejado(e.target.checked)}
            className="w-4 h-4 accent-forja-500"
          />
          <label htmlFor="planejado" className="text-sm text-neutral-300">
            Parada planejada (ex: setup, troca de ferramenta — não é um problema)
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
      </form>
    </Modal>
  );
}
