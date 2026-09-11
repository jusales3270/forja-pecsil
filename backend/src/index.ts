import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './lib/env.js';
import { ZodError } from 'zod';
import { registerAuth } from './lib/auth.js';
import { decorateSocketPlaceholder, attachSocketIO } from './lib/socket.js';
import { authRoutes } from './routes/auth.js';
import { tiposServicoRoutes } from './routes/tipos-servico.js';
import { motivosParadaRoutes } from './routes/motivos-parada.js';
import { roteirosPadraoRoutes } from './routes/roteiros-padrao.js';
import { avisosRoutes } from './routes/avisos.js';
import { toleranciasGeraisRoutes } from './routes/tolerancias-gerais.js';
import { artigosRoutes } from './routes/artigos.js';
import { desenhosRoutes } from './routes/desenhos.js';
import { operacoesArtigoRoutes } from './routes/operacoes-artigo.js';
import { planosInspecaoRoutes } from './routes/planos-inspecao.js';
import { cotasInspecaoRoutes } from './routes/cotas-inspecao.js';
import { etapasRoutes } from './routes/etapas.js';
import { clientesRoutes } from './routes/clientes.js';
import { osRoutes } from './routes/os.js';
import { opLoteRoutes } from './routes/op-lote.js';
import { maquinasRoutes } from './routes/maquinas.js';
import { pessoasRoutes } from './routes/pessoas.js';
import { lotesFantasmasRoutes } from './routes/lotes-fantasmas.js';
import { apontamentoPecaRoutes } from './routes/apontamento-peca.js';
import { conferenciaTurnoRoutes } from './routes/conferencia-turno.js';
import { inspecaoRoutes } from './routes/inspecoes.js';
import { controleVolumeRoutes } from './routes/controle-volume.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { garantirBuckets } from './lib/storage.js';

import { prisma } from './db/prisma.js';

async function bootstrap() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : true,
  });

  // Decora `io` como placeholder ANTES de qualquer registro/start.
  // O Socket.IO real é instanciado depois do listen e atribuído em app.io.
  decorateSocketPlaceholder(app);

  // CORS — liberado para desenvolvimento e rede local
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Multipart (uploads)
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // JWT
  await registerAuth(app);

  // Error handler global: ZodError -> 400 (input invalido)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Dados invalidos',
        details: error.flatten(),
      });
    }
    app.log.error(error);
    const status = (error as any).statusCode ?? 500;
    return reply.code(status).send({
      error: status === 500 ? 'internal_error' : 'error',
      message: error.message ?? 'Erro interno',
    });
  });

  // Healthcheck
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // Rotas
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(tiposServicoRoutes, { prefix: '/api' });
  await app.register(motivosParadaRoutes, { prefix: '/api' });
  await app.register(roteirosPadraoRoutes, { prefix: '/api' });
  await app.register(avisosRoutes, { prefix: '/api' });
  await app.register(toleranciasGeraisRoutes, { prefix: '/api' });
  await app.register(artigosRoutes, { prefix: '/api' });
  await app.register(desenhosRoutes, { prefix: '/api' });
  await app.register(operacoesArtigoRoutes, { prefix: '/api' });
  await app.register(planosInspecaoRoutes, { prefix: '/api' });
  await app.register(cotasInspecaoRoutes, { prefix: '/api' });
  await app.register(etapasRoutes, { prefix: '/api' });
  await app.register(clientesRoutes, { prefix: '/api' });
  await app.register(osRoutes, { prefix: '/api' });
  await app.register(opLoteRoutes, { prefix: '/api' });
  await app.register(maquinasRoutes, { prefix: '/api' });
  await app.register(pessoasRoutes, { prefix: '/api' });
  await app.register(lotesFantasmasRoutes, { prefix: '/api' });
  await app.register(apontamentoPecaRoutes, { prefix: '/api' });
  await app.register(conferenciaTurnoRoutes, { prefix: '/api' });
  await app.register(inspecaoRoutes, { prefix: '/api' });
  await app.register(controleVolumeRoutes, { prefix: '/api' });
  await app.register(dashboardRoutes, { prefix: '/api' });

  try {
    // Inicialização não cria usuários nem restaura dados. Recuperação é uma
    // operação administrativa explícita em ops/recover-database.mjs.
    await prisma.$queryRaw`SELECT 1`;
    await app.listen({ port: env.PORT, host: env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' });

    // Socket.IO acoplado ao mesmo servidor HTTP (atribuído em app.io)
    attachSocketIO(app, {
      httpServer: app.server,
      corsOrigin: true,
    });

    garantirBuckets().catch((e) => app.log.warn({ err: e }, 'Aviso: Falha ao garantir buckets no MinIO no arranque'));

    app.log.info(`🔥 Forja backend rodando em http://localhost:${env.PORT}`);
    app.log.info(`📊 Healthcheck: http://localhost:${env.PORT}/health`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Shutdown gracioso
  const shutdown = async (signal: string) => {
    app.log.info(`📴 Recebido ${signal}, encerrando...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
