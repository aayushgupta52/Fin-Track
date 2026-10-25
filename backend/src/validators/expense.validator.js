import Joi from 'joi';
import {
  CATEGORY_NAMES,
  PAYMENT_METHODS,
  EXPENSE_SOURCES,
  TAX_SECTIONS,
} from '../constants/categories.js';

const baseExpense = {
  amount: Joi.number().positive().precision(2),
  currency: Joi.string().trim().uppercase().length(3),
  category: Joi.string().valid(...CATEGORY_NAMES),
  subcategory: Joi.string().trim().max(60).allow(null, ''),
  description: Joi.string().trim().max(280).allow(null, ''),
  merchant: Joi.string().trim().max(120).allow(null, ''),
  date: Joi.date().iso().max('now'),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).allow(null),
  upiId: Joi.string().trim().max(120).allow(null, ''),
  isRecurring: Joi.boolean(),
  isTaxDeductible: Joi.boolean(),
  taxSection: Joi.string().valid(...TAX_SECTIONS).allow(null),
  receiptUrl: Joi.string().uri().allow(null, ''),
  source: Joi.string().valid(...EXPENSE_SOURCES),
  tags: Joi.array().items(Joi.string().trim().max(40)).max(20),
};

export const createExpenseSchema = Joi.object({
  ...baseExpense,
  amount: baseExpense.amount.required(),
  category: baseExpense.category.required(),
  date: baseExpense.date.default(() => new Date()),
});

// Every field optional on update, but at least one must be present.
export const updateExpenseSchema = Joi.object(baseExpense).min(1);

export const listExpenseQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().valid(...CATEGORY_NAMES),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  search: Joi.string().trim().max(120),
});

export const summaryQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100),
});
