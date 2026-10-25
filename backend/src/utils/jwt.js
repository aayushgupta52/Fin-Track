import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Parse strings like "15m", "7d", "30s", "12h" into seconds.
export const expiryToSeconds = (value) => {
  const match = /^(\d+)([smhd])$/.exec(String(value).trim());
  if (!match) return Number(value) || 900;
  const n = Number(match[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return n * unit;
};

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiry });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiry });

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwt.accessSecret);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, env.jwt.refreshSecret);

// Issue an access + refresh pair for a user.
export const issueTokenPair = (user) => {
  const payload = { id: user.id, email: user.email, isPro: user.isPro, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ id: user.id }),
  };
};
