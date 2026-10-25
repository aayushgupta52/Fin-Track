import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createIncomeSchema,
  updateIncomeSchema,
  listIncomeQuerySchema,
} from '../validators/income.validator.js';
import {
  listIncome,
  createIncome,
  updateIncome,
  deleteIncome,
} from '../controllers/income.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', validate(listIncomeQuerySchema, 'query'), listIncome);
router.post('/', validate(createIncomeSchema), createIncome);

router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateIncomeSchema),
  updateIncome
);
router.delete('/:id', validate(idParamSchema, 'params'), deleteIncome);

export default router;
