import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';

const buildWhere = (userId, { source, startDate, endDate }) => {
  const where = { userId };
  if (source) where.source = source;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  return where;
};

// GET /api/income
export const listIncome = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const where = buildWhere(req.user.id, req.query);
  const skip = (page - 1) * limit;

  const [items, total, sum] = await Promise.all([
    prisma.income.findMany({ where, orderBy: { date: 'desc' }, skip, take: limit }),
    prisma.income.count({ where }),
    prisma.income.aggregate({ where, _sum: { amount: true } }),
  ]);

  return ok(res, {
    items,
    totalAmount: sum._sum.amount ?? 0,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// POST /api/income
export const createIncome = asyncHandler(async (req, res) => {
  const income = await prisma.income.create({
    data: { ...req.body, userId: req.user.id },
  });
  writeAuditLog({ req, action: 'income.create', resource: 'income', resourceId: income.id });
  return created(res, { income }, 'Income added');
});

// PUT /api/income/:id
export const updateIncome = asyncHandler(async (req, res) => {
  const existing = await prisma.income.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Income not found');

  const income = await prisma.income.update({
    where: { id: req.params.id },
    data: req.body,
  });
  writeAuditLog({ req, action: 'income.update', resource: 'income', resourceId: income.id });
  return ok(res, { income }, 'Income updated');
});

// DELETE /api/income/:id
export const deleteIncome = asyncHandler(async (req, res) => {
  const existing = await prisma.income.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Income not found');

  await prisma.income.delete({ where: { id: req.params.id } });
  writeAuditLog({ req, action: 'income.delete', resource: 'income', resourceId: req.params.id });
  return ok(res, null, 'Income deleted');
});
