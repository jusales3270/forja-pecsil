// ============================================================
// Forja - Hook de Pessoas (read-only)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Papel =
  | 'admin'
  | 'chefe'
  | 'pcp'
  | 'engenharia'
  | 'programador'
  | 'operador'
  | 'inspetor'
  | 'embalador';

export interface Pessoa {
  id: string;
  nome: string;
  codigoPessoal: string;
  papel: Papel;
  ativo: boolean;
}

export interface ListaPessoasFiltros {
  papel?: Papel;
  ativo?: boolean;
}

export function usePessoasList(filtros?: ListaPessoasFiltros) {
  return useQuery<{ data: Pessoa[] }>({
    queryKey: ['pessoas-list', filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros?.papel) params.set('papel', filtros.papel);
      if (filtros?.ativo !== undefined) params.set('ativo', String(filtros.ativo));
      const qs = params.toString();
      const res = await api.get(`/pessoas${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}
