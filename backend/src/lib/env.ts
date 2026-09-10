import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => v || 'postgresql://forja:forja_dev_2026@postgres:5432/forja'),
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => v || 'redis://redis:6379'),
  JWT_SECRET: z
    .string()
    .optional()
    .transform((v) => (v && v.length >= 16 ? v : 'forja_dev_secret_change_in_prod_seriously')),

  // MinIO
  MINIO_ENDPOINT: z
    .string()
    .optional()
    .transform((v) => v || 'minio'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z
    .string()
    .optional()
    .transform((v) => v || 'forja_admin'),
  MINIO_SECRET_KEY: z
    .string()
    .optional()
    .transform((v) => v || 'forja_minio_dev_2026'),
  MINIO_BUCKET_DESENHOS: z
    .string()
    .optional()
    .transform((v) => v || 'forja-desenhos'),
  MINIO_BUCKET_FOTOS: z
    .string()
    .optional()
    .transform((v) => v || 'forja-fotos'),
  MINIO_PUBLIC_URL: z
    .string()
    .optional()
    .transform((v) => v || 'http://localhost:9100'),

  // Evolution API (opcional)
  EVOLUTION_API_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);
