import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

// Redis is optional. It's only enabled when REDIS_URL is explicitly set —
// otherwise (e.g. local offline dev) we fall back to an in-memory store for
// refresh tokens and a no-op cache, so nothing hangs trying to reach Redis.
const REDIS_URL = process.env.REDIS_URL;
const enabled = Boolean(REDIS_URL);

// When disabled, expose a stub whose `status` is never 'ready' so the queue
// and cache helpers transparently take their offline fallbacks.
export const redis = enabled
  ? new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    })
  : { status: 'disabled' };

if (enabled) {
  redis.on('connect', () => logger.info('[redis] connected'));
  redis.on('error', (err) => logger.error(`[redis] ${err.message}`));
} else {
  logger.warn('[redis] REDIS_URL not set — using in-memory refresh-token store (dev only)');
}

// ---- Refresh-token helpers -------------------------------------------------
// Refresh tokens are stored per-user so they can be rotated and revoked.
// In-memory map backs the offline path (single-process dev only).

const refreshKey = (userId) => `refresh_token:${userId}`;
const memTokens = new Map(); // userId -> { token, expiresAt }

const isLive = () => enabled && redis.status === 'ready';

export const storeRefreshToken = async (userId, token, ttlSeconds) => {
  if (isLive()) {
    await redis.set(refreshKey(userId), token, 'EX', ttlSeconds);
    return;
  }
  memTokens.set(userId, { token, expiresAt: Date.now() + ttlSeconds * 1000 });
};

export const getRefreshToken = async (userId) => {
  if (isLive()) return redis.get(refreshKey(userId));
  const entry = memTokens.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memTokens.delete(userId);
    return null;
  }
  return entry.token;
};

export const deleteRefreshToken = async (userId) => {
  if (isLive()) {
    await redis.del(refreshKey(userId));
    return;
  }
  memTokens.delete(userId);
};

// ---- Best-effort JSON cache --------------------------------------------------
// Used for expensive AI responses. These never throw or block the request: if
// Redis isn't ready they silently no-op so the caller just recomputes.

export const cacheGet = async (key) => {
  if (!isLive()) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn(`[redis] cacheGet failed: ${err.message}`);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds) => {
  if (!isLive()) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`[redis] cacheSet failed: ${err.message}`);
  }
};
