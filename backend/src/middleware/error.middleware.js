import { fail } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';

// 404 handler for unmatched routes.
export const notFound = (req, res) =>
  fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);

// Central error handler. Must be the last middleware (4 args).
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${err.message}`);
  }

  const message =
    status >= 500 && isProd ? 'Internal server error' : err.message || 'Error';

  return fail(res, message, status, err.errors ?? null);
};
