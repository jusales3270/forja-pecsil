// ============================================================
// Forja - Tela de Conferencia de Fim de Turno (Sprint 4 - Bloco B)
// Fim de turno e conferencia, nao digitacao.
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreviaTurno, useFecharTurno, type LinhaTurno } from '../hooks/useConferenciaTurno';

export default function ConferenciaTurnoPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePreviaTurno();
  const fechar = useFecharTurno();

  const [linhas, setLinhas] = useState<LinhaTurno[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (data?.data.linhas) {
      setLinhas(
        data.data.linhas.map((l) => ({
          maquinaId: l.maquinaId,
          maquinaNome: l.maquinaNome,
          contadoSistema: l.contadoSistema,
          ajustado: l.contadoSistema,
          justificativa: null,
        })),
      );
    }
  }, [data]);

  function setAjuste(maquinaId: string, valor: number) {
    setLinhas((prev) =>
      prev.map((l) => (l.maquinaId === maquinaId ? { ...l, ajustado: valor } : l)),
    );
  }

  function setJustificativa(maquinaId: string, texto: string) {
    setLinhas((prev) =>
      prev.map((l) => (l.maquinaId === maquinaId ? { ...l, justificativa: texto } : l)),
    );
  }

  const totalSistema = linhas.reduce((s, l) => s + l.contadoSistema, 0);
  const totalAjustado = linhas.reduce((s, l) => s + l.ajustado, 0);

  // bloqueia fechar se algum ajuste diverge sem justificativa
  const faltaJustificar = linhas.some(
    (l) => l.ajustado !== l.contadoSistema && !l.justificativa?.trim(),
  );

  async function handleFechar() {
    await fechar.mutateAsync({ linhas, observacoes: observacoes.trim() || null });
    setSucesso(true);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Fim de Turno</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Confira o que o sistema contou e ajuste se precisar.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/totem')}>
          Voltar ao tótem
        </button>
      </div>

      {isLoading && <p className="text-neutral-400">Carregando...</p>}
      {isError && <p className="error-message">Erro ao carregar a conferência.</p>}

      {sucesso && (
        <div className="card border-emerald-500/40 bg-emerald-500/5">
          <p className="text-emerald-400 font-medium">Turno fechado com sucesso.</p>
        </div>
      )}

      {data?.data.jaFechado && !sucesso && (
        <div className="card border-amber-500/40 bg-amber-500/5">
          <p className="text-amber-400 text-sm">
            Este turno já foi fechado hoje. Fechar de novo vai atualizar os valores.
          </p>
        </div>
      )}

      {data && linhas.length === 0 && !sucesso && (
        <div className="card">
          <p className="text-neutral-400">
            Nenhuma peça registrada hoje. Nada a conferir.
          </p>
        </div>
      )}

      {linhas.length > 0 && !sucesso && (
        <div className="card space-y-4">
          {linhas.map((l) => {
            const diverge = l.ajustado !== l.contadoSistema;
            return (
              <div
                key={l.maquinaId}
                className="border-b border-neutral-800 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-neutral-100">{l.maquinaNome}</span>
                  <span className="text-sm text-neutral-400">
                    Sistema contou: <span className="text-forja-400 font-semibold">{l.contadoSistema}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-neutral-400">Confirmado:</label>
                  <input
                    type="number"
                    min={0}
                    className="input w-24"
                    value={l.ajustado}
                    onChange={(e) => setAjuste(l.maquinaId, Number(e.target.value))}
                  />
                  {diverge && (
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="Justifique a diferença"
                      value={l.justificativa ?? ''}
                      onChange={(e) => setJustificativa(l.maquinaId, e.target.value)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <div>
            <label className="text-sm text-neutral-400 block mb-1">Observação do dia</label>
            <textarea
              className="input w-full"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-neutral-400">
              Sistema {totalSistema} - Confirmado{' '}
              <span className="text-neutral-100 font-semibold">{totalAjustado}</span>
            </span>
            <button
              className="btn-primary"
              disabled={faltaJustificar || fechar.isPending}
              onClick={handleFechar}
            >
              {fechar.isPending ? 'Fechando...' : 'Fechar turno'}
            </button>
          </div>
          {faltaJustificar && (
            <p className="text-xs text-amber-400 text-right">
              Justifique as diferenças antes de fechar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
