// ============================================================
// Forja - Toast contextual
// Notificação temporária no canto da tela
// ============================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastProps {
  mensagem: string;
  tipo?: ToastTipo;
  duracao?: number;
  onClose?: () => void;
}

const ESTILOS: Record<ToastTipo, string> = {
  sucesso: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300',
  erro: 'bg-red-500/15 border-red-500/50 text-red-300',
  aviso: 'bg-amber-500/15 border-amber-500/50 text-amber-300',
  info: 'bg-blue-500/15 border-blue-500/50 text-blue-300',
};

const ICONES: Record<ToastTipo, string> = {
  sucesso: '✓',
  erro: '✕',
  aviso: '!',
  info: 'i',
};

export function Toast({
  mensagem,
  tipo = 'info',
  duracao = 4000,
  onClose,
}: ToastProps) {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisivel(false);
      setTimeout(() => onClose?.(), 200);
    }, duracao);
    return () => clearTimeout(timer);
  }, [duracao, onClose]);

  return createPortal(
    <div
      className={`fixed bottom-6 right-6 z-[60] max-w-md transition-all duration-200 ${
        visivel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div
        className={`flex items-start gap-3 px-4 py-3 border rounded-xl shadow-2xl backdrop-blur-sm ${ESTILOS[tipo]}`}
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-current/20 text-sm font-bold shrink-0">
          {ICONES[tipo]}
        </span>
        <p className="text-sm leading-relaxed">{mensagem}</p>
        <button
          onClick={() => {
            setVisivel(false);
            setTimeout(() => onClose?.(), 200);
          }}
          className="ml-2 text-current/60 hover:text-current text-lg leading-none shrink-0"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ============================================================
// Hook simples pra disparar toasts
// Usar em componentes: const toast = useToast(); toast.sucesso('...');
// ============================================================

interface ToastItem {
  id: number;
  mensagem: string;
  tipo: ToastTipo;
  duracao?: number;
}

let counter = 0;
const listeners: Array<(item: ToastItem) => void> = [];

export function dispararToast(
  mensagem: string,
  tipo: ToastTipo = 'info',
  duracao?: number,
) {
  const item: ToastItem = { id: ++counter, mensagem, tipo, duracao };
  listeners.forEach((l) => l(item));
}

export const toast = {
  sucesso: (msg: string, duracao?: number) => dispararToast(msg, 'sucesso', duracao),
  erro: (msg: string, duracao?: number) => dispararToast(msg, 'erro', duracao),
  aviso: (msg: string, duracao?: number) => dispararToast(msg, 'aviso', duracao),
  info: (msg: string, duracao?: number) => dispararToast(msg, 'info', duracao),
};

/**
 * Provider que renderiza os toasts dinamicamente.
 * Coloque uma vez no App.tsx.
 */
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (item: ToastItem) => {
      setItems((prev) => [...prev, item]);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  function remover(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <>
      {items.map((item, idx) => (
        <div
          key={item.id}
          style={{ bottom: `${1.5 + idx * 4.5}rem` }}
          className="fixed right-6 z-[60]"
        >
          <Toast
            mensagem={item.mensagem}
            tipo={item.tipo}
            duracao={item.duracao}
            onClose={() => remover(item.id)}
          />
        </div>
      ))}
    </>
  );
}
