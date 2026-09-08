// ============================================================
// Forja - Rotas de Desenhos (aninhadas em Artigo)
// ============================================================
//
//   GET    /api/artigos/:artigoId/desenhos              — lista desenhos do artigo
//   POST   /api/artigos/:artigoId/desenhos              — cria desenho (sem arquivo)
//   GET    /api/artigos/:artigoId/desenhos/:id          — detalhe
//   PATCH  /api/artigos/:artigoId/desenhos/:id          — atualiza metadados
//   DELETE /api/artigos/:artigoId/desenhos/:id          — remove (e apaga arquivo do MinIO)
//   POST   /api/artigos/:artigoId/desenhos/:id/arquivo  — anexa/substitui arquivo
//   GET    /api/artigos/:artigoId/desenhos/:id/arquivo  — stream direto do arquivo (preview/download)
//   GET    /api/artigos/:artigoId/desenhos/:id/url      — URL assinada pra download
// ============================================================

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { TipoDesenho } from '@prisma/client';
import { uploadArquivo, gerarUrlAssinada, removerArquivo, obterArquivoStream } from '../lib/storage.js';


const TAMANHO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const CONTENT_TYPES_PERMITIDOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const tipoDesenhoEnum = z.enum(['cliente', 'forma', 'acompanhamento_dim']);

const criarDesenhoSchema = z.object({
  tipo: tipoDesenhoEnum,
  codigoDesenho: z.string().min(1, 'Código do desenho é obrigatório').max(200),
  revisao: z.string().min(1, 'Revisão é obrigatória').max(50),
  dataRevisao: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  observacoes: z.string().max(2000).nullable().optional(),
});

const atualizarDesenhoSchema = criarDesenhoSchema.partial();

async function garantirArtigoExiste(artigoId: string) {
  return prisma.artigo.findUnique({
    where: { id: artigoId },
    select: { id: true, ativo: true },
  });
}

export async function desenhosRoutes(app: FastifyInstance) {
  // ---------------- LISTA ----------------
  app.get(
    '/artigos/:artigoId/desenhos',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
        });
      }

      const desenhos = await prisma.desenho.findMany({
        where: { artigoId },
        orderBy: [{ tipo: 'asc' }, { codigoDesenho: 'asc' }, { revisao: 'asc' }],
      });

      return { data: desenhos };
    }
  );

  // ---------------- DETALHE ----------------
  app.get(
    '/artigos/:artigoId/desenhos/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const desenho = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!desenho) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      return { data: desenho };
    }
  );

  // ---------------- CRIAR ----------------
  app.post(
    '/artigos/:artigoId/desenhos',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId } = request.params as { artigoId: string };

      const artigo = await garantirArtigoExiste(artigoId);
      if (!artigo) {
        return reply.code(404).send({
          error: 'artigo_nao_encontrado',
          message: 'Artigo não encontrado',
        });
      }

      const parsed = criarDesenhoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const existente = await prisma.desenho.findFirst({
        where: {
          artigoId,
          tipo: parsed.data.tipo as TipoDesenho,
          codigoDesenho: parsed.data.codigoDesenho,
          revisao: parsed.data.revisao,
        },
      });

      if (existente) {
        return reply.code(409).send({
          error: 'duplicate_desenho',
          message: `Já existe um desenho ${parsed.data.tipo} "${parsed.data.codigoDesenho}" revisão "${parsed.data.revisao}" para esse artigo`,
        });
      }

      const desenho = await prisma.desenho.create({
        data: {
          artigoId,
          tipo: parsed.data.tipo as TipoDesenho,
          codigoDesenho: parsed.data.codigoDesenho,
          revisao: parsed.data.revisao,
          dataRevisao: parsed.data.dataRevisao
            ? new Date(parsed.data.dataRevisao)
            : null,
          observacoes: parsed.data.observacoes,
        },
      });

      return reply.code(201).send({ data: desenho });
    }
  );

  // ---------------- ATUALIZAR ----------------
  app.patch(
    '/artigos/:artigoId/desenhos/:id',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const parsed = atualizarDesenhoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos',
          issues: parsed.error.issues,
        });
      }

      const atual = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!atual) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      const novoTipo = (parsed.data.tipo ?? atual.tipo) as TipoDesenho;
      const novoCodigo = parsed.data.codigoDesenho ?? atual.codigoDesenho;
      const novaRevisao = parsed.data.revisao ?? atual.revisao;

      const mudouChave =
        novoTipo !== atual.tipo ||
        novoCodigo !== atual.codigoDesenho ||
        novaRevisao !== atual.revisao;

      if (mudouChave) {
        const conflito = await prisma.desenho.findFirst({
          where: {
            artigoId,
            tipo: novoTipo,
            codigoDesenho: novoCodigo,
            revisao: novaRevisao,
            NOT: { id },
          },
        });

        if (conflito) {
          return reply.code(409).send({
            error: 'duplicate_desenho',
            message: `Já existe um desenho ${novoTipo} "${novoCodigo}" revisão "${novaRevisao}" para esse artigo`,
          });
        }
      }

      const atualizado = await prisma.desenho.update({
        where: { id },
        data: {
          tipo: parsed.data.tipo as TipoDesenho | undefined,
          codigoDesenho: parsed.data.codigoDesenho,
          revisao: parsed.data.revisao,
          dataRevisao:
            parsed.data.dataRevisao === undefined
              ? undefined
              : parsed.data.dataRevisao
                ? new Date(parsed.data.dataRevisao)
                : null,
          observacoes: parsed.data.observacoes,
        },
      });

      return { data: atualizado };
    }
  );

  // ---------------- DELETAR ----------------
  app.delete(
    '/artigos/:artigoId/desenhos/:id',
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const desenho = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!desenho) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      if (desenho.arquivoBucket && desenho.arquivoKey) {
        try {
          await removerArquivo(desenho.arquivoBucket, desenho.arquivoKey);
        } catch (err) {
          app.log.warn(
            { err, bucket: desenho.arquivoBucket, key: desenho.arquivoKey },
            'Falha ao remover arquivo do MinIO (continuando com delete do DB)'
          );
        }
      }

      await prisma.desenho.delete({ where: { id } });

      return reply.code(204).send();
    }
  );

  // ---------------- ANEXAR / SUBSTITUIR ARQUIVO ----------------
  app.post(
    '/artigos/:artigoId/desenhos/:id/arquivo',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const desenho = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!desenho) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          error: 'arquivo_ausente',
          message: 'Nenhum arquivo enviado (envie como multipart/form-data, campo "arquivo")',
        });
      }

      if (!CONTENT_TYPES_PERMITIDOS.includes(data.mimetype)) {
        return reply.code(415).send({
          error: 'tipo_arquivo_nao_suportado',
          message: `Tipo "${data.mimetype}" não suportado. Permitidos: ${CONTENT_TYPES_PERMITIDOS.join(', ')}`,
        });
      }

      const buffer = await data.toBuffer();

      if (buffer.length > TAMANHO_MAX_BYTES) {
        return reply.code(413).send({
          error: 'arquivo_muito_grande',
          message: `Arquivo excede o limite de ${TAMANHO_MAX_BYTES / 1024 / 1024} MB`,
        });
      }

      if (desenho.arquivoBucket && desenho.arquivoKey) {
        try {
          await removerArquivo(desenho.arquivoBucket, desenho.arquivoKey);
        } catch (err) {
          app.log.warn(
            { err, bucket: desenho.arquivoBucket, key: desenho.arquivoKey },
            'Falha ao remover arquivo antigo'
          );
        }
      }

      const uploaded = await uploadArquivo({
        bucket: 'desenhos',
        buffer,
        contentType: data.mimetype,
        filenameOriginal: data.filename,
      });

      const atualizado = await prisma.desenho.update({
        where: { id },
        data: {
          arquivoBucket: uploaded.bucket,
          arquivoKey: uploaded.key,
          arquivoTipo: uploaded.tipo,
          arquivoTamanho: uploaded.tamanho,
          arquivoNomeOriginal: data.filename,
        },
      });

      return { data: atualizado };
    }
  );

  // ---------------- STREAM DIRETO DO ARQUIVO (DOWNLOAD / PREVIEW) ----------------
  app.get(
    '/artigos/:artigoId/desenhos/:id/arquivo',
    async (request: any, reply: any) => {
      // Aceita token via header Authorization ou query parameter `?token=...`
      try {
        if (!request.headers.authorization && request.query?.token) {
          request.headers.authorization = `Bearer ${request.query.token}`;
        }
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({
          error: 'unauthorized',
          message: 'Token inválido ou ausente para download do desenho',
        });
      }

      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const desenho = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!desenho) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      if (!desenho.arquivoBucket || !desenho.arquivoKey) {
        return reply.code(404).send({
          error: 'arquivo_nao_anexado',
          message: 'Este desenho ainda não tem arquivo anexado',
        });
      }

      try {
        const s3Response = await obterArquivoStream(desenho.arquivoBucket, desenho.arquivoKey);
        if (!s3Response.Body) {
          return reply.code(404).send({
            error: 'arquivo_nao_encontrado_storage',
            message: 'Arquivo não encontrado no servidor de armazenamento',
          });
        }

        const nomeArquivo = encodeURIComponent(desenho.arquivoNomeOriginal ?? `${desenho.codigoDesenho}-${desenho.revisao}`);
        reply
          .header('Content-Type', desenho.arquivoTipo || 'application/octet-stream')
          .header('Content-Disposition', `inline; filename="${nomeArquivo}"`)
          .header('Cache-Control', 'private, max-age=3600');

        return reply.send(s3Response.Body);
      } catch (err) {
        app.log.error({ err, bucket: desenho.arquivoBucket, key: desenho.arquivoKey }, 'Erro ao obter arquivo do MinIO');
        return reply.code(500).send({
          error: 'storage_error',
          message: 'Erro ao buscar arquivo no servidor de armazenamento',
        });
      }
    }
  );

  // ---------------- URL ASSINADA PRA DOWNLOAD ----------------
  app.get(
    '/artigos/:artigoId/desenhos/:id/url',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { artigoId, id } = request.params as { artigoId: string; id: string };

      const desenho = await prisma.desenho.findFirst({
        where: { id, artigoId },
      });

      if (!desenho) {
        return reply.code(404).send({
          error: 'desenho_nao_encontrado',
          message: 'Desenho não encontrado',
        });
      }

      if (!desenho.arquivoBucket || !desenho.arquivoKey) {
        return reply.code(404).send({
          error: 'arquivo_nao_anexado',
          message: 'Este desenho ainda não tem arquivo anexado',
        });
      }

      const url = await gerarUrlAssinada(desenho.arquivoBucket, desenho.arquivoKey);

      return { data: { url, expiraEm: 3600 } };
    }
  );
}

