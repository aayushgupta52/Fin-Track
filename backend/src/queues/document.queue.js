import { Queue } from 'bullmq';
import { redis } from '../services/redis.service.js';
import { createBullConnection } from './connection.js';
import { logger } from '../utils/logger.js';

export const DOCUMENT_QUEUE = 'document-processing';

// Created lazily, and only when Redis is actually reachable, so dev without
// Redis never spawns a noisy reconnecting client.
let queue = null;
const getQueue = () => {
  if (!queue) {
    queue = new Queue(DOCUMENT_QUEUE, { connection: createBullConnection() });
  }
  return queue;
};

// Enqueue a document for async processing. Falls back to in-process handling
// (non-blocking) when Redis/BullMQ isn't available — useful in local dev.
// Returns the mode used: 'queued' | 'inline'.
export const enqueueDocument = async (documentId) => {
  if (redis.status === 'ready') {
    try {
      await getQueue().add(
        'process',
        { documentId },
        { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
      );
      logger.info(`[queue] enqueued document ${documentId}`);
      return 'queued';
    } catch (err) {
      logger.warn(`[queue] enqueue failed, falling back to inline: ${err.message}`);
    }
  }

  // Inline fallback — dynamic import avoids loading the heavy OCR stack unless used.
  const { processDocument } = await import('../services/document.service.js');
  setImmediate(() =>
    processDocument(documentId).catch((err) =>
      logger.error(`[queue] inline processing failed: ${err.message}`)
    )
  );
  return 'inline';
};
