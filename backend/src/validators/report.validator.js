import Joi from 'joi';

const now = new Date();

// GET /api/reports/monthly?month&year and /export/pdf
export const monthlyReportQuery = Joi.object({
  month: Joi.number().integer().min(1).max(12).default(now.getUTCMonth() + 1),
  year: Joi.number().integer().min(2000).max(2100).default(now.getUTCFullYear()),
});

// GET /api/reports/export/csv?startDate&endDate
export const csvExportQuery = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
});
