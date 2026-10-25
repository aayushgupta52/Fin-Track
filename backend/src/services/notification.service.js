import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

// Valid notification types (mirrors the `type` field documented on the model).
export const NOTIFICATION_TYPES = [
  'budget_alert',
  'subscription',
  'report',
  'tax',
  'fraud',
  'system',
];

// Creates a notification row. Safe to call fire-and-forget from jobs/controllers
// — failures are logged but never throw into the caller.
export const createNotification = async ({ userId, title, message, type = 'system' }) => {
  try {
    return await prisma.notification.create({
      data: { userId, title, message, type },
    });
  } catch (err) {
    logger.error(`[notification] failed to create for ${userId}: ${err.message}`);
    return null;
  }
};

// Creates a notification only if an unread one with the same title doesn't
// already exist for this user — keeps recurring jobs (budget/subscription
// alerts) from spamming the same reminder every run.
export const createNotificationOnce = async ({ userId, title, message, type }) => {
  const existing = await prisma.notification.findFirst({
    where: { userId, title, isRead: false },
    select: { id: true },
  });
  if (existing) return null;
  return createNotification({ userId, title, message, type });
};
