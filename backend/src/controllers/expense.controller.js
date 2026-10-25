import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';
import { serializeExpenseInput, parseExpense } from '../utils/serialize.js';
import { getMonthlySummary } from '../services/analytics.service.js';

// Builds the Prisma `where` clause for a user's expenses from query filters.
const buildWhere = (userId, { category, startDate, endDate, search }) => {
  const where = { userId };
  if (category) where.category = category;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { merchant: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
};

// GET /api/expenses
export const listExpenses = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const where = buildWhere(req.user.id, req.query);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return ok(res, {
    items: items.map(parseExpense),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/expenses/:id
export const getExpense = asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  return ok(res, { expense: parseExpense(expense) });
});

// POST /api/expenses
export const createExpense = asyncHandler(async (req, res) => {
  const expense = await prisma.expense.create({
    data: serializeExpenseInput({ ...req.body, userId: req.user.id }),
  });
  writeAuditLog({
    req,
    action: 'expense.create',
    resource: 'expense',
    resourceId: expense.id,
  });
  return created(res, { expense: parseExpense(expense) }, 'Expense added');
});

// PUT /api/expenses/:id
export const updateExpense = asyncHandler(async (req, res) => {
  // Ensure the expense belongs to the caller before mutating.
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Expense not found');

  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: serializeExpenseInput(req.body),
  });
  writeAuditLog({
    req,
    action: 'expense.update',
    resource: 'expense',
    resourceId: expense.id,
  });
  return ok(res, { expense: parseExpense(expense) }, 'Expense updated');
});

// DELETE /api/expenses/:id
export const deleteExpense = asyncHandler(async (req, res) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Expense not found');

  await prisma.expense.delete({ where: { id: req.params.id } });
  writeAuditLog({
    req,
    action: 'expense.delete',
    resource: 'expense',
    resourceId: req.params.id,
  });
  return ok(res, null, 'Expense deleted');
});

// GET /api/expenses/overview?month&year
// The core dashboard payload: income, expenses, remaining balance, savings,
// savings rate, and category breakdown — all derived from the user's declared
// monthly income. This is the single call the redesigned dashboard depends on.
export const financeOverview = asyncHandler(async (req, res) => {
  const summary = await getMonthlySummary(req.user.id, req.query);

  const spendRatio = summary.income > 0 ? summary.expenseTotal / summary.income : 0;
  // Simple, deterministic health signal (the AI verdict lives on /ai/insights).
  let health = 'healthy';
  if (summary.income === 0) health = 'unknown';
  else if (spendRatio > 1) health = 'overspending';
  else if (spendRatio > 0.8) health = 'tight';

  return ok(res, {
    month: summary.month,
    year: summary.year,
    income: summary.income,
    expenseTotal: summary.expenseTotal,
    remainingBalance: summary.remainingBalance,
    savings: summary.savings,
    savingsRate: summary.savingsRate,
    transactionCount: summary.transactionCount,
    subscriptions: summary.subscriptions,
    byCategory: summary.byCategory,
    health,
  });
});

// GET /api/expenses/summary?month&year
// Category-wise totals for a given month (defaults to current month).
export const expenseSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = req.query.year ?? now.getUTCFullYear();
  const month = req.query.month ?? now.getUTCMonth() + 1; // 1-12

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // exclusive

  const grouped = await prisma.expense.groupBy({
    by: ['category'],
    where: { userId: req.user.id, date: { gte: start, lt: end } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byCategory = grouped
    .map((g) => ({
      category: g.category,
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  const total = byCategory.reduce((sum, c) => sum + c.total, 0);

  return ok(res, { month, year, total, byCategory });
});

// GET /api/expenses/trends — last 6 months of total spend.
export const expenseTrends = asyncHandler(async (req, res) => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const expenses = await prisma.expense.findMany({
    where: { userId: req.user.id, date: { gte: start } },
    select: { amount: true, date: true },
  });

  // Seed 6 buckets so months with no spend still appear.
  const buckets = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, 0);
  }
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + e.amount);
  }

  const trends = [...buckets.entries()].map(([month, total]) => ({ month, total }));
  return ok(res, { trends });
});
