import Joi from 'joi';
import { INCOME_SOURCES } from '../constants/categories.js';

const baseIncome = {
  amount: Joi.number().positive().precision(2),
  source: Joi.string().valid(...INCOME_SOURCES),
  description: Joi.string().trim().max(280).allow(null, ''),
  date: Joi.date().iso().max('now'),
  isTaxable: Joi.boolean(),
  tdsDeducted: Joi.number().min(0).precision(2).allow(null),
};

export const createIncomeSchema = Joi.object({
  ...baseIncome,
  amount: baseIncome.amount.required(),
  source: baseIncome.source.required(),
  date: baseIncome.date.default(() => new Date()),
});

export const updateIncomeSchema = Joi.object(baseIncome).min(1);

export const listIncomeQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  source: Joi.string().valid(...INCOME_SOURCES),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
});
