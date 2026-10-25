import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpenseQuerySchema,
  summaryQuerySchema,
} from '../validators/expense.validator.js';
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  expenseSummary,
  expenseTrends,
  financeOverview,
} from '../controllers/expense.controller.js';

const router = Router();

// All expense routes require an authenticated user.
router.use(authenticateJWT);

// Aggregations come before the :id routes so they aren't captured as ids.
router.get('/overview', validate(summaryQuerySchema, 'query'), financeOverview);
router.get('/summary', validate(summaryQuerySchema, 'query'), expenseSummary);
router.get('/trends', expenseTrends);

router.get('/', validate(listExpenseQuerySchema, 'query'), listExpenses);
router.post('/', validate(createExpenseSchema), createExpense);

router.get('/:id', validate(idParamSchema, 'params'), getExpense);
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateExpenseSchema),
  updateExpense
);
router.delete('/:id', validate(idParamSchema, 'params'), deleteExpense);

export default router;
