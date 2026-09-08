// ============================================================
// Forja - Modal base
// Overlay escurecido, ESC fecha, click fora fecha,
// largura controlável, sem dependência externa
// ============================================================

import { type ReactNode, useEffect } from 'react';
import { useTheme } from '../lib/theme-store';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Largura máxima do modal. Default 'md' (~28rem).
   * 'sm' ~24rem, 'lg' ~42rem, 'xl' ~56rem
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Botões do rodapé. Se omitido, sem rodapé.
   * Tipicamente um Cancelar + um Confirmar/Salvar.
   */
  footer?: ReactNode;
  /**
   * Força a exibição em modo escuro mesmo se o tema claro estiver ativo.
   * Recomendado para totens de fábrica e telas de perfil.
   */
  forcarEscuro?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  forcarEscuro = false,
}: ModalProps) {
  const { claro } = useTheme();

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock do scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const isClaro = claro && !forcarEscuro;

  const T = isClaro
    ? {
        modalBg: 'bg-white border-slate-200',
        headerBorder: 'border-slate-200',
        headerTexto: 'text-slate-900',
        closeBtn: 'text-slate-400 hover:text-slate-700',
        footerBorder: 'border-slate-200',
      }
    : {
        modalBg: 'bg-neutral-900 border-neutral-800',
        headerBorder: 'border-neutral-800',
        headerTexto: 'text-neutral-100',
        closeBtn: 'text-neutral-400 hover:text-neutral-200',
        footerBorder: 'border-neutral-800',
      };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${SIZE_CLASS[size]} ${T.modalBg} border rounded-xl shadow-2xl flex flex-col max-h-[90vh] ${
          isClaro ? 'theme-light' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className={`flex items-center justify-between px-6 py-4 border-b ${T.headerBorder} shrink-0`}>
          <h2 className={`text-lg font-semibold ${T.headerTexto}`}>{title}</h2>
          <button
            onClick={onClose}
            className={`${T.closeBtn} text-2xl leading-none transition-colors`}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        {/* Corpo (scrollável se passar do tamanho) */}
        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {/* Footer opcional */}
        {footer && (
          <footer className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${T.footerBorder} shrink-0`}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
