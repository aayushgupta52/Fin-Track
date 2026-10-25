import Joi from 'joi';

// Validates a `:id` route param. cuid() is a loose check that the value looks
// like a Prisma cuid (starts with 'c', alphanumeric) rather than empty/garbage.
export const idParamSchema = Joi.object({
  id: Joi.string().trim().min(1).max(40).required(),
});
