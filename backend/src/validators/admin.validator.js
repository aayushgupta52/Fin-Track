import Joi from 'joi';

// GET /api/admin/users
export const listUsersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow(''),
});

// GET /api/admin/audit-logs
export const listAuditLogsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(30),
  userId: Joi.string().trim(),
  action: Joi.string().trim(),
});

// PUT /api/admin/users/:id/role
export const setRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'admin').required(),
});

// POST /api/admin/bootstrap
export const bootstrapSchema = Joi.object({
  email: Joi.string().email().required(),
  secret: Joi.string().required(),
});
