import 'dotenv/config';
import { z } from 'zod';

const DEFAULT_DB = 'postgresql://forja:forja_dev_2026@postgres:5432/forja';

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
    .transform((v) => (v && v.trim().length >= 16 ? v.trim() : 'forja_dev_secret_change_in_prod_seriously')),

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

// Garante que process.env tem a URL populada para o Prisma
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
