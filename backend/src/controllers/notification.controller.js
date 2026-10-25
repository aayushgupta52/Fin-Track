import { prisma } from '../config/prisma.js';
import { ok, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';

// GET /api/notifications?isRead&page&limit
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, isRead } = req.query;
  const where = { userId: req.user.id };
  if (isRead !== undefined) where.isRead = isRead;
  const skip = (page - 1) * limit;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);

  return ok(res, {
    items,
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// PUT /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Notification not found');

  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  return ok(res, { notification }, 'Marked as read');
});

// PUT /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  return ok(res, { updated: count }, 'All notifications marked as read');
});

// DELETE /api/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Notification not found');

  await prisma.notification.delete({ where: { id: req.params.id } });
  writeAuditLog({
    req,
    action: 'notification.delete',
    resource: 'notification',
    resourceId: req.params.id,
  });
  return ok(res, null, 'Notification deleted');
});
