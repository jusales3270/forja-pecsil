import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './lib/env.js';
import { registerAuth } from './lib/auth.js';
import { decorateSocketPlaceholder, attachSocketIO } from './lib/socket.js';
import { authRoutes } from './routes/auth.js';
import { tiposServicoRoutes } from './routes/tipos-servico.js';
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

  // CORS — em dev liberamos tudo
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : ['http://localhost:5173'],
    credentials: true,
  });

  // Multipart (uploads)
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // JWT
  await registerAuth(app);

  // Healthcheck
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // Rotas
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(tiposServicoRoutes, { prefix: '/api' });
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

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    // Socket.IO acoplado ao mesmo servidor HTTP (atribuído em app.io)
    attachSocketIO(app, {
      httpServer: app.server,
      corsOrigin: env.NODE_ENV === 'development' ? true : ['http://localhost:5173'],
    });

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
