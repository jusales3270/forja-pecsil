// ============================================================
// Forja - Cliente MinIO (S3 compatible)
// ============================================================
// Usado pra armazenar desenhos (PDFs/imagens) e fotos de inspeção
// ============================================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from './env.js';

const protocol = env.MINIO_USE_SSL ? 'https' : 'http';
const endpointInterno = `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;

// Client interno: usado pra upload/delete (fala direto com o MinIO na rede docker)
export const s3 = new S3Client({
  endpoint: endpointInterno,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
});

// Client publico: usado SO pra gerar URLs assinadas que o navegador alcanca.
// Em producao aponta pro dominio publico (ex: https://host/storage).
const s3Publico = new S3Client({
  endpoint: env.MINIO_PUBLIC_URL,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
});

/**
 * Faz upload de um buffer para o MinIO.
 * Retorna metadata pra salvar no banco (bucket, key, tipo, tamanho).
 */
export async function uploadArquivo(params: {
  bucket: 'desenhos' | 'fotos';
  buffer: Buffer;
  contentType: string;
  filenameOriginal?: string;
}): Promise<{ bucket: string; key: string; tipo: string; tamanho: number }> {
  const bucketName =
    params.bucket === 'desenhos' ? env.MINIO_BUCKET_DESENHOS : env.MINIO_BUCKET_FOTOS;

  // Key: uuid + extensão (preserva extensão pra mime sniffing futuro)
  const ext = params.filenameOriginal?.match(/\.[^.]+$/)?.[0] ?? '';
  const key = `${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    })
  );

  return {
    bucket: bucketName,
    key,
    tipo: params.contentType,
    tamanho: params.buffer.length,
  };
}

/**
 * Gera URL assinada (temporária) pra acesso ao arquivo.
 * Útil pra preview/download no frontend sem expor credenciais.
 * Expiração padrão: 1 hora.
 */
export async function gerarUrlAssinada(
  bucket: string,
  key: string,
  expirarEmSegundos = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Publico, command, { expiresIn: expirarEmSegundos });
}

/**
 * URL pública direta (funciona porque os buckets são "download anonymous").
 * Mais simples mas expõe diretamente. Use pra desenhos públicos.
 */
export function urlPublica(bucket: string, key: string): string {
  return `${env.MINIO_PUBLIC_URL}/${bucket}/${key}`;
}

/**
 * Remove arquivo do MinIO.
 */
export async function removerArquivo(bucket: string, key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
