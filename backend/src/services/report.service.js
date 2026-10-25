import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma.js';
import { getMonthlySummary, monthBounds } from './analytics.service.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ₹ formatting without relying on locale data being present on the host.
const inr = (n) => `Rs ${Math.round(n || 0).toLocaleString('en-IN')}`;

// Assembles everything a monthly report needs: totals, category breakdown,
// income by source, and budget adherence.
export const getMonthlyReportData = async (userId, { year, month } = {}) => {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;
  const { start, end } = monthBounds(y, m);
  const dateRange = { gte: start, lt: end };

  const [user, summary, incomes, budgets, topExpenses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    getMonthlySummary(userId, { year: y, month: m }),
    prisma.income.groupBy({
      by: ['source'],
      where: { userId, date: dateRange },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({ where: { userId, month: m, year: y } }),
    prisma.expense.findMany({
      where: { userId, date: dateRange },
      orderBy: { amount: 'desc' },
      take: 10,
      select: { date: true, merchant: true, category: true, amount: true },
    }),
  ]);

  // Match each budget against actual spend in its category.
  const spentByCategory = Object.fromEntries(
    summary.byCategory.map((c) => [c.category, c.total])
  );
  const budgetStatus = budgets.map((b) => {
    const spent = spentByCategory[b.category] ?? 0;
    return {
      category: b.category,
      limit: b.limitAmount,
      spent,
      usage: b.limitAmount > 0 ? spent / b.limitAmount : 0,
      overBudget: spent > b.limitAmount,
    };
  });

  const netSavings = summary.income - summary.expenseTotal;

  return {
    user,
    year: y,
    month: m,
    monthName: MONTH_NAMES[m - 1],
    period: `${MONTH_NAMES[m - 1]} ${y}`,
    income: summary.income,
    expenseTotal: summary.expenseTotal,
    netSavings,
    savingsRate: summary.savingsRate,
    transactionCount: summary.transactionCount,
    byCategory: summary.byCategory,
    incomeBySource: incomes.map((i) => ({ source: i.source, total: i._sum.amount ?? 0 })),
    budgetStatus,
    topExpenses,
  };
};

// Builds a CSV of raw expenses for a date range. Values are quote-escaped.
export const buildExpensesCsv = async (userId, { startDate, endDate } = {}) => {
  const where = { userId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const headers = [
    'Date', 'Merchant', 'Category', 'Subcategory', 'Description',
    'Amount', 'Currency', 'Payment Method', 'Tax Deductible', 'Tax Section', 'Source',
  ];

  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = expenses.map((e) =>
    [
      new Date(e.date).toISOString().slice(0, 10),
      e.merchant,
      e.category,
      e.subcategory,
      e.description,
      e.amount,
      e.currency,
      e.paymentMethod,
      e.isTaxDeductible ? 'Yes' : 'No',
      e.taxSection,
      e.source,
    ]
      .map(esc)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

// Renders a monthly report to a PDF Buffer using PDFKit.
export const generatePdfReport = (data) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brand = '#4f46e5';
    const muted = '#64748b';

    // Header
    doc.fillColor(brand).fontSize(22).text('FinTrack', { continued: true });
    doc.fillColor(muted).fontSize(12).text('  — Monthly Financial Report');
    doc.moveDown(0.3);
    doc.fillColor('#0f172a').fontSize(16).text(data.period);
    doc.fillColor(muted).fontSize(10).text(`Prepared for ${data.user?.name ?? 'you'}`);
    doc.moveDown(1);

    // Summary boxes (simple key/value rows)
    const summaryRows = [
      ['Total Income', inr(data.income)],
      ['Total Expenses', inr(data.expenseTotal)],
      ['Net Savings', inr(data.netSavings)],
      ['Savings Rate', `${Math.round(data.savingsRate * 100)}%`],
      ['Transactions', String(data.transactionCount)],
    ];
    doc.fillColor('#0f172a').fontSize(13).text('Overview');
    doc.moveDown(0.4);
    summaryRows.forEach(([label, value]) => {
      doc.fontSize(11).fillColor(muted).text(label, { continued: true });
      doc.fillColor('#0f172a').text(`   ${value}`);
    });
    doc.moveDown(1);

    // Spending by category
    doc.fillColor('#0f172a').fontSize(13).text('Spending by Category');
    doc.moveDown(0.4);
    if (data.byCategory.length === 0) {
      doc.fontSize(11).fillColor(muted).text('No expenses recorded this month.');
    } else {
      data.byCategory.forEach((c) => {
        const pct =
          data.expenseTotal > 0 ? Math.round((c.total / data.expenseTotal) * 100) : 0;
        doc.fontSize(11).fillColor('#0f172a').text(c.category, { continued: true });
        doc.fillColor(muted).text(`   ${inr(c.total)}  (${pct}%, ${c.count} txns)`);
      });
    }
    doc.moveDown(1);

    // Budget adherence
    if (data.budgetStatus.length > 0) {
      doc.fillColor('#0f172a').fontSize(13).text('Budget Adherence');
      doc.moveDown(0.4);
      data.budgetStatus.forEach((b) => {
        const state = b.overBudget ? 'OVER' : 'ok';
        doc.fontSize(11).fillColor('#0f172a').text(b.category, { continued: true });
        doc
          .fillColor(b.overBudget ? '#dc2626' : muted)
          .text(`   ${inr(b.spent)} / ${inr(b.limit)}  (${Math.round(b.usage * 100)}%, ${state})`);
      });
      doc.moveDown(1);
    }

    // Top expenses
    if (data.topExpenses.length > 0) {
      doc.fillColor('#0f172a').fontSize(13).text('Top Expenses');
      doc.moveDown(0.4);
      data.topExpenses.forEach((e) => {
        const d = new Date(e.date).toISOString().slice(0, 10);
        doc
          .fontSize(10)
          .fillColor(muted)
          .text(`${d}  `, { continued: true })
          .fillColor('#0f172a')
          .text(`${e.merchant ?? e.category}`, { continued: true })
          .fillColor(muted)
          .text(`   ${inr(e.amount)}`);
      });
      doc.moveDown(1);
    }

    doc
      .fontSize(9)
      .fillColor(muted)
      .text(
        'Generated by FinTrack — AI Personal Finance & Tax Assistant. This report is for informational purposes only.',
        { align: 'center' }
      );

    doc.end();
  });
