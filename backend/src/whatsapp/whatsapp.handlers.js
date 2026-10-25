// WhatsApp message handlers: command routing + natural-language expense capture.
//
// A WhatsApp message is authenticated by phone number, not JWT — so we link an
// incoming JID to a FinTrack user through the existing User.phone field. No
// schema change is required. If the number isn't linked, we tell the user how.

import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { callGroqJSON, isGroqConfigured } from '../services/groq.service.js';
import { CATEGORIZATION_PROMPT } from '../constants/prompts.js';
import { CATEGORY_NAMES, PAYMENT_METHODS } from '../constants/categories.js';

// ── Small formatting/date helpers ───────────────────────────────────────────
const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

// Last 10 digits uniquely identify an Indian mobile regardless of the +91 / 0
// prefixes that may or may not be stored on the user record.
const local10 = (jid) => jid.split('@')[0].replace(/\D/g, '').slice(-10);

// ── User linking ────────────────────────────────────────────────────────────
const findUserByJid = async (jid) => {
  const digits = local10(jid);
  if (digits.length < 10) return null;
  return prisma.user.findFirst({ where: { phone: { contains: digits } } });
};

// ── Aggregation helpers ─────────────────────────────────────────────────────
const sumExpenses = async (userId, since) => {
  const where = { userId, ...(since ? { date: { gte: since } } : {}) };
  const [agg, count] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.count({ where }),
  ]);
  return { total: agg._sum.amount || 0, count };
};

const topCategories = async (userId, since, take = 3) => {
  const rows = await prisma.expense.groupBy({
    by: ['category'],
    where: { userId, date: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take,
  });
  return rows.map((r) => ({ category: r.category, total: r._sum.amount || 0 }));
};

// ── Commands ────────────────────────────────────────────────────────────────
const HELP_TEXT = [
  '🤖 *FinTrack WhatsApp*',
  '',
  'Just text me an expense in plain English:',
  '   _“spent 450 on zomato”_  ·  _“uber 220”_  ·  _“lic premium 12000”_',
  '',
  'Commands:',
  '• *balance* — this month income vs spend',
  '• *today* — today’s total',
  '• *month* — this month’s total + top categories',
  '• *report* — quick monthly summary',
  '• *delete last* — remove your most recent expense',
  '• *help* — show this message',
].join('\n');

const cmdBalance = async (user) => {
  const since = startOfMonth();
  const [spent, incomeAgg] = await Promise.all([
    sumExpenses(user.id, since),
    prisma.income.aggregate({ where: { userId: user.id, date: { gte: since } }, _sum: { amount: true } }),
  ]);
  const income = incomeAgg._sum.amount || 0;
  const net = income - spent.total;
  return [
    `📊 *This month*`,
    `Income:  ${formatINR(income)}`,
    `Spent:   ${formatINR(spent.total)} (${spent.count} txns)`,
    `Net:     ${net >= 0 ? '🟢 ' : '🔴 '}${formatINR(net)}`,
  ].join('\n');
};

const cmdToday = async (user) => {
  const { total, count } = await sumExpenses(user.id, startOfToday());
  return `📅 *Today*: ${formatINR(total)} across ${count} expense${count === 1 ? '' : 's'}.`;
};

const cmdMonth = async (user) => {
  const since = startOfMonth();
  const [{ total, count }, tops] = await Promise.all([
    sumExpenses(user.id, since),
    topCategories(user.id, since),
  ]);
  const lines = [`🗓️ *This month*: ${formatINR(total)} (${count} txns)`];
  if (tops.length) {
    lines.push('', 'Top categories:');
    tops.forEach((t, i) => lines.push(`${i + 1}. ${t.category} — ${formatINR(t.total)}`));
  }
  return lines.join('\n');
};

const cmdReport = async (user) => {
  const since = startOfMonth();
  const [{ total, count }, tops, incomeAgg] = await Promise.all([
    sumExpenses(user.id, since),
    topCategories(user.id, since, 5),
    prisma.income.aggregate({ where: { userId: user.id, date: { gte: since } }, _sum: { amount: true } }),
  ]);
  const income = incomeAgg._sum.amount || 0;
  const monthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const lines = [
    `📈 *${monthName} report*`,
    `Income: ${formatINR(income)}  ·  Spent: ${formatINR(total)} (${count} txns)`,
    `Savings: ${formatINR(income - total)}`,
  ];
  if (tops.length) {
    lines.push('', 'Where it went:');
    tops.forEach((t) => lines.push(`• ${t.category}: ${formatINR(t.total)}`));
  }
  return lines.join('\n');
};

const cmdDeleteLast = async (user) => {
  const last = await prisma.expense.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!last) return 'Nothing to delete — you have no expenses yet.';
  await prisma.expense.delete({ where: { id: last.id } });
  return `🗑️ Deleted: ${formatINR(last.amount)} · ${last.category}${last.merchant ? ` · ${last.merchant}` : ''}.`;
};

// Exact-match command table (checked before falling back to AI parsing).
const COMMANDS = {
  help: cmdHelp,
  balance: cmdBalance,
  today: cmdToday,
  month: cmdMonth,
  report: cmdReport,
  'delete last': cmdDeleteLast,
};
function cmdHelp() {
  return HELP_TEXT;
}

// ── Natural-language expense capture ────────────────────────────────────────
const clampCategory = (c) => (CATEGORY_NAMES.includes(c) ? c : 'Other');
const clampPayment = (p) => (PAYMENT_METHODS.includes(p) ? p : 'UPI');

const parseAndStoreExpense = async (user, text) => {
  if (!isGroqConfigured()) {
    return '⚠️ AI parsing is unavailable right now. Try again later.';
  }

  let parsed;
  try {
    parsed = await callGroqJSON(CATEGORIZATION_PROMPT, text);
  } catch (err) {
    logger.error(`[whatsapp] AI parse failed: ${err.message}`);
    return "Sorry, I couldn't read that. Try like: _“spent 300 on groceries”_ or send *help*.";
  }

  // (11) Validate before writing anything to the database.
  const amount = Number(parsed?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "I couldn't find a valid amount in that. Try: _“uber 220”_.";
  }

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      amount,
      category: clampCategory(parsed.category),
      subcategory: parsed.subcategory || null,
      merchant: parsed.merchant || null,
      description: text,
      paymentMethod: clampPayment(parsed.paymentMethod),
      date: new Date(),
      isTaxDeductible: Boolean(parsed.isTaxDeductible),
      taxSection: parsed.taxSection || null,
      source: 'sms',
      aiConfidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    },
  });

  return [
    '✅ Added',
    `${formatINR(expense.amount)} · ${expense.category}${expense.merchant ? ` · ${expense.merchant}` : ''}`,
    `_via ${expense.paymentMethod}. Send *delete last* to undo._`,
  ].join('\n');
};

// ── Entry point ─────────────────────────────────────────────────────────────
/**
 * Handles one incoming private text message.
 * @param {{ from: string, text: string, reply: (body: string) => Promise<void> }} ctx
 */
export const handleIncomingMessage = async ({ from, text, reply }) => {
  const user = await findUserByJid(from);
  if (!user) {
    await reply(
      "👋 This WhatsApp number isn't linked to a FinTrack account.\n\n" +
        'Add this number under Profile → Phone in the app, then message me again.'
    );
    return;
  }

  const command = text.trim().toLowerCase();
  const handler = COMMANDS[command];

  try {
    const response = handler ? await handler(user) : await parseAndStoreExpense(user, text);
    await reply(response);
  } catch (err) {
    logger.error(`[whatsapp] handler error for user ${user.id}: ${err.message}`);
    await reply('⚠️ Something went wrong on my side. Please try again.');
  }
};
