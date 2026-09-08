// ============================================================
// Forja - Página de Tolerâncias Gerais por Cliente
// Seletor de cliente no topo, CRUD via modal
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { useTheme } from '../lib/theme-store';
import { AppLayout } from '../components/AppLayout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useClientesList } from '../hooks/useClientes';
import {
  useToleranciasGeraisList,
  useCreateToleranciaGeral,
  useUpdateToleranciaGeral,
  useDeleteToleranciaGeral,
  type ToleranciaGeral,
} from '../hooks/useToleranciasGerais';
import { useAuth } from '../lib/auth-store';

export function ToleranciasPage() {
  const { claro } = useTheme();
  const pessoa = useAuth((s) => s.pessoa);
  const ehAdmin = pessoa?.papel === 'admin';
  const [clienteId, setClienteId] = useState<string>('');
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<ToleranciaGeral | null>(null);
  const [deletando, setDeletando] = useState<ToleranciaGeral | null>(null);

  const { data: clientes, isLoading: clientesLoading } = useClientesList();
  const {
    data: tolerancias,
    isLoading,
    isError,
  } = useToleranciasGeraisList(clienteId || null);
  const deleteMut = useDeleteToleranciaGeral(clienteId);

  // Auto-seleciona o primeiro cliente quando carrega
  useEffect(() => {
    if (!clienteId && clientes && clientes.length > 0) {
      setClienteId(clientes[0].id);
    }
  }, [clientes, clienteId]);

  const clienteSelecionado = clientes?.find((c) => c.id === clienteId);

  const handleConfirmarDelete = async () => {
    if (!deletando) return;
    try {
      await deleteMut.mutateAsync(deletando.id);
      setDeletando(null);
    } catch (err) {
      // erro fica em deleteMut.isError
    }
  };

  return (
    <AppLayout title="Tolerâncias Gerais por Cliente" voltarPara="/">
      <div className="space-y-6">
        {/* Seletor de cliente */}
        <div className="card">
          <label className="label">Cliente</label>
          <div className="flex gap-3 items-center">
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input max-w-md"
              disabled={clientesLoading}
            >
              <option value="">
                {clientesLoading ? 'Carregando...' : 'Selecione um cliente'}
              </option>
              {clientes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {clienteId && (
              <button
                onClick={() => setCriando(true)}
                className="btn-primary px-5 py-3 ml-auto"
              >
                + Nova Tolerância
              </button>
            )}
          </div>
        </div>

        {/* Erro de delete */}
        {deleteMut.isError && (
          <div className="error-message">
            Erro ao deletar:{' '}
            {(deleteMut.error as any)?.response?.data?.message ??
              'Tente novamente.'}
          </div>
        )}

        {/* Estado: nenhum cliente selecionado */}
        {!clienteId && !clientesLoading && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>
            Selecione um cliente acima para ver suas tolerâncias.
          </div>
        )}

        {/* Estado: carregando tolerâncias */}
        {clienteId && isLoading && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>Carregando...</div>
        )}

        {/* Estado: erro ao carregar */}
        {clienteId && isError && (
          <div className="error-message">
            Não foi possível carregar as tolerâncias deste cliente.
          </div>
        )}

        {/* Estado: vazio */}
        {clienteId && !isLoading && !isError && tolerancias?.length === 0 && (
          <div className={`card text-center ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>
            Nenhuma tolerância cadastrada para{' '}
            <strong className={claro ? 'text-slate-700' : 'text-neutral-200'}>
              {clienteSelecionado?.nome}
            </strong>
            . Clique em "Nova Tolerância" para começar.
          </div>
        )}

        {/* Tabela */}
        {clienteId && !isLoading && tolerancias && tolerancias.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className={`text-xs uppercase tracking-wide ${claro ? 'bg-slate-50 text-slate-500' : 'bg-neutral-950 text-neutral-400'}`}>
                <tr>
                  <th className="text-left px-4 py-3">Faixa (mm)</th>
                  <th className="text-left px-4 py-3">Tolerância +</th>
                  <th className="text-left px-4 py-3">Tolerância −</th>
                  <th className="text-left px-4 py-3">Observações</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${claro ? 'divide-slate-200' : 'divide-neutral-800'}`}>
                {tolerancias.map((t) => (
                  <tr key={t.id} className={claro ? 'hover:bg-slate-50' : 'hover:bg-neutral-800/30'}>
                    <td className={`px-4 py-3 font-medium ${claro ? 'text-slate-900' : 'text-neutral-100'}`}>
                      {t.faixaMin} → {t.faixaMax}
                    </td>
                    <td className={`px-4 py-3 ${claro ? 'text-slate-600' : 'text-neutral-300'}`}>
                      +{t.toleranciaMais}
                    </td>
                    <td className={`px-4 py-3 ${claro ? 'text-slate-600' : 'text-neutral-300'}`}>
                      −{t.toleranciaMenos}
                    </td>
                    <td className={`px-4 py-3 text-xs ${claro ? 'text-slate-400' : 'text-neutral-400'}`}>
                      {t.observacoes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditando(t)}
                        className="btn-ghost px-3 py-1.5 text-xs mr-1"
                      >
                        Editar
                      </button>
                      {ehAdmin && (
                        <button
                          onClick={() => setDeletando(t)}
                          className="btn px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-200"
                        >
                          Deletar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de criar/editar */}
      <ToleranciaModal
        open={criando || editando !== null}
        clienteId={clienteId}
        tolerancia={editando}
        onClose={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      {/* Confirmação de delete */}
      <ConfirmDialog
        open={deletando !== null}
        title="Deletar Tolerância"
        message={
          deletando
            ? `Tem certeza que deseja deletar a tolerância para a faixa ${deletando.faixaMin} → ${deletando.faixaMax}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Deletar"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmarDelete}
        onCancel={() => setDeletando(null)}
      />
    </AppLayout>
  );
}

// ============================================================
// Modal de criar/editar
// ============================================================

interface ToleranciaModalProps {
  open: boolean;
  clienteId: string;
  tolerancia: ToleranciaGeral | null;
  onClose: () => void;
}

function ToleranciaModal({
  open,
  clienteId,
  tolerancia,
  onClose,
}: ToleranciaModalProps) {
  const ehEdicao = tolerancia !== null;

  const [faixaMin, setFaixaMin] = useState('');
  const [faixaMax, setFaixaMax] = useState('');
  const [toleranciaMais, setToleranciaMais] = useState('');
  const [toleranciaMenos, setToleranciaMenos] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const createMut = useCreateToleranciaGeral(clienteId);
  const updateMut = useUpdateToleranciaGeral(clienteId);

  useEffect(() => {
    if (open) {
      setFaixaMin(tolerancia?.faixaMin?.toString() ?? '');
      setFaixaMax(tolerancia?.faixaMax?.toString() ?? '');
      setToleranciaMais(tolerancia?.toleranciaMais?.toString() ?? '');
      setToleranciaMenos(tolerancia?.toleranciaMenos?.toString() ?? '');
      setObservacoes(tolerancia?.observacoes ?? '');
      setErro(null);
    }
  }, [open, tolerancia]);

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    const min = parseFloat(faixaMin);
    const max = parseFloat(faixaMax);
    const tMais = parseFloat(toleranciaMais);
    const tMenos = parseFloat(toleranciaMenos);

    if (isNaN(min) || isNaN(max) || isNaN(tMais) || isNaN(tMenos)) {
      setErro('Todos os campos numéricos são obrigatórios');
      return;
    }
    if (max <= min) {
      setErro('faixaMax deve ser maior que faixaMin');
      return;
    }
    if (tMais < 0 || tMenos < 0) {
      setErro('Tolerâncias devem ser ≥ 0');
      return;
    }

    try {
      const payload = {
        faixaMin: min,
        faixaMax: max,
        toleranciaMais: tMais,
        toleranciaMenos: tMenos,
        observacoes: observacoes.trim() || null,
      };

      if (ehEdicao && tolerancia) {
        await updateMut.mutateAsync({ id: tolerancia.id, input: payload });
      } else {
        await createMut.mutateAsync(payload);
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
      title={ehEdicao ? 'Editar Tolerância' : 'Nova Tolerância'}
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
            form="tolerancia-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="tolerancia-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Faixa mínima (mm) *</label>
            <input
              type="number"
              step="0.001"
              value={faixaMin}
              onChange={(e) => setFaixaMin(e.target.value)}
              className="input"
              placeholder="Ex: 0"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Faixa máxima (mm) *</label>
            <input
              type="number"
              step="0.001"
              value={faixaMax}
              onChange={(e) => setFaixaMax(e.target.value)}
              className="input"
              placeholder="Ex: 50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tolerância + (mm) *</label>
            <input
              type="number"
              step="0.001"
              value={toleranciaMais}
              onChange={(e) => setToleranciaMais(e.target.value)}
              className="input"
              placeholder="Ex: 0.05"
            />
          </div>
          <div>
            <label className="label">Tolerância − (mm) *</label>
            <input
              type="number"
              step="0.001"
              value={toleranciaMenos}
              onChange={(e) => setToleranciaMenos(e.target.value)}
              className="input"
              placeholder="Ex: 0.05"
            />
          </div>
        </div>

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
