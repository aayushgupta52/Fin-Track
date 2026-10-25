import { Worker } from 'bullmq';
import { DOCUMENT_QUEUE } from '../queues/document.queue.js';
import { createBullConnection } from '../queues/connection.js';
import { processDocument } from '../services/document.service.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

// Standalone process: run with `npm run worker`. Consumes document jobs and runs
// the OCR + AI extraction pipeline off the request path.
const worker = new Worker(
  DOCUMENT_QUEUE,
  async (job) => {
    logger.info(`[worker] processing document ${job.data.documentId}`);
    await processDocument(job.data.documentId);
  },
  { connection: createBullConnection(), concurrency: 2 }
);

worker.on('completed', (job) =>
  logger.info(`[worker] completed document ${job.data.documentId}`)
);
worker.on('failed', (job, err) =>
  logger.error(`[worker] failed document ${job?.data?.documentId}: ${err.message}`)
);

logger.info('[worker] document worker started');

const shutdown = async (signal) => {
  logger.info(`[worker] ${signal} received, shutting down...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
