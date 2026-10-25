import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { monthBounds } from '../services/analytics.service.js';
import { createNotificationOnce } from '../services/notification.service.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Scans the current month's budgets and notifies users whose spending has
// crossed their alert threshold. De-duplicated per category+month so it can run
// as often as we like without spamming.
export const runBudgetAlerts = async () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const { start, end } = monthBounds(year, month);

  const [budgets, grouped] = await Promise.all([
    prisma.budget.findMany({ where: { month, year } }),
    prisma.expense.groupBy({
      by: ['userId', 'category'],
      where: { date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const spent = new Map(
    grouped.map((g) => [`${g.userId}:${g.category}`, g._sum.amount ?? 0])
  );

  let sent = 0;
  for (const b of budgets) {
    const used = spent.get(`${b.userId}:${b.category}`) ?? 0;
    const usage = b.limitAmount > 0 ? used / b.limitAmount : 0;
    if (usage < b.alertThreshold) continue;

    const over = usage >= 1;
    const label = `${MONTHS[month - 1]} ${year}`;
    const created = await createNotificationOnce({
      userId: b.userId,
      type: 'budget_alert',
      title: `Budget ${over ? 'exceeded' : 'alert'}: ${b.category} (${label})`,
      message: over
        ? `You've spent Rs ${Math.round(used).toLocaleString('en-IN')} against your ` +
          `Rs ${Math.round(b.limitAmount).toLocaleString('en-IN')} ${b.category} budget — you're over the limit.`
        : `You've used ${Math.round(usage * 100)}% of your ${b.category} budget for ${label}.`,
    });
    if (created) sent++;
  }

  logger.info(`[job] budget alerts: ${sent} notification(s) created`);
  return sent;
};
