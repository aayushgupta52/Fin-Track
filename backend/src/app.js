import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';

const app = express();

// Trust the first proxy (Railway/Vercel) so req.ip and rate limiting work.
app.set('trust proxy', 1);

// Security + parsing middleware. In production the API serves JSON only (no
// same-origin HTML), so the strict cross-origin resource policy is safe.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    // Allow the configured origin(s); permit same-origin / non-browser requests
    // (no Origin header) such as health checks and server-to-server calls.
    origin: (origin, cb) => {
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Global rate limit for the API surface
app.use('/api', apiLimiter);

// Routes
app.use('/api', routes);

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

export default app;
