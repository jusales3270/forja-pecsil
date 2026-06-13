// ============================================================
// Forja - Diálogo de confirmação
// Para ações destrutivas (deletar, descartar mudanças, etc)
// Usa o Modal base
// ============================================================

import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Texto do botão de confirmação. Default: "Confirmar" */
  confirmLabel?: string;
  /** Texto do botão de cancelamento. Default: "Cancelar" */
  cancelLabel?: string;
  /** Visual do botão de confirmação. 'danger' (vermelho) ou 'primary'. Default 'danger' */
  variant?: 'danger' | 'primary';
  /** Desabilita o botão de confirmar (útil durante mutação) */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm'
      : 'btn-primary px-4 py-2 text-sm';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={confirmClass}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-neutral-300 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}
