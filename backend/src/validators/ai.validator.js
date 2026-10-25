import Joi from 'joi';

export const categorizeSchema = Joi.object({
  text: Joi.string().trim().min(2).max(500).required(),
});

export const chatSchema = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().trim().min(1).max(4000).required(),
      })
    )
    .min(1)
    .max(40)
    .required(),
});

export const periodQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12),
  year: Joi.number().integer().min(2000).max(2100),
});
