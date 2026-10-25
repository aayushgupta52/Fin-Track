import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Za-z]/, 'letter')
    .pattern(/\d/, 'number')
    .required()
    .messages({
      'string.pattern.name': 'Password must contain at least one {#name}',
    }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(), // may also arrive via httpOnly cookie
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  monthlyIncome: Joi.number().positive().max(1_000_000_000).precision(2),
  taxRegime: Joi.string().valid('old', 'new'),
  annualIncome: Joi.number().positive().max(1_000_000_000).precision(2),
}).min(1);
