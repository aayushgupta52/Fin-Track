import IORedis from 'ioredis';
import { env } from '../config/env.js';

// BullMQ requires a dedicated connection with maxRetriesPerRequest = null
// (blocking commands). This is separate from the app's shared redis client.
export const createBullConnection = () =>
  new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
