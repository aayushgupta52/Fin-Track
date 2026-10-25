import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { runBudgetAlerts } from './budgetAlert.job.js';
import { runSubscriptionAlerts } from './subscriptionAlert.job.js';
import { runMonthlyReports } from './monthlyReport.job.js';

// Wraps a job so a failure is logged but never crashes the scheduler.
const safe = (name, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    logger.error(`[job] ${name} crashed: ${err.message}`);
  }
};

// Registers all recurring background jobs. Called once at server startup.
// Disable in tests / when explicitly turned off via DISABLE_CRON=true.
export const startScheduledJobs = () => {
  if (process.env.DISABLE_CRON === 'true') {
    logger.info('[job] scheduler disabled (DISABLE_CRON=true)');
    return;
  }

  // Budget alerts — a few times a day (09:00 & 18:00).
  cron.schedule('0 9,18 * * *', safe('budgetAlerts', runBudgetAlerts));

  // Subscription renewal reminders — daily at 08:00.
  cron.schedule('0 8 * * *', safe('subscriptionAlerts', runSubscriptionAlerts));

  // Monthly reports — 1st of every month at 07:00.
  cron.schedule('0 7 1 * *', safe('monthlyReports', runMonthlyReports));

  logger.info('[job] scheduler started (budget, subscription, monthly-report)');
};
