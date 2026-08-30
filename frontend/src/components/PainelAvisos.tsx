// ============================================================
// Forja - Painel de avisos internos
// Fica dentro da aplicação: nada é enviado por WhatsApp aqui.
// ============================================================

import { useState } from 'react';
import {
  useAvisos,
  useMarcarAvisoLido,
  useMarcarTodosLidos,
  tempoRelativo,
} from '../hooks/useAvisos';

/** etapaId: estação aberta no tótem. Os avisos dela aparecem aqui. */
export function PainelAvisos({ etapaId }: { etapaId?: string | null }) {
  const { data: avisos } = useAvisos(etapaId);
  const marcarLido = useMarcarAvisoLido();
  const marcarTodos = useMarcarTodosLidos();
  const [aberto, setAberto] = useState(false);

  const total = avisos?.length ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className={`relative px-3 py-2 text-sm rounded-lg border transition ${
          total > 0
            ? 'border-forja-500/50 bg-forja-500/10 text-forja-300 hover:bg-forja-500/20'
            : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
        }`}
        title="Avisos da produção"
      >
        🔔
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-forja-500 text-white">
            {total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-2 w-[380px] max-h-[70vh] overflow-y-auto z-50 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 sticky top-0 bg-neutral-900">
              <span className="text-sm font-semibold text-neutral-100">
                Avisos da produção
              </span>
              {total > 0 && (
                <button
                  onClick={() => marcarTodos.mutate(etapaId)}
                  disabled={marcarTodos.isPending}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  marcar tudo como lido
                </button>
              )}
            </div>

            {total === 0 && (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                Nenhum aviso novo.
              </div>
            )}

            <div className="divide-y divide-neutral-800">
              {avisos?.map((a) => (
                <div key={a.id} className="px-4 py-3 hover:bg-neutral-800/40">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-forja-400 font-semibold">
                      {a.opLote?.etapaAvisada
                        ? `para ${a.opLote.etapaAvisada.nome}`
                        : 'produção'}
                    </span>
                    <span className="text-[10px] text-neutral-500 shrink-0">
                      {tempoRelativo(a.criadoEm)}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-200 mt-1 leading-snug">
                    {a.mensagem}
                  </p>

                  {a.opLote && (
                    <div className="text-[11px] text-neutral-500 mt-1">
                      {a.opLote.quantidadeConcluida}/{a.opLote.lote.quantidadePecas} peças ·{' '}
                      {a.opLote.etapa.nome}
                    </div>
                  )}

                  <button
                    onClick={() => marcarLido.mutate(a.id)}
                    className="text-[11px] text-neutral-400 hover:text-forja-400 mt-2"
                  >
                    marcar como lido
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
