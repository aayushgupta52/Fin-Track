import Joi from 'joi';
import { CATEGORY_NAMES } from '../constants/categories.js';

const baseBudget = {
  category: Joi.string().valid(...CATEGORY_NAMES),
  limitAmount: Joi.number().positive().precision(2),
  period: Joi.string().valid('monthly', 'weekly'),
  alertThreshold: Joi.number().min(0.1).max(1),
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100),
};

const now = new Date();

export const createBudgetSchema = Joi.object({
  ...baseBudget,
  category: baseBudget.category.required(),
  limitAmount: baseBudget.limitAmount.required(),
  period: baseBudget.period.default('monthly'),
  alertThreshold: baseBudget.alertThreshold.default(0.8),
  month: baseBudget.month.default(now.getUTCMonth() + 1),
  year: baseBudget.year.default(now.getUTCFullYear()),
});

// Category/period stay fixed once created; only limit and alert tune over time.
export const updateBudgetSchema = Joi.object({
  limitAmount: baseBudget.limitAmount,
  alertThreshold: baseBudget.alertThreshold,
}).min(1);

export const budgetStatusQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100),
});
