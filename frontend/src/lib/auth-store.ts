import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PessoaPublica } from '@forja/shared';
import { api } from './api';

interface AuthState {
  token: string | null;
  pessoa: PessoaPublica | null;
  isAuthenticated: boolean;
  login: (codigoPessoal: string, pin: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      pessoa: null,
      isAuthenticated: false,

      login: async (codigoPessoal, pin) => {
        const res = await api.post('/auth/login', {
          codigo_pessoal: codigoPessoal,
          pin,
        });

        const { token, pessoa } = res.data.data;

        localStorage.setItem('forja_token', token);

        set({
          token,
          pessoa,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('forja_token');
        set({
          token: null,
          pessoa: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'forja-auth',
      partialize: (state) => ({
        token: state.token,
        pessoa: state.pessoa,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
