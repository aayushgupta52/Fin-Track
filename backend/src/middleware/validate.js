import { fail } from '../utils/response.js';

// Joi validation wrapper. Usage: validate(schema, 'body' | 'query' | 'params').
export const validate =
  (schema, property = 'body') =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return fail(res, 'Validation failed', 422, errors);
    }

    req[property] = value;
    return next();
  };
