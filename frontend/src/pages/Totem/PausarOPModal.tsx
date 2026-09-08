// ============================================================
// Forja - Tótem: Modal de Pausar OP
// Operador escolhe o motivo da parada antes de pausar a máquina
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { usePausarOP } from '../../hooks/useOPLote';
import { useMotivosParadaList } from '../../hooks/useMotivosParada';

interface Props {
  opLoteId: string;
  codigoOp: string;
  onClose: () => void;
}

export function PausarOPModal({ opLoteId, codigoOp, onClose }: Props) {
  const [motivoParadaId, setMotivoParadaId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const motivoRef = useRef<HTMLSelectElement>(null);

  const { data: motivos } = useMotivosParadaList({ ativo: true });
  const pausar = usePausarOP();

  useEffect(() => {
    setTimeout(() => motivoRef.current?.focus(), 50);
  }, []);

  async function handleSubmit() {
    setErro(null);
    if (!motivoParadaId) {
      setErro('Selecione o motivo da parada');
      return;
    }

    try {
      await pausar.mutateAsync({
        opLoteId,
        input: { motivoParadaId, observacoes: observacoes.trim() || null },
      });
      toast.sucesso('OP pausada.');
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? 'Erro ao pausar OP. Tente novamente.';
      setErro(msg);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pausar OP ${codigoOp}`}
      size="md"
      forcarEscuro
      footer={
        <>
          <button onClick={onClose} className="btn-ghost px-4 py-2">
            Cancelar (Esc)
          </button>
          <button
            onClick={handleSubmit}
            disabled={pausar.isPending}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {pausar.isPending ? 'Pausando...' : 'Pausar (Enter)'}
          </button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        <div>
          <label className="label-compact">Motivo da parada</label>
          <select
            ref={motivoRef}
            value={motivoParadaId}
            onChange={(e) => setMotivoParadaId(e.target.value)}
            className="input py-2 text-base"
          >
            <option value="">Selecione...</option>
            {motivos?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.planejado ? ' (planejada)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-compact">Observações (opcional)</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: aguardando peça de reposição..."
            className="input py-2 text-sm resize-none"
          />
        </div>

        {erro && <div className="error-message">{erro}</div>}
      </div>
    </Modal>
  );
}
