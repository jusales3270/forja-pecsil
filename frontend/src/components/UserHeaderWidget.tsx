// ============================================================
// Forja - Widget de Usuário no Cabeçalho
// Exibe o nome cadastrado e o botão de engrenagem para editar perfil
// ============================================================

import { useState } from 'react';
import { useAuth } from '../lib/auth-store';
import { useTheme } from '../lib/theme-store';
import { EditarPerfilModal } from './EditarPerfilModal';

interface UserHeaderWidgetProps {
  /** Subtítulo opcional (ex: cargo/papel). Se omitido, mostra apenas o nome. */
  subtitulo?: string;
  /** Classe CSS extra para customização */
  className?: string;
}

export function UserHeaderWidget({ subtitulo, className = '' }: UserHeaderWidgetProps) {
  const { pessoa } = useAuth();
  const { claro } = useTheme();
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <div
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors ${
          claro
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-neutral-900 border-neutral-800 text-neutral-100'
        } ${className}`}
      >
        <div className="text-right leading-tight">
          <p className="text-sm font-semibold truncate max-w-[160px] md:max-w-[220px]">
            {pessoa?.nome || 'Usuário'}
          </p>
          {subtitulo && (
            <p className={`text-xs ${claro ? 'text-slate-500' : 'text-neutral-400'}`}>
              {subtitulo}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          title="Configurações de perfil (trocar nome de usuário e senha)"
          className={`p-1.5 rounded-md text-sm transition-all duration-150 flex items-center justify-center ${
            claro
              ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <EditarPerfilModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
      />
    </>
  );
}
