import { ok, asyncHandler } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';
import {
  getMonthlyReportData,
  buildExpensesCsv,
  generatePdfReport,
} from '../services/report.service.js';

// GET /api/reports/monthly?month&year
export const monthlyReport = asyncHandler(async (req, res) => {
  const data = await getMonthlyReportData(req.user.id, req.query);
  return ok(res, { report: data });
});

// GET /api/reports/export/csv?startDate&endDate
export const exportCsv = asyncHandler(async (req, res) => {
  const csv = await buildExpensesCsv(req.user.id, req.query);
  writeAuditLog({ req, action: 'report.export.csv', resource: 'report' });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fintrack-expenses.csv"');
  return res.send(csv);
});

// GET /api/reports/export/pdf?month&year
export const exportPdf = asyncHandler(async (req, res) => {
  const data = await getMonthlyReportData(req.user.id, req.query);
  const pdf = await generatePdfReport(data);
  writeAuditLog({ req, action: 'report.export.pdf', resource: 'report' });

  const filename = `fintrack-report-${data.year}-${String(data.month).padStart(2, '0')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(pdf);
});
