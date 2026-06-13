// ============================================================
// Forja - Hook de API para Clientes (read-only)
// Usado pra preencher seletores de cliente no backoffice
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Cliente {
  id: string;
  nome: string;
  observacoes: string | null;
}

const QUERY_KEY = ['clientes'] as const;

export function useClientesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Cliente[] }>('/clientes');
      return data.data;
    },
    // Clientes mudam raramente
    staleTime: 5 * 60 * 1000,
  });
}
