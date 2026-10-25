import { verifyAccessToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';

// Verifies the Bearer access token and attaches req.user = { id, email, isPro, role }.
export const authenticateJWT = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 'Missing or malformed Authorization header', 401);
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      isPro: decoded.isPro,
      role: decoded.role,
    };
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    return fail(res, message, 401);
  }
};

// Restricts a route to admin users. Must run after authenticateJWT.
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return fail(res, 'Admin access required', 403);
  }
  return next();
};
