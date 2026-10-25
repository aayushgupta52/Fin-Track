import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';
import { monthBounds } from '../services/analytics.service.js';

// GET /api/budgets?month&year — defaults to the current month.
export const listBudgets = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = req.query.year ?? now.getUTCFullYear();
  const month = req.query.month ?? now.getUTCMonth() + 1;

  const budgets = await prisma.budget.findMany({
    where: { userId: req.user.id, year, month },
    orderBy: { category: 'asc' },
  });
  return ok(res, { budgets, month, year });
});

// POST /api/budgets
export const createBudget = asyncHandler(async (req, res) => {
  // One budget per category+period for a given month.
  const clash = await prisma.budget.findFirst({
    where: {
      userId: req.user.id,
      category: req.body.category,
      month: req.body.month,
      year: req.body.year,
    },
    select: { id: true },
  });
  if (clash) throw new ApiError(409, 'A budget for this category and month already exists');

  const budget = await prisma.budget.create({
    data: { ...req.body, userId: req.user.id },
  });
  writeAuditLog({ req, action: 'budget.create', resource: 'budget', resourceId: budget.id });
  return created(res, { budget }, 'Budget created');
});

// PUT /api/budgets/:id
export const updateBudget = asyncHandler(async (req, res) => {
  const existing = await prisma.budget.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Budget not found');

  const budget = await prisma.budget.update({
    where: { id: req.params.id },
    data: req.body,
  });
  writeAuditLog({ req, action: 'budget.update', resource: 'budget', resourceId: budget.id });
  return ok(res, { budget }, 'Budget updated');
});

// DELETE /api/budgets/:id
export const deleteBudget = asyncHandler(async (req, res) => {
  const existing = await prisma.budget.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Budget not found');

  await prisma.budget.delete({ where: { id: req.params.id } });
  writeAuditLog({ req, action: 'budget.delete', resource: 'budget', resourceId: req.params.id });
  return ok(res, null, 'Budget deleted');
});

// GET /api/budgets/status?month&year
// Each budget paired with its actual spend so the UI can draw usage bars.
export const budgetStatus = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = req.query.year ?? now.getUTCFullYear();
  const month = req.query.month ?? now.getUTCMonth() + 1;
  const { start, end } = monthBounds(year, month);

  const [budgets, grouped] = await Promise.all([
    prisma.budget.findMany({ where: { userId: req.user.id, year, month } }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId: req.user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map(
    grouped.map((g) => [g.category, g._sum.amount ?? 0])
  );

  const items = budgets.map((b) => {
    const spent = spentByCategory.get(b.category) ?? 0;
    const usage = b.limitAmount > 0 ? spent / b.limitAmount : 0;
    return {
      ...b,
      spent,
      remaining: Math.max(0, b.limitAmount - spent),
      usage: Number(usage.toFixed(3)),
      status: usage >= 1 ? 'over' : usage >= b.alertThreshold ? 'warning' : 'ok',
    };
  });

  return ok(res, { month, year, items });
});
