// ============================================================
// Forja - Tótem: Modal de Iniciar OP
// Programador escolhe máquina e operador antes de iniciar.
// Duas exceções não ocupam máquina nem operador, e o modal se ajusta:
//   - terceirizada (rebarbação): a peça sai da fábrica; registra o envio
//   - espera (cura, resfriamento): é só o relógio correndo
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { useIniciarOP, type OPLotePendente } from '../../hooks/useOPLote';
import { useMaquinasList } from '../../hooks/useMaquinas';
import { usePessoasList } from '../../hooks/usePessoas';
import { useAuth } from '../../lib/auth-store';
import { isOperacaoEngenharia } from './TotemEstacaoPage';

interface Props {
  op: OPLotePendente;
  etapaId: string;
  onClose: () => void;
}

export function IniciarOPModal({ op, etapaId, onClose }: Props) {
  const isEng = isOperacaoEngenharia(op);
  const usuarioLogado = useAuth((s) => s.pessoa);
  const semMaquina = op.terceirizada || op.esperaHoras != null;
  const [maquinaId, setMaquinaId] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const maquinaRef = useRef<HTMLSelectElement>(null);

  const { data: maquinasData } = useMaquinasList({ etapaId, ativa: true });
  const { data: pessoasData } = usePessoasList({ ativo: true });
  const maquinas = maquinasData?.data ?? [];
  const operadores = (pessoasData?.data ?? []).filter((p) =>
    ['operador', 'programador', 'engenharia', 'pcp', 'admin', 'chefe', 'estacao'].includes(p.papel),
  );

  const iniciar = useIniciarOP();

  // Auto-seleciona máquina se houver apenas 1 na etapa
  useEffect(() => {
    if (!semMaquina && maquinas.length === 1 && !maquinaId) {
      setMaquinaId(maquinas[0].id);
    }
  }, [semMaquina, maquinas, maquinaId]);

  // Auto-seleciona operador se o usuário logado for compatível ou se houver só 1
  useEffect(() => {
    if (!operadorId && usuarioLogado && operadores.some((o) => o.id === usuarioLogado.id)) {
      setOperadorId(usuarioLogado.id);
    } else if (!operadorId && operadores.length === 1) {
      setOperadorId(operadores[0].id);
    }
  }, [operadores, operadorId, usuarioLogado]);

  useEffect(() => {
    if (!semMaquina) setTimeout(() => maquinaRef.current?.focus(), 50);
  }, [semMaquina]);

  async function handleSubmit() {
    setErro(null);
    if (!semMaquina) {
      if (!maquinaId) {
        setErro('Selecione a máquina');
        return;
      }
      if (!operadorId) {
        setErro('Selecione o operador');
        return;
      }
    }

    try {
      await iniciar.mutateAsync({
        opLoteId: op.id,
        input: {
          ...(semMaquina ? {} : { maquinaId, operadorId }),
          observacoes: observacoes.trim() || null,
        },
      });
      toast.sucesso(
        op.terceirizada
          ? 'Envio registrado.'
          : op.esperaHoras != null
            ? 'Espera iniciada.'
            : 'OP iniciada com sucesso.',
      );
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
      title={
        isEng
          ? `Iniciar Programação — OP ${op.codigoOp} · ${op.lote.os.codigoGrv}`
          : op.terceirizada
            ? `Enviar OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`
            : op.esperaHoras != null
              ? `Iniciar espera — OP ${op.codigoOp} · ${op.lote.os.codigoGrv}`
              : `Iniciar OP ${op.codigoOp} — ${op.lote.os.codigoGrv}`
      }
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
            {iniciar.isPending
              ? 'Registrando...'
              : isEng
                ? 'Iniciar Programação (Enter)'
                : op.terceirizada
                  ? 'Registrar envio (Enter)'
                  : op.esperaHoras != null
                    ? 'Iniciar espera (Enter)'
                    : 'Iniciar (Enter)'}
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

        {semMaquina && (
          <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5 text-sm">
            {op.terceirizada ? (
              <>
                <div className="text-sky-300 font-medium mb-1">
                  🚚 Operação feita fora da fábrica
                </div>
                <div className="text-neutral-300 text-xs leading-relaxed">
                  Não abre máquina nem operador — registra a saída da peça.
                  {op.fornecedor && <> Fornecedor: <strong>{op.fornecedor}</strong>.</>}
                  {op.prazoPrevistoDias != null && (
                    <> Prazo previsto: <strong>{op.prazoPrevistoDias} dias</strong>.</>
                  )}
                  {' '}Ao voltar, encerre a OP pra seguir o fluxo.
                </div>
              </>
            ) : (
              <>
                <div className="text-indigo-300 font-medium mb-1">
                  ⏳ Espera de {op.esperaHoras}h
                </div>
                <div className="text-neutral-300 text-xs leading-relaxed">
                  Não ocupa máquina nem operador — é só o tempo correndo. O tótem
                  mostra quanto falta e a OP libera para o passo seguinte quando o
                  prazo vencer.
                </div>
              </>
            )}
          </div>
        )}

        {/* Máquina */}
        <div className={semMaquina ? 'hidden' : undefined}>
          <label className="label-compact">
            {isEng ? 'Computador / Estação de Programação' : 'Máquina'}
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
        <div className={semMaquina ? 'hidden' : undefined}>
          <label className="label-compact">
            {isEng ? 'Programador responsável' : 'Operador responsável'}
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
