import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';

dotenv.config();

import { setupTelegramBot } from './bot/bot.js';
import { closeDatabase, getDatabase } from './db/database.js';
import { seedDemoData } from './db/seeder.js';
import { createAdminApiRoutes } from './routes/adminApi.js';
import { heartbeatApiRoutes } from './routes/heartbeatApi.js';
import { statusApiRoutes } from './routes/statusApi.js';
import { monitorService } from './services/monitorService.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@statuscast_updates';

async function bootstrap() {
  console.log('--- Starting StatusCast Platform ---');

  // 1. Initialize SQLite Database
  getDatabase();

  // 2. Demo data seeding
  if (process.env.DEMO_MODE !== 'false') {
    console.log('[Bootstrap] DEMO_MODE active: verifying sample status page...');
    seedDemoData();
  }

  // 3. Telegram Bot & In-Place Broadcaster setup
  const { broadcaster } = setupTelegramBot(
    process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID,
    WEBAPP_URL
  );

  // 4. Background Monitoring Engine
  const monitorInterval = parseInt(process.env.MONITOR_INTERVAL_SECONDS || '60', 10);
  monitorService.start(monitorInterval);

  // 5. Fastify Web Server
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Health probe
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  // Register REST route handlers
  await app.register(statusApiRoutes);
  await app.register(createAdminApiRoutes(broadcaster));
  await app.register(heartbeatApiRoutes);

  // 6. Serve static web frontend if built
  const possibleWebDistPaths = [
    path.join(process.cwd(), '..', 'web', 'dist'),
    path.join(process.cwd(), 'web', 'dist'),
    path.join(process.cwd(), 'dist', 'web'),
  ];

  let webDistPath: string | null = null;
  for (const p of possibleWebDistPaths) {
    if (fs.existsSync(p)) {
      webDistPath = p;
      break;
    }
  }

  if (webDistPath) {
    console.log(`[Bootstrap] Serving static web assets from ${webDistPath}`);
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
        return reply.code(404).send({ error: 'Endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    console.log('[Bootstrap] No static web dist directory found. Running API-only mode.');
  }

  // 7. Start listening
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Server] StatusCast listening on http://${HOST}:${PORT}`);
    console.log(`[Server] Status page: ${WEBAPP_URL}/?page=demo`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('[Server] Gracefully shutting down...');
    monitorService.stop();
    await app.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
