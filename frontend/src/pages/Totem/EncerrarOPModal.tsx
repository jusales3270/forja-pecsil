// ============================================================
// Forja - Tótem: Modal de Encerrar OP
// Programador informa quantidade concluída e (opcional) observação
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import {
  useEncerrarOP,
  type OPLoteEmAndamento,
  tempoDesde,
} from '../../hooks/useOPLote';

interface Props {
  op: OPLoteEmAndamento;
  onClose: () => void;
}

export function EncerrarOPModal({ op, onClose }: Props) {
  const total = op.lote.quantidadePecas;
  const [quantidade, setQuantidade] = useState<string>(String(total));
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const carimbo = op.carimbos[0];
  const encerrar = useEncerrarOP();

  useEffect(() => {
    setTimeout(() => {
      qtdRef.current?.focus();
      qtdRef.current?.select();
    }, 50);
  }, []);

  async function handleSubmit() {
    setErro(null);
    const q = Number.parseInt(quantidade, 10);
    if (Number.isNaN(q) || q < 0) {
      setErro('Quantidade inválida');
      return;
    }
    if (q > total) {
      setErro(`Quantidade não pode passar de ${total} (tamanho do lote)`);
      return;
    }

    try {
      const res = await encerrar.mutateAsync({
        opLoteId: op.id,
        input: {
          quantidadeConcluida: q,
          observacoes: observacoes.trim() || null,
        },
      });

      // Toast contextual baseado no resultado
      const meta = res.meta;
      if (meta.completou && meta.novoStatus === 'aguardando_qualidade') {
        toast.aviso(`OP ${q}/${total} concluída — enviada pra inspeção de qualidade.`);
      } else if (meta.completou && meta.novoStatus === 'concluida' && meta.loteConcluido) {
        toast.sucesso(`OP encerrada (${q}/${total}). Lote inteiro concluído.`);
      } else if (meta.completou && meta.novoStatus === 'concluida') {
        toast.sucesso(`OP encerrada (${q}/${total}). Lote avançou pra próxima OP.`);
      } else {
        toast.info(`OP parcial: ${q}/${total} peças. OP volta pra fila pra continuar.`);
      }

      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        'Erro ao encerrar OP. Tente novamente.';
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
      title={`Encerrar OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`}
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
            disabled={encerrar.isPending}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {encerrar.isPending ? 'Encerrando...' : 'Encerrar (Enter)'}
          </button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {/* Resumo */}
        <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-3 text-sm space-y-1">
          <div className="text-neutral-100 font-medium">
            {op.lote.os.artigo.codigo}
          </div>
          <div className="text-xs text-neutral-500 mb-1">
            {op.lote.os.artigo.descricao}
          </div>
          <div className="text-neutral-300">
            <span className="text-neutral-500">Serviço:</span> {op.tipoServico}
          </div>
          {carimbo && (
            <>
              <div className="text-neutral-300">
                <span className="text-neutral-500">Máquina:</span>{' '}
                {carimbo.maquina.nome}
              </div>
              <div className="text-neutral-300">
                <span className="text-neutral-500">Operador:</span>{' '}
                {carimbo.operadorResponsavel.nome}
              </div>
              <div className="text-amber-400 text-xs">
                Aberta há {tempoDesde(carimbo.timestampEntrada)}
              </div>
            </>
          )}
        </div>

        {/* Quantidade concluída */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
            Quantidade concluída
          </label>
          <div className="flex items-baseline gap-3">
            <input
              ref={qtdRef}
              type="number"
              min={0}
              max={total}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-32 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-2xl font-mono text-right focus:border-forja-500 focus:outline-none"
            />
            <span className="text-neutral-500">de {total} peças</span>
          </div>
          {op.exigeInspecao && (
            <p className="text-xs text-purple-400 mt-2">
              Esta OP exige inspeção. Se completar 100%, ela vai pra fila de
              qualidade.
            </p>
          )}
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
            placeholder="Ex: parou pra trocar pastilha, retomar amanhã..."
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:border-forja-500 focus:outline-none resize-none"
          />
        </div>

        {erro && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
            {erro}
          </div>
        )}
      </div>
    </Modal>
  );
}
