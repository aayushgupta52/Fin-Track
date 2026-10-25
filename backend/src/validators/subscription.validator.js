import Joi from 'joi';
import { CATEGORY_NAMES } from '../constants/categories.js';

const baseSubscription = {
  name: Joi.string().trim().min(1).max(80),
  amount: Joi.number().positive().precision(2),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly'),
  nextBillingDate: Joi.date().iso(),
  category: Joi.string().valid(...CATEGORY_NAMES),
  isActive: Joi.boolean(),
  reminderDays: Joi.number().integer().min(0).max(30),
  logoUrl: Joi.string().uri().allow(null, ''),
};

export const createSubscriptionSchema = Joi.object({
  ...baseSubscription,
  name: baseSubscription.name.required(),
  amount: baseSubscription.amount.required(),
  billingCycle: baseSubscription.billingCycle.default('monthly'),
  nextBillingDate: baseSubscription.nextBillingDate.required(),
  category: baseSubscription.category.default('Subscription'),
  reminderDays: baseSubscription.reminderDays.default(3),
});

export const updateSubscriptionSchema = Joi.object(baseSubscription).min(1);

export const upcomingQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(90).default(30),
});
