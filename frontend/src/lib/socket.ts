// ============================================================
// Forja - Cliente Socket.IO
// Singleton de conexão usado pelo tótem pra ouvir eventos da estação
// ============================================================

import { io, Socket } from 'socket.io-client';

const baseURL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('forja_token');
    socket = io(baseURL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Entra na sala de uma estação (etapa).
 * Use no `useEffect` da tela do tótem.
 */
export function joinEstacao(etapaId: string) {
  const s = getSocket();
  s.emit('join:estacao', etapaId);
}

export function leaveEstacao(etapaId: string) {
  const s = getSocket();
  s.emit('leave:estacao', etapaId);
}

// Eventos que o backend emite (mesmos tipos do backend)
export type SocketEvent =
  | { tipo: 'op_iniciada'; opLoteId: string; loteId: string; etapaId: string; maquinaId: string }
  | { tipo: 'op_encerrada'; opLoteId: string; loteId: string; etapaId: string; novoStatus: string; completou: boolean }
  | { tipo: 'op_nova_na_fila'; opLoteId: string; loteId: string; etapaId: string };
