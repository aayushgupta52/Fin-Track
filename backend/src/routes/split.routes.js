import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  createSplitExpenseSchema,
  createSettlementSchema,
  memberParamSchema,
  expenseParamSchema,
  settlementParamSchema,
} from '../validators/split.validator.js';
import {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  createExpense,
  deleteExpense,
  createSettlement,
  deleteSettlement,
} from '../controllers/split.controller.js';

const router = Router();

router.use(authenticateJWT);

// Groups
router.get('/groups', listGroups);
router.post('/groups', validate(createGroupSchema), createGroup);
router.get('/groups/:id', validate(idParamSchema, 'params'), getGroup);
router.put(
  '/groups/:id',
  validate(idParamSchema, 'params'),
  validate(updateGroupSchema),
  updateGroup
);
router.delete('/groups/:id', validate(idParamSchema, 'params'), deleteGroup);

// Members
router.post(
  '/groups/:id/members',
  validate(idParamSchema, 'params'),
  validate(addMemberSchema),
  addMember
);
router.delete(
  '/groups/:id/members/:memberId',
  validate(memberParamSchema, 'params'),
  removeMember
);

// Expenses
router.post(
  '/groups/:id/expenses',
  validate(idParamSchema, 'params'),
  validate(createSplitExpenseSchema),
  createExpense
);
router.delete(
  '/groups/:id/expenses/:expenseId',
  validate(expenseParamSchema, 'params'),
  deleteExpense
);

// Settlements
router.post(
  '/groups/:id/settlements',
  validate(idParamSchema, 'params'),
  validate(createSettlementSchema),
  createSettlement
);
router.delete(
  '/groups/:id/settlements/:settlementId',
  validate(settlementParamSchema, 'params'),
  deleteSettlement
);

export default router;
