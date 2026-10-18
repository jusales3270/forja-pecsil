import 'dotenv/config';
import { z } from 'zod';

const DEFAULT_DB = 'postgresql://forja:forja_dev_2026@postgres:5432/forja';
const JWT_DEV = 'forja_dev_secret_change_in_prod_seriously';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : DEFAULT_DB)),
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'redis://redis:6379')),
  JWT_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length >= 16 ? v.trim() : JWT_DEV)),

  // Origens extras liberadas no CORS, separadas por vírgula. Vazio = só o
  // próprio endereço da Forja em produção (frontend e API no mesmo nginx).
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((v) => (v ?? '').split(',').map((o) => o.trim()).filter(Boolean)),
  // Quantos proxies há na frente do backend (proxy do Coolify + nginx = 2).
  // É assim que o limite de requisições enxerga o IP de quem chama, e não o
  // do nginx. 0 = conexão direta (dev).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),

  // MinIO
  MINIO_ENDPOINT: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'minio')),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'forja_admin')),
  MINIO_SECRET_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'forja_minio_dev_2026')),
  MINIO_BUCKET_DESENHOS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'forja-desenhos')),
  MINIO_BUCKET_FOTOS: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'forja-fotos')),
  MINIO_PUBLIC_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : 'http://localhost:9100')),

  // Evolution API (opcional)
  EVOLUTION_API_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// Em produção, a chave do login não pode ser a de desenvolvimento (que está no
// código): com ela qualquer um assinaria um token de administrador.
if (env.NODE_ENV === 'production' && env.JWT_SECRET === JWT_DEV) {
  throw new Error('JWT_SECRET ausente ou curto (mínimo 16 caracteres) em produção. Configure a variável antes de subir a Forja.');
}

/** Proxies confiáveis à frente do backend: 2 em produção, 0 em dev. */
export const proxiesConfiaveis = env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 2 : 0);

// Garante que process.env tem a URL populada para o Prisma
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
