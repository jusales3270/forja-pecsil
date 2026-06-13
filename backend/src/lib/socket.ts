// ============================================================
// Forja - Helper de Socket.IO no Fastify
// Permite acessar `app.io` nas rotas pra emitir eventos em tempo real
// ============================================================

import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

// Estende o tipo do Fastify pra incluir o `io`.
// É opcional porque é populado em tempo de execução, depois que o HTTP server existe.
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

/**
 * Decora o Fastify com um placeholder `io`. Precisa ser chamado ANTES
 * de qualquer rota que use `app.io`, e antes de `app.listen()`.
 * O valor real é atribuído depois via `attachSocketIO`.
 */
export function decorateSocketPlaceholder(app: FastifyInstance) {
  // Placeholder. Será substituído por attachSocketIO depois do listen.
  app.decorate('io', null as unknown as SocketIOServer);
}

export interface AttachSocketOptions {
  httpServer: HttpServer;
  corsOrigin: boolean | string[];
}

/**
 * Cria o Socket.IO server acoplado ao HTTP server do Fastify
 * e o atribui em `app.io`. Deve ser chamado APÓS `app.listen()`.
 */
export function attachSocketIO(
  app: FastifyInstance,
  options: AttachSocketOptions,
): SocketIOServer {
  const io = new SocketIOServer(options.httpServer, {
    cors: {
      origin: options.corsOrigin,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    app.log.info(`🔌 Socket conectado: ${socket.id}`);

    // Sala por estação (etapa) — programadores se inscrevem na estação deles
    // pra receber atualizações em tempo real
    socket.on('join:estacao', (etapaId: string) => {
      if (typeof etapaId === 'string' && etapaId.length > 0) {
        socket.join(`estacao:${etapaId}`);
        app.log.info(`🔌 Socket ${socket.id} entrou em estacao:${etapaId}`);
      }
    });

    socket.on('leave:estacao', (etapaId: string) => {
      if (typeof etapaId === 'string' && etapaId.length > 0) {
        socket.leave(`estacao:${etapaId}`);
      }
    });

    socket.on('disconnect', () => {
      app.log.info(`🔌 Socket desconectado: ${socket.id}`);
    });
  });

  // Substitui o placeholder pelo io real
  (app as any).io = io;

  return io;
}

// ============================================================
// Tipos de eventos emitidos (referência pra frontend)
// ============================================================

export type SocketEvent =
  | { tipo: 'op_iniciada'; opLoteId: string; loteId: string; etapaId: string }
  | { tipo: 'op_encerrada'; opLoteId: string; loteId: string; etapaId: string }
  | { tipo: 'lote_avancou'; loteId: string; etapaAnteriorId: string; etapaNovaId: string | null };
