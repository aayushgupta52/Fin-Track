import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { getMonthlyReportData, generatePdfReport } from '../services/report.service.js';
import { createNotification } from '../services/notification.service.js';
import { sendEmail } from '../services/email.service.js';

// Generates last month's report for every user, emails the PDF, and drops an
// in-app notification. Intended to run on the 1st of each month.
export const runMonthlyReports = async () => {
  const now = new Date();
  // Previous month (handles January → December rollover).
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });

  let sent = 0;
  for (const user of users) {
    try {
      const data = await getMonthlyReportData(user.id, { year, month });
      // Skip users with no activity that month.
      if (data.transactionCount === 0 && data.income === 0) continue;

      await createNotification({
        userId: user.id,
        type: 'report',
        title: `Your ${data.period} report is ready`,
        message: `Income Rs ${Math.round(data.income).toLocaleString('en-IN')}, ` +
          `expenses Rs ${Math.round(data.expenseTotal).toLocaleString('en-IN')}, ` +
          `savings rate ${Math.round(data.savingsRate * 100)}%.`,
      });

      const pdf = await generatePdfReport(data);
      await sendEmail({
        to: user.email,
        subject: `Your ${data.period} Financial Report — FinTrack`,
        html: `<p>Hi ${user.name},</p><p>Your financial report for <strong>${data.period}</strong>
          is attached. Highlights:</p>
          <ul>
            <li>Income: Rs ${Math.round(data.income).toLocaleString('en-IN')}</li>
            <li>Expenses: Rs ${Math.round(data.expenseTotal).toLocaleString('en-IN')}</li>
            <li>Net savings: Rs ${Math.round(data.netSavings).toLocaleString('en-IN')}</li>
          </ul>
          <p>— The FinTrack Team</p>`,
        attachments: [{ filename: `report-${year}-${month}.pdf`, content: pdf }],
      });
      sent++;
    } catch (err) {
      logger.error(`[job] monthly report failed for ${user.id}: ${err.message}`);
    }
  }

  logger.info(`[job] monthly reports: ${sent} report(s) delivered`);
  return sent;
};
