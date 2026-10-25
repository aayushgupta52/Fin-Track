import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env, isProd } from '../config/env.js';
import { asyncHandler, ok, created, ApiError } from '../utils/response.js';
import { publicUser } from '../utils/serialize.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog } from '../middleware/audit.js';
import { sendWelcomeEmail } from '../services/email.service.js';
import {
  storeRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} from '../services/redis.service.js';
import {
  issueTokenPair,
  verifyRefreshToken,
  expiryToSeconds,
} from '../utils/jwt.js';

const REFRESH_COOKIE = 'refreshToken';
const refreshTtl = expiryToSeconds(env.jwt.refreshExpiry);

// Sets the refresh token as an httpOnly cookie (never exposed to JS).
const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: refreshTtl * 1000,
    path: '/api/auth',
  });
};

// Issues a token pair, persists the refresh token in Redis, sets the cookie.
const grantSession = async (res, user) => {
  const { accessToken, refreshToken } = issueTokenPair(user);
  await storeRefreshToken(user.id, refreshToken, refreshTtl);
  setRefreshCookie(res, refreshToken);
  return { accessToken, refreshToken };
};

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const { accessToken } = await grantSession(res, user);

  // Fire-and-forget side effects.
  sendWelcomeEmail(user).catch((e) => logger.error(`[welcome email] ${e.message}`));
  writeAuditLog({ req, action: 'register', resource: 'user', resourceId: user.id });

  return created(res, { user: publicUser(user), accessToken }, 'Account created');
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new ApiError(401, 'Invalid email or password');

  const { accessToken } = await grantSession(res, user);

  writeAuditLog({ req, action: 'login', resource: 'user', resourceId: user.id });

  return ok(res, { user: publicUser(user), accessToken }, 'Logged in');
});

// GET /api/auth/google/callback  (runs after passport authenticates)
export const googleCallback = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, 'Google authentication failed');

  const { accessToken } = await grantSession(res, user);
  writeAuditLog({ req, action: 'login_google', resource: 'user', resourceId: user.id });

  // Redirect back to the frontend with the access token in the URL fragment.
  const redirectUrl = `${env.frontendUrl}/auth/callback#access_token=${accessToken}`;
  return res.redirect(redirectUrl);
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  // The stored token must match exactly (detects reuse / rotation).
  const stored = await getRefreshToken(payload.id);
  if (!stored || stored !== token) {
    throw new ApiError(401, 'Refresh token has been revoked');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) throw new ApiError(401, 'User no longer exists');

  // Rotate: issue a brand-new pair and replace the stored token.
  const { accessToken } = await grantSession(res, user);

  return ok(res, { accessToken }, 'Token refreshed');
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await deleteRefreshToken(payload.id);
    } catch {
      // Token already invalid — nothing to revoke.
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return ok(res, null, 'Logged out');
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'User not found');
  return ok(res, { user: publicUser(user) });
});

// PATCH /api/auth/profile — update editable profile fields (currently the
// mandatory monthlyIncome, plus optional name/taxRegime/annualIncome).
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, monthlyIncome, taxRegime, annualIncome } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (monthlyIncome !== undefined) data.monthlyIncome = monthlyIncome;
  if (taxRegime !== undefined) data.taxRegime = taxRegime;
  if (annualIncome !== undefined) data.annualIncome = annualIncome;

  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  writeAuditLog({ req, action: 'profile.update', resource: 'user', resourceId: user.id });

  return ok(res, { user: publicUser(user) }, 'Profile updated');
});
