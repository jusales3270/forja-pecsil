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
            className="px-4 py-2 text-neutral-300 hover:text-neutral-100 transition"
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
        <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-3 text-sm">
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
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Máquina
          </label>
          <select
            ref={maquinaRef}
            value={maquinaId}
            onChange={(e) => setMaquinaId(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-base focus:border-forja-500 focus:outline-none"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Operador responsável
          </label>
          <select
            value={operadorId}
            onChange={(e) => setOperadorId(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-base focus:border-forja-500 focus:outline-none"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: programação ajustada, ferramenta nova..."
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none resize-none"
          />
        </div>

        {/* Erro */}
        {erro && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
            {erro}
          </div>
        )}
      </div>
    </Modal>
  );
}
