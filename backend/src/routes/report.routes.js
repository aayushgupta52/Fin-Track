import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { monthlyReportQuery, csvExportQuery } from '../validators/report.validator.js';
import { monthlyReport, exportCsv, exportPdf } from '../controllers/report.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/monthly', validate(monthlyReportQuery, 'query'), monthlyReport);
router.get('/export/csv', validate(csvExportQuery, 'query'), exportCsv);
router.get('/export/pdf', validate(monthlyReportQuery, 'query'), exportPdf);

export default router;
