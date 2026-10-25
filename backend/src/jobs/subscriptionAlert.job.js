import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { createNotificationOnce } from '../services/notification.service.js';
import { sendEmail } from '../services/email.service.js';

// Notifies users about active subscriptions renewing within their configured
// reminder window (reminderDays). Runs daily.
export const runSubscriptionAlerts = async () => {
  const now = new Date();
  // Look ahead by the largest reminder window we allow (30 days) and filter
  // precisely per-subscription below.
  const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const subs = await prisma.subscription.findMany({
    where: {
      isActive: true,
      nextBillingDate: { gte: now, lte: horizon },
    },
    include: { user: { select: { email: true, name: true } } },
  });

  let sent = 0;
  for (const s of subs) {
    const daysUntil = Math.ceil((new Date(s.nextBillingDate) - now) / (1000 * 60 * 60 * 24));
    if (daysUntil > s.reminderDays) continue;

    const dateLabel = new Date(s.nextBillingDate).toISOString().slice(0, 10);
    const amount = `Rs ${Math.round(s.amount).toLocaleString('en-IN')}`;
    const created = await createNotificationOnce({
      userId: s.userId,
      type: 'subscription',
      title: `${s.name} renews on ${dateLabel}`,
      message: `Your ${s.name} subscription (${amount}, ${s.billingCycle}) renews in ${daysUntil} day(s).`,
    });

    if (created) {
      sent++;
      // Best-effort email — dry-run logs when SMTP isn't configured.
      await sendEmail({
        to: s.user.email,
        subject: `Reminder: ${s.name} renews in ${daysUntil} day(s)`,
        html: `<p>Hi ${s.user.name},</p><p>Your <strong>${s.name}</strong> subscription
          (${amount}, ${s.billingCycle}) is set to renew on <strong>${dateLabel}</strong>.</p>
          <p>Cancel it in FinTrack if you no longer need it.</p>`,
      }).catch((err) => logger.error(`[job] subscription email failed: ${err.message}`));
    }
  }

  logger.info(`[job] subscription alerts: ${sent} reminder(s) created`);
  return sent;
};
