import { prisma } from '../config/prisma.js';

// UTC [start, end) bounds for a given month (month is 1-12).
export const monthBounds = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 1)),
});

// Aggregates a user's finances for one month into a compact object that the AI
// prompts, dashboard, and health-score logic all consume. The app is built
// around the user's declared monthly income (User.monthlyIncome) — the single
// source of truth for remaining balance and savings rate.
export const getMonthlySummary = async (userId, { year, month } = {}) => {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;
  const { start, end } = monthBounds(y, m);
  const dateRange = { gte: start, lt: end };

  const [grouped, user, expenseAgg, subsTotal] = await Promise.all([
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId, date: dateRange },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { monthlyIncome: true } }),
    prisma.expense.aggregate({
      where: { userId, date: dateRange },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: { userId, date: dateRange, category: 'Subscription' },
      _sum: { amount: true },
    }),
  ]);

  const byCategory = grouped
    .map((g) => ({
      category: g.category,
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  const income = user?.monthlyIncome ?? 0;
  const expenseTotal = expenseAgg._sum.amount ?? 0;
  const subscriptions = subsTotal._sum.amount ?? 0;
  const remainingBalance = income - expenseTotal;

  return {
    year: y,
    month: m,
    income,
    expenseTotal,
    remainingBalance,
    savings: remainingBalance > 0 ? remainingBalance : 0,
    transactionCount: expenseAgg._count._all,
    subscriptions,
    savingsRate: income > 0 ? remainingBalance / income : 0,
    byCategory,
    topCategories: byCategory.slice(0, 5).map((c) => c.category),
  };
};

// Health-score input metrics derived from a monthly summary.
export const computeHealthMetrics = (summary) => ({
  savingsRate: Number(summary.savingsRate.toFixed(3)),
  subscriptionLoad:
    summary.income > 0 ? Number((summary.subscriptions / summary.income).toFixed(3)) : 0,
  expenseToIncome:
    summary.income > 0 ? Number((summary.expenseTotal / summary.income).toFixed(3)) : null,
  categorySpread: summary.byCategory.length,
  topCategories: summary.byCategory.slice(0, 3),
});
