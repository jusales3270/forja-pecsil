// ============================================================
// Forja - Badge clicável para mostrar observações
// Ícone laranja claro + popover branco em formato de balão
// Usa position: fixed para não ser cortado por overflow de tabela
// ============================================================

import { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface ObservacaoBadgeProps {
  texto: string | null | undefined;
}

export function ObservacaoBadge({ texto }: ObservacaoBadgeProps) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  // Calcula a posição do popover em coordenadas viewport (fixed)
  // logo abaixo do ícone, centralizado
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const rect = botaoRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const margem = 8;

    // Centraliza horizontalmente em cima do ícone
    let left = rect.left + rect.width / 2 - popoverWidth / 2;

    // Garante que não vaza da janela
    if (left < margem) left = margem;
    if (left + popoverWidth > window.innerWidth - margem) {
      left = window.innerWidth - popoverWidth - margem;
    }

    setPos({
      top: rect.bottom + margem,
      left,
    });
  }, [aberto]);

  // Fecha quando clica fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        botaoRef.current &&
        !botaoRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  // Fecha com ESC
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [aberto]);

  // Fecha ao rolar a página (popover ficaria órfão da posição calculada)
  useEffect(() => {
    if (!aberto) return;
    const handler = () => setAberto(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [aberto]);

  // Se não tem texto, não renderiza nada
  if (!texto || !texto.trim()) {
    return null;
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        aria-label="Ver observação"
        title="Ver observação"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-forja-500 text-white hover:bg-forja-400 shadow-md hover:shadow-lg transition-all"
      >
        {/* Balão de fala preenchido */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </button>

      {aberto && pos && (
        <div
          ref={popoverRef}
          role="dialog"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 320,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl ring-1 ring-black/10 animate-in"
        >
          {/* Triângulo apontando pro ícone (estilo balão) */}
          <div
            className="absolute -top-2 w-4 h-4 bg-white rotate-45 ring-1 ring-black/10"
            style={{
              left:
                botaoRef.current
                  ? Math.min(
                      Math.max(
                        botaoRef.current.getBoundingClientRect().left +
                          botaoRef.current.getBoundingClientRect().width / 2 -
                          pos.left -
                          8,
                        12
                      ),
                      320 - 24
                    )
                  : 152,
            }}
          />
          {/* Conteúdo do balão */}
          <div className="relative bg-white rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-forja-500 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </span>
              <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">
                Observação
              </p>
            </div>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap break-words leading-relaxed">
              {texto}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
