// ============================================================
// Forja - Store de tema (modo claro/escuro)
// Usa zustand pra manter consistência com o auth-store.
// Persiste a preferência do usuário no localStorage.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  claro: boolean;
  toggleTema: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      claro: false,
      toggleTema: () => set((s) => ({ claro: !s.claro })),
    }),
    { name: 'forja-theme' },
  ),
);
