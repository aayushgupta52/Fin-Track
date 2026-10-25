import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetStatusQuerySchema,
} from '../validators/budget.validator.js';
import {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  budgetStatus,
} from '../controllers/budget.controller.js';

const router = Router();

router.use(authenticateJWT);

// /status before /:id so it isn't captured as an id.
router.get('/status', validate(budgetStatusQuerySchema, 'query'), budgetStatus);

router.get('/', validate(budgetStatusQuerySchema, 'query'), listBudgets);
router.post('/', validate(createBudgetSchema), createBudget);

router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateBudgetSchema),
  updateBudget
);
router.delete('/:id', validate(idParamSchema, 'params'), deleteBudget);

export default router;
