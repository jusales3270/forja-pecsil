// ============================================================
// Forja - Seletor de acessos por usuário (área administrativa)
// ============================================================
// Dropdown com os módulos do sistema. Começa no padrão do papel; o admin
// marca ou desmarca o que aquela pessoa acessa (ex.: um PCP com o Painel de
// Produção, sem Estações e Máquinas).
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  MODULOS_ACESSO,
  MODULOS_PADRAO_POR_PAPEL,
  PAPEL_LABEL,
  type ModuloAcesso,
  type Papel,
} from '@forja/shared';

interface Props {
  papel: Papel;
  /** Nulo = segue o padrão do papel. */
  valor: ModuloAcesso[] | null;
  onChange: (acessos: ModuloAcesso[] | null) => void;
  claro?: boolean;
}

const mesmoConjunto = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function SeletorAcessos({ papel, valor, onChange, claro = false }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const padrao = MODULOS_PADRAO_POR_PAPEL[papel] ?? [];
  const selecionados = valor ?? padrao;
  const personalizado = valor !== null && !mesmoConjunto(valor, padrao);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function alternar(id: ModuloAcesso) {
    const proximo = selecionados.includes(id) ? selecionados.filter((m) => m !== id) : [...selecionados, id];
    const ordenado = MODULOS_ACESSO.map((m) => m.id).filter((m) => proximo.includes(m));
    onChange(mesmoConjunto(ordenado, padrao) ? null : ordenado);
  }

  const grupos = [...new Set(MODULOS_ACESSO.map((m) => m.grupo))];
  const borda = claro ? 'border-slate-300 bg-white' : 'border-neutral-700 bg-neutral-950';
  const sub = claro ? 'text-slate-500' : 'text-neutral-400';

  return (
    <div ref={caixaRef} className="relative">
      <label className="label">Acessos do usuário</label>
      <button
        type="button"
        className="input flex items-center justify-between text-left"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selecionados.length} de {MODULOS_ACESSO.length} módulos ·{' '}
          {personalizado ? 'personalizado' : `padrão de ${PAPEL_LABEL[papel]}`}
        </span>
        <span aria-hidden="true" className="ml-2">{aberto ? '▴' : '▾'}</span>
      </button>

      {aberto && (
        <div className={`mt-1 w-full rounded-xl border p-3 ${borda}`} role="listbox" aria-multiselectable="true">
          {grupos.map((grupo) => (
            <div key={grupo} className="mb-2 last:mb-0">
              <p className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${sub}`}>{grupo}</p>
              {MODULOS_ACESSO.filter((m) => m.grupo === grupo).map((m) => {
                // O admin não perde o cadastro de usuários: evita trancar o sistema
                const travado = papel === 'admin' && m.id === 'usuarios';
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${travado ? 'opacity-60' : 'cursor-pointer'} ${claro ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-forja-500"
                      checked={selecionados.includes(m.id)}
                      disabled={travado}
                      onChange={() => alternar(m.id)}
                    />
                    <span>{m.rotulo}</span>
                    {!padrao.includes(m.id) && selecionados.includes(m.id) && (
                      <span className="ml-auto text-[10px] uppercase text-emerald-500">liberado</span>
                    )}
                    {padrao.includes(m.id) && !selecionados.includes(m.id) && (
                      <span className="ml-auto text-[10px] uppercase text-amber-500">retirado</span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
          <div className={`flex justify-between items-center pt-2 mt-2 border-t ${claro ? 'border-slate-200' : 'border-neutral-800'}`}>
            <button type="button" className="text-xs text-forja-400 hover:underline disabled:opacity-40" disabled={!personalizado} onClick={() => onChange(null)}>
              Restaurar padrão de {PAPEL_LABEL[papel]}
            </button>
            <button type="button" className="text-xs px-3 py-1 rounded-lg bg-forja-500 text-white" onClick={() => setAberto(false)}>
              Pronto
            </button>
          </div>
        </div>
      )}
      <p className={`text-xs mt-1 ${sub}`}>
        Define quais itens aparecem para esta pessoa no início e quais páginas ela pode abrir.
      </p>
    </div>
  );
}
