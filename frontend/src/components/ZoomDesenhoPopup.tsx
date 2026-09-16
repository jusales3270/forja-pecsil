// ============================================================
// Forja - Popup de desenho em tela cheia com zoom e arraste
// Roda do mouse = zoom no cursor · arrastar = percorrer
// Toque: pinça = zoom · um dedo = percorrer · duplo toque = alterna
// ============================================================

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PaginaRenderizada } from '../lib/render-pdf';
import {
  type Tamanho,
  type Vista,
  fatorRoda,
  limitarPosicao,
  vistaEncaixe,
  zoomNoPonto,
} from '../lib/zoom-desenho';

interface ZoomDesenhoPopupProps {
  paginas: PaginaRenderizada[];
  paginaInicial?: number;
  titulo: string;
  onClose: () => void;
}

const ESCALA_DUPLO_CLIQUE = 2.5;

export function ZoomDesenhoPopup({ paginas, paginaInicial = 0, titulo, onClose }: ZoomDesenhoPopupProps) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(paginaInicial);
  const [caixa, setCaixa] = useState<Tamanho>({ largura: 0, altura: 0 });
  const [vista, setVista] = useState<Vista | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const pagina = paginas[indice] ?? paginas[0];
  const imagem: Tamanho = { largura: pagina.largura, altura: pagina.altura };

  // Estado dos gestos fora do React (atualiza a cada pointermove)
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ distancia: number; meioX: number; meioY: number } | null>(null);
  const ultimoToque = useRef(0);
  const vistaRef = useRef<Vista | null>(null);

  // Vários eventos (dois dedos, roda rápida) chegam antes do próximo render:
  // a ref é atualizada na hora para cada evento partir da vista mais recente.
  const aplicarVista = useCallback((nova: Vista) => {
    vistaRef.current = nova;
    setVista(nova);
  }, []);

  // Mede a caixa
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setCaixa({ largura: el.clientWidth, altura: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Encaixa ao abrir, ao trocar de página e quando a caixa muda de tamanho
  useEffect(() => {
    if (caixa.largura > 0 && caixa.altura > 0) aplicarVista(vistaEncaixe(caixa, imagem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixa.largura, caixa.altura, indice]);

  const ajustar = useCallback(() => aplicarVista(vistaEncaixe(caixa, imagem)), [caixa, imagem.largura, imagem.altura]);

  const zoomCentro = (fator: number) => {
    const atual = vistaRef.current;
    if (!atual) return;
    aplicarVista(zoomNoPonto(atual, fator, caixa.largura / 2, caixa.altura / 2, caixa, imagem));
  };

  // Roda do mouse — precisa de passive:false para impedir o scroll da página
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const atual = vistaRef.current;
      if (!atual) return;
      const r = el.getBoundingClientRect();
      aplicarVista(zoomNoPonto(atual, fatorRoda(e.deltaY, e.deltaMode), e.clientX - r.left, e.clientY - r.top, caixa, imagem));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixa.largura, caixa.altura, imagem.largura, imagem.altura]);

  // ESC fecha só o popup (captura + stopPropagation para o modal de trás não fechar junto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        zoomCentro(1.25);
      } else if (e.key === '-') {
        zoomCentro(0.8);
      } else if (e.key === '0') {
        ajustar();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const alternarZoom = (px: number, py: number) => {
    const atual = vistaRef.current;
    if (!atual) return;
    const encaixe = vistaEncaixe(caixa, imagem);
    const ampliado = atual.escala > encaixe.escala * 1.05;
    aplicarVista(ampliado ? encaixe : zoomNoPonto(atual, (ESCALA_DUPLO_CLIQUE * encaixe.escala) / atual.escala, px, py, caixa, imagem));
  };

  const pontoNaCaixa = (e: ReactPointerEvent) => {
    const r = caixaRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pontoNaCaixa(e);
    ponteiros.current.set(e.pointerId, p);

    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()];
      pinca.current = { distancia: Math.hypot(a.x - b.x, a.y - b.y), meioX: (a.x + b.x) / 2, meioY: (a.y + b.y) / 2 };
    } else if (ponteiros.current.size === 1) {
      setArrastando(true);
      if (e.pointerType === 'touch') {
        const agora = Date.now();
        if (agora - ultimoToque.current < 300) {
          alternarZoom(p.x, p.y);
          ultimoToque.current = 0;
        } else {
          ultimoToque.current = agora;
        }
      }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const anterior = ponteiros.current.get(e.pointerId);
    const atual = vistaRef.current;
    if (!anterior || !atual) return;
    const p = pontoNaCaixa(e);
    ponteiros.current.set(e.pointerId, p);

    if (ponteiros.current.size >= 2 && pinca.current) {
      const [a, b] = [...ponteiros.current.values()];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      const meioX = (a.x + b.x) / 2;
      const meioY = (a.y + b.y) / 2;
      let nova = zoomNoPonto(atual, distancia / (pinca.current.distancia || distancia), meioX, meioY, caixa, imagem);
      nova = limitarPosicao(
        { ...nova, x: nova.x + meioX - pinca.current.meioX, y: nova.y + meioY - pinca.current.meioY },
        caixa,
        imagem,
      );
      pinca.current = { distancia, meioX, meioY };
      aplicarVista(nova);
    } else if (ponteiros.current.size === 1) {
      aplicarVista(limitarPosicao({ ...atual, x: atual.x + p.x - anterior.x, y: atual.y + p.y - anterior.y }, caixa, imagem));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size < 2) pinca.current = null;
    if (ponteiros.current.size === 0) setArrastando(false);
  };

  const trocarPagina = (delta: number) => {
    setIndice((i) => Math.min(Math.max(i + delta, 0), paginas.length - 1));
  };

  const percentual = vista ? Math.round(vista.escala * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={titulo}>
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-950 border-b border-neutral-800 shrink-0">
        <h2 className="text-sm font-semibold text-neutral-100 truncate">{titulo}</h2>
        <div className="flex items-center gap-1.5 shrink-0">
          {paginas.length > 1 && (
            <div className="flex items-center gap-1 mr-2 text-xs text-neutral-300">
              <button
                type="button"
                onClick={() => trocarPagina(-1)}
                disabled={indice === 0}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 rounded-lg"
                aria-label="Página anterior"
              >
                ‹
              </button>
              <span className="font-mono px-1">
                pág. {indice + 1}/{paginas.length}
              </span>
              <button
                type="button"
                onClick={() => trocarPagina(1)}
                disabled={indice === paginas.length - 1}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 rounded-lg"
                aria-label="Próxima página"
              >
                ›
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => zoomCentro(0.8)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-bold rounded-lg"
            aria-label="Diminuir zoom"
          >
            −
          </button>
          <span className="w-14 text-center text-xs font-mono text-neutral-400">{percentual}%</span>
          <button
            type="button"
            onClick={() => zoomCentro(1.25)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-bold rounded-lg"
            aria-label="Aumentar zoom"
          >
            +
          </button>
          <button
            type="button"
            onClick={ajustar}
            className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg"
            title="Mostrar o desenho inteiro"
          >
            Ajustar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 px-3 py-1.5 text-xs bg-forja-500 hover:bg-forja-600 text-white font-semibold rounded-lg"
          >
            ✕ Fechar
          </button>
        </div>
      </header>

      <div
        ref={caixaRef}
        className={`relative flex-1 overflow-hidden select-none ${arrastando ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          alternarZoom(e.clientX - r.left, e.clientY - r.top);
        }}
      >
        {vista && (
          <img
            src={pagina.url}
            alt={titulo}
            draggable={false}
            className="absolute top-0 left-0 max-w-none shadow-2xl"
            style={{
              width: pagina.largura,
              height: pagina.altura,
              transformOrigin: '0 0',
              transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
              willChange: 'transform',
            }}
          />
        )}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 text-[11px] text-neutral-300 whitespace-nowrap">
          Roda do mouse ou pinça para zoom · arraste para percorrer · duplo clique alterna
        </div>
      </div>
    </div>
  );
}
