import { Router } from 'express';
import passport from '../config/passport.js';
import { env } from '../config/env.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';
import {
  register,
  login,
  googleCallback,
  refresh,
  logout,
  me,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

// Email / password
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.frontendUrl}/login?error=google_failed`,
  }),
  googleCallback
);

// Session lifecycle
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', logout);

// Current user
router.get('/me', authenticateJWT, me);
router.patch('/profile', authenticateJWT, validate(updateProfileSchema), updateProfile);

export default router;
