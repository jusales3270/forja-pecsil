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

import { isOperacaoEngenharia } from './TotemEstacaoPage';

interface Props {
  op: OPLoteEmAndamento;
  onClose: () => void;
}

export function EncerrarOPModal({ op, onClose }: Props) {
  const isEng = isOperacaoEngenharia(op);
  const total = op.lote.quantidadePecas;
  const [quantidade, setQuantidade] = useState<string>(String(total));
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const carimbo = op.carimbos[0];
  const encerrar = useEncerrarOP();

  useEffect(() => {
    if (!isEng) {
      setTimeout(() => {
        qtdRef.current?.focus();
        qtdRef.current?.select();
      }, 50);
    }
  }, [isEng]);

  async function handleSubmit() {
    setErro(null);
    const q = isEng ? total : Number.parseInt(quantidade, 10);
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
          observacoes: observacoes.trim()
            ? (isEng ? `[Programa CNC] ${observacoes.trim()}` : observacoes.trim())
            : (isEng ? 'Programa CNC concluído e liberado pela Engenharia' : null),
        },
      });

      if (isEng) {
        toast.sucesso(`✓ Programa da OP ${op.codigoOp} concluído e liberado para usinagem!`);
      } else {
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
      title={
        isEng
          ? `Concluir Programa da OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`
          : `Encerrar OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`
      }
      size="lg"
      forcarEscuro
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
            disabled={encerrar.isPending}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition"
          >
            {encerrar.isPending
              ? 'Concluindo...'
              : isEng
                ? `✓ Programa OP ${op.codigoOp} OK (Enter)`
                : 'Encerrar (Enter)'}
          </button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {/* Resumo */}
        <div className="subcard p-3 text-sm space-y-1">
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
              {carimbo.maquina && (
                <div className="text-neutral-300">
                  <span className="text-neutral-500">
                    {isEng ? 'Estação / Computador:' : 'Máquina:'}
                  </span>{' '}
                  {carimbo.maquina.nome}
                </div>
              )}
              {carimbo.operadorResponsavel && (
                <div className="text-neutral-300">
                  <span className="text-neutral-500">
                    {isEng ? 'Programador:' : 'Operador:'}
                  </span>{' '}
                  {carimbo.operadorResponsavel.nome}
                </div>
              )}
              <div className="text-amber-400 text-xs">
                Aberta há {tempoDesde(carimbo.timestampEntrada)}
              </div>
            </>
          )}
        </div>

        {/* Quantidade concluída ou Liberação de Programa */}
        {isEng ? (
          <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm mb-1">
              <span>💻</span>
              <span>Liberação do programa CNC para usinagem</span>
            </div>
            <div className="text-xs text-neutral-400">
              Esta confirmação atesta que o programa da OP {op.codigoOp} foi elaborado e está pronto para o lote de {total} peças.
            </div>
          </div>
        ) : (
          <div>
            <label className="label-compact">
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
                className="input w-32 py-2 text-2xl font-mono text-right"
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
        )}

        {/* Observações */}
        <div>
          <label className="label-compact">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder={
              isEng
                ? 'Ex: Nº do programa CAM, nome do arquivo ou anotações...'
                : 'Ex: parou pra trocar pastilha, retomar amanhã...'
            }
            className="input py-2 text-sm resize-none"
          />
        </div>

        {erro && <div className="error-message">{erro}</div>}
      </div>
    </Modal>
  );
}
