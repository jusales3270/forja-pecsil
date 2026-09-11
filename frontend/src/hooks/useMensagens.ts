import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-store';

export interface Mensagem {
  id: string; corpo: string; remetenteId: string; destinatarioId: string;
  remetenteNome: string; destinatarioNome: string;
  etapaOrigem: { id: string; nome: string }; etapaDestino: { id: string; nome: string };
  criadoEm: string; lidoEm: string | null; respostaAId: string | null;
}
export interface Contatos {
  conta: { id: string; nome: string; etapa: { id: string; nome: string; ativa: boolean } | null };
  podeEnviar: boolean;
  estacoes: { id: string; nome: string; pessoas: { id: string; nome: string; codigoPessoal: string }[] }[];
}
interface Caixa { data: Mensagem[]; meta: { total: number; naoLidas: number; pagina: number; paginas: number } }

export function useMensagens(caixa: 'recebidas' | 'enviadas', pagina = 1, enabled = true) {
  const { pessoa, token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['mensagens', pessoa?.id, token, caixa, pagina],
    enabled: enabled && isAuthenticated && !!pessoa && !!token,
    queryFn: async ({ signal }) => (await api.get<Caixa>('/mensagens', {
      signal, params: { caixa, pagina }, headers: { Authorization: `Bearer ${token}` },
    })).data,
    refetchInterval: 5000,
  });
}
export function useContatos(enabled: boolean) {
  const { pessoa, token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['mensagens-contatos', pessoa?.id, token],
    enabled: enabled && isAuthenticated && !!token,
    queryFn: async ({ signal }) => (await api.get<{ data: Contatos }>('/mensagens/contatos', {
      signal, headers: { Authorization: `Bearer ${token}` },
    })).data.data,
    refetchInterval: 10000,
  });
}
export function useEnviarMensagem() {
  const { token, pessoa } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; corpo: string; etapaDestinoId?: string; destinatarioId?: string; respostaAId?: string }) => {
      const { respostaAId, ...body } = input;
      const payload = respostaAId ? { id: body.id, corpo: body.corpo } : body;
      return (await api.post<{ data: Mensagem }>(respostaAId ? `/mensagens/${respostaAId}/responder` : '/mensagens',
        payload, { headers: { Authorization: `Bearer ${token}` } })).data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mensagens', pessoa?.id, token] }),
  });
}
export function useLerMensagem() {
  const { token, pessoa } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.patch(`/mensagens/${id}/lida`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mensagens', pessoa?.id, token] }),
  });
}
