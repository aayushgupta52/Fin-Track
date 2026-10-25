import Joi from 'joi';

// GET /api/notifications — optional isRead filter + pagination.
export const listNotificationsQuery = Joi.object({
  isRead: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
