// ============================================================
// Forja - Modal de criar/editar Cota de Inspeção
// Formulário denso com 8+ campos, isolado em arquivo próprio
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../../../components/Modal';
import {
  useCreateCotaInspecao,
  useUpdateCotaInspecao,
  LABELS_CARACTERISTICA,
  LABELS_FREQUENCIA,
  LABELS_INSTRUMENTO,
  type CotaInspecao,
  type Caracteristica,
  type Frequencia,
  type Instrumento,
} from '../../../hooks/useCotasInspecao';

interface CotaInspecaoModalProps {
  open: boolean;
  artigoId: string;
  opId: string;
  cota: CotaInspecao | null;
  proximaOrdem: number;
  onClose: () => void;
}

export function CotaInspecaoModal({
  open,
  artigoId,
  opId,
  cota,
  proximaOrdem,
  onClose,
}: CotaInspecaoModalProps) {
  const ehEdicao = cota !== null;

  const [codigoCota, setCodigoCota] = useState('');
  const [valorNominal, setValorNominal] = useState('');
  const [toleranciaMais, setToleranciaMais] = useState('');
  const [toleranciaMenos, setToleranciaMenos] = useState('');
  const [caracteristica, setCaracteristica] =
    useState<Caracteristica>('processo');
  const [frequenciaMonitorar, setFrequenciaMonitorar] =
    useState<Frequencia>('todas');
  const [frequenciaRegistrar, setFrequenciaRegistrar] =
    useState<Frequencia>('primeira');
  const [instrumento, setInstrumento] = useState<Instrumento>('paq_digital');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const createMut = useCreateCotaInspecao(artigoId, opId);
  const updateMut = useUpdateCotaInspecao(artigoId, opId);

  useEffect(() => {
    if (open) {
      setCodigoCota(cota?.codigoCota ?? '');
      setValorNominal(cota?.valorNominal?.toString() ?? '');
      setToleranciaMais(cota?.toleranciaMais?.toString() ?? '');
      setToleranciaMenos(cota?.toleranciaMenos?.toString() ?? '');
      setCaracteristica(cota?.caracteristica ?? 'processo');
      setFrequenciaMonitorar(cota?.frequenciaMonitorar ?? 'todas');
      setFrequenciaRegistrar(cota?.frequenciaRegistrar ?? 'primeira');
      setInstrumento(cota?.instrumento ?? 'paq_digital');
      setObservacoes(cota?.observacoes ?? '');
      setErro(null);
    }
  }, [open, cota]);

  const loading = createMut.isPending || updateMut.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!codigoCota.trim()) {
      setErro('Código da cota é obrigatório');
      return;
    }
    const nominal = parseFloat(valorNominal);
    if (isNaN(nominal)) {
      setErro('Valor nominal precisa ser um número válido');
      return;
    }

    // Tolerâncias são opcionais; se preenchidas, precisam ser >= 0
    let tMais: number | null = null;
    let tMenos: number | null = null;
    if (toleranciaMais.trim()) {
      const v = parseFloat(toleranciaMais);
      if (isNaN(v) || v < 0) {
        setErro('Tolerância + deve ser um número ≥ 0');
        return;
      }
      tMais = v;
    }
    if (toleranciaMenos.trim()) {
      const v = parseFloat(toleranciaMenos);
      if (isNaN(v) || v < 0) {
        setErro('Tolerância − deve ser um número ≥ 0 (use valor absoluto)');
        return;
      }
      tMenos = v;
    }

    // Validação: se ambas vêm, ao menos uma > 0
    if (tMais != null && tMenos != null && tMais === 0 && tMenos === 0) {
      setErro('Se as duas tolerâncias forem informadas, ao menos uma deve ser > 0');
      return;
    }

    try {
      const payload = {
        codigoCota: codigoCota.trim(),
        valorNominal: nominal,
        toleranciaMais: tMais,
        toleranciaMenos: tMenos,
        caracteristica,
        frequenciaMonitorar,
        frequenciaRegistrar,
        instrumento,
        observacoes: observacoes.trim() || null,
      };

      if (ehEdicao && cota) {
        await updateMut.mutateAsync({ id: cota.id, input: payload });
      } else {
        await createMut.mutateAsync({
          ...payload,
          ordem: proximaOrdem,
        });
      }
      onClose();
    } catch (err: any) {
      setErro(
        err?.response?.data?.message ??
          err?.message ??
          'Erro ao salvar. Tente novamente.'
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={ehEdicao ? 'Editar Cota' : 'Nova Cota'}
      size="lg"
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
            form="cota-form"
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? 'Salvando...' : ehEdicao ? 'Salvar' : 'Criar'}
          </button>
        </>
      }
    >
      <form id="cota-form" onSubmit={handleSubmit} className="space-y-4">
        {erro && <div className="error-message">{erro}</div>}

        {/* Código + Nominal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Código da Cota *</label>
            <input
              type="text"
              value={codigoCota}
              onChange={(e) => setCodigoCota(e.target.value)}
              className="input"
              placeholder='Ex: A, P, C*2, Q'
              autoFocus
            />
            <p className="text-xs text-neutral-500 mt-1">
              Identificador no desenho (letra ou símbolo)
            </p>
          </div>
          <div>
            <label className="label">Valor Nominal *</label>
            <input
              type="number"
              step="0.001"
              value={valorNominal}
              onChange={(e) => setValorNominal(e.target.value)}
              className="input"
              placeholder="Ex: 25.5"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Valor de referência (sem unidade)
            </p>
          </div>
        </div>

        {/* Tolerâncias */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Tolerância + (opcional)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={toleranciaMais}
              onChange={(e) => setToleranciaMais(e.target.value)}
              className="input"
              placeholder="Ex: 0.05"
            />
          </div>
          <div>
            <label className="label">Tolerância − (opcional)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={toleranciaMenos}
              onChange={(e) => setToleranciaMenos(e.target.value)}
              className="input"
              placeholder="Ex: 0.05 (valor absoluto)"
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500 -mt-1">
          Se em branco, na inspeção será usada a Tolerância Geral por Cliente como fallback.
        </p>

        {/* Característica */}
        <div>
          <label className="label">Característica *</label>
          <select
            value={caracteristica}
            onChange={(e) => setCaracteristica(e.target.value as Caracteristica)}
            className="input"
          >
            {(Object.keys(LABELS_CARACTERISTICA) as Caracteristica[]).map((k) => (
              <option key={k} value={k}>
                {LABELS_CARACTERISTICA[k]}
              </option>
            ))}
          </select>
        </div>

        {/* Frequências */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Frequência de Monitoramento *</label>
            <select
              value={frequenciaMonitorar}
              onChange={(e) =>
                setFrequenciaMonitorar(e.target.value as Frequencia)
              }
              className="input"
            >
              {(Object.keys(LABELS_FREQUENCIA) as Frequencia[]).map((k) => (
                <option key={k} value={k}>
                  {LABELS_FREQUENCIA[k]}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">Quando medir</p>
          </div>
          <div>
            <label className="label">Frequência de Registro *</label>
            <select
              value={frequenciaRegistrar}
              onChange={(e) =>
                setFrequenciaRegistrar(e.target.value as Frequencia)
              }
              className="input"
            >
              {(Object.keys(LABELS_FREQUENCIA) as Frequencia[]).map((k) => (
                <option key={k} value={k}>
                  {LABELS_FREQUENCIA[k]}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Quando gravar a medição no sistema
            </p>
          </div>
        </div>

        {/* Instrumento */}
        <div>
          <label className="label">Instrumento *</label>
          <select
            value={instrumento}
            onChange={(e) => setInstrumento(e.target.value as Instrumento)}
            className="input"
          >
            {(Object.keys(LABELS_INSTRUMENTO) as Instrumento[]).map((k) => (
              <option key={k} value={k}>
                {LABELS_INSTRUMENTO[k]}
              </option>
            ))}
          </select>
        </div>

        {/* Observações */}
        <div>
          <label className="label">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="input"
            rows={2}
            placeholder="Opcional — particularidades de medição, posição da cota, etc."
          />
        </div>
      </form>
    </Modal>
  );
}
