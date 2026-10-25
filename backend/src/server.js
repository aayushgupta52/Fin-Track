import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './utils/logger.js';
import { startScheduledJobs } from './jobs/index.js';
import { initWhatsApp } from './whatsapp/whatsapp.service.js';

const start = async () => {
  try {
    await prisma.$connect();
    logger.info('[db] connected');

    const server = app.listen(env.port, () => {
      logger.info(`[server] running on http://localhost:${env.port} (${env.nodeEnv})`);
    });

    startScheduledJobs();

    // WhatsApp gateway (no-op unless WHATSAPP_ENABLED=true). Never blocks boot.
    initWhatsApp().catch((err) => logger.error(`[whatsapp] init error: ${err.message}`));

    const shutdown = async (signal) => {
      logger.info(`[server] ${signal} received, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error(`[server] failed to start: ${err.message}`);
    process.exit(1);
  }
};

start();
