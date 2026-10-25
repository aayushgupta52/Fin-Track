import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Lazily create a transporter only when SMTP is configured. In development
// without credentials, emails are logged instead of sent.
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.email.host || !env.email.user) return null;

  transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: { user: env.email.user, pass: env.email.pass },
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, html, attachments }) => {
  const tx = getTransporter();
  if (!tx) {
    logger.info(`[email] (dry-run) "${subject}" -> ${to}`);
    return { dryRun: true };
  }
  const info = await tx.sendMail({
    from: env.email.from,
    to,
    subject,
    html,
    attachments,
  });
  logger.info(`[email] sent "${subject}" -> ${to} (${info.messageId})`);
  return info;
};

export const sendWelcomeEmail = async (user) =>
  sendEmail({
    to: user.email,
    subject: 'Welcome to FinTrack — your AI finance assistant 🎉',
    html: `
      <h2>Welcome, ${user.name}!</h2>
      <p>Your FinTrack account is ready. Start by adding an expense or uploading
      a bank statement — our AI will categorize everything for you.</p>
      <p>Happy saving,<br/>The FinTrack Team</p>
    `,
  });
