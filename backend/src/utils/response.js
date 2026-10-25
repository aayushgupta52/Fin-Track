// Standardized API response helpers.

export const ok = (res, data = null, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data });

export const created = (res, data = null, message = 'Created') =>
  ok(res, data, message, 201);

export const fail = (res, message = 'Something went wrong', status = 400, errors = null) =>
  res.status(status).json({ success: false, message, errors });

// Wraps async route handlers so thrown errors flow to the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Custom error with an attached HTTP status code.
export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
