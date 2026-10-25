import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

const SENSITIVE_KEY_PATTERN = /(password|passwordhash|pan(number)?|token|secret|authorization|cookie|api.?key)/i;

const maskSensitive = (value) => {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== 'object') return value;
  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = SENSITIVE_KEY_PATTERN.test(key) ? '***' : maskSensitive(entry);
  }
  return clone;
};

// Records an audit log entry. Safe to call fire-and-forget — failures are
// logged but never block the request.
export const writeAuditLog = async ({ req, action, resource, resourceId, details }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        // Native Json column on PostgreSQL — store the object directly.
        details: details ? maskSensitive(details) : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
  } catch (err) {
    logger.error(`[audit] failed to write log: ${err.message}`);
  }
};
