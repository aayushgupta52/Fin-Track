import { Router } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  listUsersQuery,
  listAuditLogsQuery,
  setRoleSchema,
  bootstrapSchema,
} from '../validators/admin.validator.js';
import {
  listUsers,
  getUser,
  togglePro,
  setRole,
  listAuditLogs,
  platformStats,
  bootstrapAdmin,
} from '../controllers/admin.controller.js';

const router = Router();

// Public but secret-guarded — used once to promote the first admin.
router.post('/bootstrap', authLimiter, validate(bootstrapSchema), bootstrapAdmin);

// Everything below requires an authenticated admin.
router.use(authenticateJWT, requireAdmin);

router.get('/stats', platformStats);
router.get('/users', validate(listUsersQuery, 'query'), listUsers);
router.get('/users/:id', validate(idParamSchema, 'params'), getUser);
router.put('/users/:id/toggle-pro', validate(idParamSchema, 'params'), togglePro);
router.put(
  '/users/:id/role',
  validate(idParamSchema, 'params'),
  validate(setRoleSchema),
  setRole
);
router.get('/audit-logs', validate(listAuditLogsQuery, 'query'), listAuditLogs);

export default router;
