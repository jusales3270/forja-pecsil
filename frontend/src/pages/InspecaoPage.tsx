// ============================================================
// Forja - Tela de Inspecao Dimensional (Sprint 5)
// Uma cota por vez. Inspetor digita o valor; sistema valida na hora.
// ============================================================

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useInspecao,
  useRegistrarMedicao,
  useConcluirInspecao,
  type Cota,
} from '../hooks/useInspecao';

export default function InspecaoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useInspecao(id ?? null);
  const registrar = useRegistrarMedicao(id ?? '');
  const concluir = useConcluirInspecao(id ?? '');

  const [indiceCota, setIndiceCota] = useState(0);
  const [numeroPeca, setNumeroPeca] = useState(1);
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [ultimoResultado, setUltimoResultado] = useState<null | { ok: boolean; origem: string }>(null);

  if (isLoading) return <div className="p-6 text-neutral-400">Carregando...</div>;
  if (isError || !data) return <div className="p-6 error-message">Erro ao carregar inspeção.</div>;

  const insp = data.data;
  const cotas: Cota[] = insp.opLote?.operacaoArtigo?.planoInspecao?.cotas ?? [];
  const concluida = !!insp.timestampConcluida;

  if (cotas.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card">
          <p className="text-neutral-300">Esta operação não tem plano de inspeção com cotas.</p>
          <button className="btn-secondary mt-4" onClick={() => navigate(-1)}>Voltar</button>
        </div>
      </div>
    );
  }

  const cota = cotas[indiceCota];
  const medicoesDaCota = insp.medicoes.filter((m) => m.cotaInspecaoId === cota.id);

  const tolTxt =
    cota.toleranciaMais != null && cota.toleranciaMenos != null
      ? `+${cota.toleranciaMais} / -${cota.toleranciaMenos}`
      : 'tolerância geral do cliente';

  async function handleRegistrar() {
    if (valor.trim() === '') return;
    const res = await registrar.mutateAsync({
      cotaInspecaoId: cota.id,
      numeroPecaInspecionada: numeroPeca,
      valorMedido: Number(valor),
      observacoes: obs.trim() || null,
    });
    setUltimoResultado({ ok: res.data.dentroTolerancia, origem: res.data.toleranciaOrigem });
    setValor('');
    setObs('');
  }

  async function handleConcluir(resultado: string) {
    await concluir.mutateAsync({ resultado });
    navigate(-1);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Inspeção</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {insp.opLote?.lote?.os?.codigoGrv} · {insp.opLote?.codigoOp} · {insp.tipo}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => navigate(-1)}>Voltar</button>
      </div>

      {concluida && (
        <div className="card border-emerald-500/40 bg-emerald-500/5">
          <p className="text-emerald-400">Inspeção concluída: {insp.resultado}</p>
        </div>
      )}

      {!concluida && (
        <>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">
                Cota {indiceCota + 1} de {cotas.length}
              </span>
              <span className="badge bg-blue-500/15 text-blue-400 border-blue-500/30">
                {cota.caracteristica}
              </span>
            </div>

            <div>
              <div className="text-3xl font-bold text-neutral-100">{cota.codigoCota}</div>
              <div className="text-neutral-400 mt-1">
                Nominal: <span className="text-forja-400 font-semibold">{cota.valorNominal}</span>
                {'  '}({tolTxt})
              </div>
              <div className="text-xs text-neutral-500 mt-1">Instrumento: {cota.instrumento}</div>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm text-neutral-400 block mb-1">Valor medido</label>
                <input
                  type="number"
                  step="any"
                  className="input w-full text-lg"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="ex: 49.98"
                />
              </div>
              <div className="w-24">
                <label className="text-sm text-neutral-400 block mb-1">Peça nº</label>
                <input
                  type="number"
                  min={1}
                  className="input w-full"
                  value={numeroPeca}
                  onChange={(e) => setNumeroPeca(Number(e.target.value))}
                />
              </div>
            </div>

            <input
              type="text"
              className="input w-full"
              placeholder="Observação (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />

            <button
              className="btn-primary w-full"
              disabled={valor.trim() === '' || registrar.isPending}
              onClick={handleRegistrar}
            >
              {registrar.isPending ? 'Registrando...' : 'Registrar medição'}
            </button>

            {ultimoResultado && (
              <div
                className={
                  ultimoResultado.ok
                    ? 'card border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
                    : 'card border-red-500/40 bg-red-500/5 text-red-400'
                }
              >
                {ultimoResultado.ok ? 'DENTRO da tolerância' : 'FORA da tolerância'}
                {ultimoResultado.origem === 'sem_tolerancia' && ' (sem tolerância definida)'}
              </div>
            )}
          </div>

          {medicoesDaCota.length > 0 && (
            <div className="card">
              <p className="text-sm text-neutral-400 mb-2">Medições desta cota</p>
              <div className="space-y-1 text-sm">
                {medicoesDaCota.map((m) => (
                  <div key={m.id} className="flex justify-between border-b border-neutral-800 py-1">
                    <span className="text-neutral-300">Peça {m.numeroPecaInspecionada}: {m.valorMedido}</span>
                    <span className={m.dentroTolerancia ? 'text-emerald-400' : 'text-red-400'}>
                      {m.dentroTolerancia ? 'OK' : 'FORA'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              className="btn-secondary"
              disabled={indiceCota === 0}
              onClick={() => { setIndiceCota((i) => i - 1); setUltimoResultado(null); }}
            >
              ← Cota anterior
            </button>
            <button
              className="btn-secondary"
              disabled={indiceCota >= cotas.length - 1}
              onClick={() => { setIndiceCota((i) => i + 1); setUltimoResultado(null); }}
            >
              Próxima cota →
            </button>
          </div>

          <div className="card space-y-2">
            <p className="text-sm text-neutral-400">Concluir inspeção com resultado:</p>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" onClick={() => handleConcluir('aprovado')}>Aprovado</button>
              <button className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg" onClick={() => handleConcluir('com_observacoes')}>Com observações</button>
              <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg" onClick={() => handleConcluir('reprovado')}>Reprovado</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
