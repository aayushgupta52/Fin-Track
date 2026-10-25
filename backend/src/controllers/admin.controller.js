import { prisma } from '../config/prisma.js';
import { ok, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';
import { publicUser } from '../utils/serialize.js';
import { env } from '../config/env.js';

// GET /api/admin/users?page&limit&search
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const where = search
    ? {
        OR: [
          { email: { contains: search } },
          { name: { contains: search } },
        ],
      }
    : {};
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isPro: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { expenses: true, incomes: true, documents: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok(res, {
    items: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: {
          expenses: true,
          incomes: true,
          budgets: true,
          subscriptions: true,
          documents: true,
        },
      },
    },
  });
  if (!user) throw new ApiError(404, 'User not found');
  return ok(res, { user: { ...publicUser(user), _count: user._count } });
});

// PUT /api/admin/users/:id/toggle-pro
export const togglePro = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, isPro: true },
  });
  if (!existing) throw new ApiError(404, 'User not found');

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isPro: !existing.isPro },
    select: { id: true, email: true, isPro: true, role: true },
  });
  writeAuditLog({
    req,
    action: 'admin.toggle_pro',
    resource: 'user',
    resourceId: user.id,
    details: { isPro: user.isPro },
  });
  return ok(res, { user }, `Pro ${user.isPro ? 'enabled' : 'disabled'}`);
});

// PUT /api/admin/users/:id/role — { role: "user" | "admin" }
export const setRole = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'User not found');

  // Guard against an admin stripping their own admin rights by accident.
  if (req.params.id === req.user.id && req.body.role !== 'admin') {
    throw new ApiError(400, 'You cannot remove your own admin role');
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: req.body.role },
    select: { id: true, email: true, role: true, isPro: true },
  });
  writeAuditLog({
    req,
    action: 'admin.set_role',
    resource: 'user',
    resourceId: user.id,
    details: { role: user.role },
  });
  return ok(res, { user }, `Role set to ${user.role}`);
});

// GET /api/admin/audit-logs?page&limit&userId&action
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, userId, action } = req.query;
  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // details is stored as a JSON string — parse it back for the client.
  const items = logs.map((l) => ({
    ...l,
    details: l.details ? safeParse(l.details) : null,
  }));

  return ok(res, {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

// GET /api/admin/stats — platform-wide analytics.
export const platformStats = asyncHandler(async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    proUsers,
    admins,
    newUsers,
    expenseAgg,
    incomeAgg,
    documents,
    notifications,
    topCategories,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPro: true } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.income.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.document.count(),
    prisma.notification.count(),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
  ]);

  return ok(res, {
    users: { total: totalUsers, pro: proUsers, admins, newThisWeek: newUsers },
    expenses: { count: expenseAgg._count._all, total: expenseAgg._sum.amount ?? 0 },
    incomes: { count: incomeAgg._count._all, total: incomeAgg._sum.amount ?? 0 },
    documents,
    notifications,
    topCategories: topCategories.map((c) => ({
      category: c.category,
      total: c._sum.amount ?? 0,
      count: c._count._all,
    })),
    recentActivity: recentLogs.map((l) => ({
      action: l.action,
      resource: l.resource,
      email: l.user?.email ?? 'system',
      createdAt: l.createdAt,
    })),
  });
});

// POST /api/admin/bootstrap — one-time admin promotion via ADMIN_SECRET_KEY.
// Not behind requireAdmin (chicken-and-egg): guarded by the secret instead.
export const bootstrapAdmin = asyncHandler(async (req, res) => {
  const { email, secret } = req.body;
  if (!env.adminSecretKey || secret !== env.adminSecretKey) {
    throw new ApiError(403, 'Invalid admin secret');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(404, 'No user with that email');

  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
    select: { id: true, email: true, role: true },
  });
  writeAuditLog({
    req,
    action: 'admin.bootstrap',
    resource: 'user',
    resourceId: updated.id,
    details: { email },
  });
  return ok(res, { user: updated }, `${email} is now an admin. Re-login to refresh your session.`);
});
