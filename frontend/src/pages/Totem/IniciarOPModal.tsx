// ============================================================
// Forja - Tótem: Modal de Iniciar OP
// Programador escolhe máquina e operador antes de iniciar
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { useIniciarOP, type OPLotePendente } from '../../hooks/useOPLote';
import { useMaquinasList } from '../../hooks/useMaquinas';
import { usePessoasList } from '../../hooks/usePessoas';

interface Props {
  op: OPLotePendente;
  etapaId: string;
  onClose: () => void;
}

export function IniciarOPModal({ op, etapaId, onClose }: Props) {
  const [maquinaId, setMaquinaId] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const maquinaRef = useRef<HTMLSelectElement>(null);

  const { data: maquinasData } = useMaquinasList({ etapaId, ativa: true });
  const { data: pessoasData } = usePessoasList({ papel: 'operador', ativo: true });
  const maquinas = maquinasData?.data ?? [];
  const operadores = pessoasData?.data ?? [];

  const iniciar = useIniciarOP();

  useEffect(() => {
    setTimeout(() => maquinaRef.current?.focus(), 50);
  }, []);

  async function handleSubmit() {
    setErro(null);
    if (!maquinaId) {
      setErro('Selecione a máquina');
      return;
    }
    if (!operadorId) {
      setErro('Selecione o operador');
      return;
    }

    try {
      await iniciar.mutateAsync({
        opLoteId: op.id,
        input: {
          maquinaId,
          operadorId,
          observacoes: observacoes.trim() || null,
        },
      });
      toast.sucesso(`OP iniciada com sucesso.`);
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        'Erro ao iniciar OP. Tente novamente.';
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
      title={`Iniciar OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="btn-ghost px-4 py-2"
          >
            Cancelar (Esc)
          </button>
          <button
            onClick={handleSubmit}
            disabled={iniciar.isPending}
            className="px-5 py-2 bg-forja-500 hover:bg-forja-600 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {iniciar.isPending ? 'Iniciando...' : 'Iniciar (Enter)'}
          </button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {/* Resumo da OP */}
        <div className="subcard p-3 text-sm">
          <div className="text-neutral-100 font-medium">
            {op.lote.os.artigo.codigo}
          </div>
          <div className="text-xs text-neutral-500 mb-2">
            {op.lote.os.artigo.descricao}
          </div>
          <div className="text-neutral-300">
            <span className="text-neutral-500">Serviço:</span> {op.tipoServico}
          </div>
          <div className="text-neutral-300">
            <span className="text-neutral-500">Lote:</span> {op.lote.numeroLote} —{' '}
            {op.lote.quantidadePecas} peças
          </div>
          <div className="text-neutral-300">
            <span className="text-neutral-500">Cliente:</span>{' '}
            {op.lote.os.cliente.nome}
          </div>
        </div>

        {/* Máquina */}
        <div>
          <label className="label-compact">
            Máquina
          </label>
          <select
            ref={maquinaRef}
            value={maquinaId}
            onChange={(e) => setMaquinaId(e.target.value)}
            className="input py-2 text-base"
          >
            <option value="">Selecione...</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} ({m.codigoInterno})
              </option>
            ))}
          </select>
        </div>

        {/* Operador */}
        <div>
          <label className="label-compact">
            Operador responsável
          </label>
          <select
            value={operadorId}
            onChange={(e) => setOperadorId(e.target.value)}
            className="input py-2 text-base"
          >
            <option value="">Selecione...</option>
            {operadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.codigoPessoal})
              </option>
            ))}
          </select>
        </div>

        {/* Observações */}
        <div>
          <label className="label-compact">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: programação ajustada, ferramenta nova..."
            className="input py-2 text-sm resize-none"
          />
        </div>

        {/* Erro */}
        {erro && <div className="error-message">{erro}</div>}
      </div>
    </Modal>
  );
}
