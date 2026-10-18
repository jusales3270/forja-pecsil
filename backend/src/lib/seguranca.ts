// ============================================================
// Forja - Proteções do servidor (hardening, P-07)
// ============================================================
// - Cabeçalhos de segurança (helmet). A API só devolve JSON e o frontend é
//   servido pelo nginx, então o CSP fica de fora daqui.
// - Limite de requisições por IP, folgado: serve contra enxurrada, não pode
//   atrapalhar tótem nem a sincronização do Business OS.
// - Login com limite próprio por IP + código pessoal, que só conta PIN errado:
//   o PIN é curto e não pode ser adivinhado na força bruta, e quem entra certo
//   (tótem, conta do posto) nunca é barrado.
// - CORS fechado em produção: frontend e API saem do mesmo endereço (nginx),
//   então nenhuma outra origem precisa chamar a API. CORS_ORIGINS abre exceções.
// ============================================================

import type { FastifyInstance, FastifyRequest } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';

/** Origens liberadas no CORS (API e Socket.IO). Em dev, qualquer uma. */
export function origensPermitidas(): boolean | string[] {
  if (env.CORS_ORIGINS.length) return env.CORS_ORIGINS;
  return env.NODE_ENV !== 'production';
}

/** Login: 10 tentativas ERRADAS em 5 minutos por IP + código pessoal bloqueiam por 5 minutos. Acertar zera. */
export const LIMITE_LOGIN = { max: 10, janelaMs: 5 * 60_000 };
/** Geral: por IP, por minuto. */
export const LIMITE_GERAL = 3000;

export function chaveDoLogin(request: FastifyRequest): string {
  const codigo = (request.body as { codigo_pessoal?: unknown } | undefined)?.codigo_pessoal;
  return `${request.ip}|${typeof codigo === 'string' ? codigo.trim().toLowerCase() : ''}`;
}

export async function registrarSeguranca(app: FastifyInstance) {
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } });
  await app.register(rateLimit, {
    global: true,
    max: LIMITE_GERAL,
    timeWindow: '1 minute',
    allowList: (request) => request.url === '/health',
    errorResponseBuilder: (_request, ctx) => ({
      statusCode: 429,
      error: 'muitas_requisicoes',
      message: `Muitas requisições. Tente de novo em ${Math.ceil(ctx.ttl / 1000)} s.`,
    }),
  });
}

// Tentativas erradas de login, em memória (a Forja roda numa instância só).
const falhas = new Map<string, { n: number; desde: number }>();

/** Milissegundos que faltam para liberar o login desta chave (0 = liberado). */
export function loginBloqueadoPor(chave: string, agora = Date.now()): number {
  const f = falhas.get(chave);
  if (!f) return 0;
  if (agora - f.desde > LIMITE_LOGIN.janelaMs) {
    falhas.delete(chave);
    return 0;
  }
  return f.n >= LIMITE_LOGIN.max ? LIMITE_LOGIN.janelaMs - (agora - f.desde) : 0;
}

export function registrarFalhaLogin(chave: string, agora = Date.now()) {
  const f = falhas.get(chave);
  if (!f || agora - f.desde > LIMITE_LOGIN.janelaMs) falhas.set(chave, { n: 1, desde: agora });
  else f.n += 1;
  if (falhas.size > 5000) for (const [k, v] of falhas) if (agora - v.desde > LIMITE_LOGIN.janelaMs) falhas.delete(k);
}

export function limparFalhasLogin(chave: string) {
  falhas.delete(chave);
}
