import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] Warning: missing environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill them in.'
  );
}

const nodeEnv = process.env.NODE_ENV || 'development';
const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const hasStrongSecret = (value) => typeof value === 'string' && value.length >= 32 && !/change_me|replace_with|your_secret/i.test(value);

if (nodeEnv === 'production') {
  const insecure = [];
  if (!hasStrongSecret(accessSecret)) insecure.push('JWT_ACCESS_SECRET (use at least 32 random characters)');
  if (!hasStrongSecret(refreshSecret)) insecure.push('JWT_REFRESH_SECRET (use at least 32 random characters)');
  if (!hasStrongSecret(process.env.ADMIN_SECRET_KEY)) insecure.push('ADMIN_SECRET_KEY (use at least 32 random characters for first-admin bootstrap)');
  if (insecure.length) {
    throw new Error(`[security] Refusing to start in production with unsafe secrets: ${insecure.join(', ')}`);
  }
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  // First origin is the canonical one (used for OAuth redirects).
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim(),
  // Full allow-list for CORS. Set FRONTEND_URL to a comma-separated list to
  // permit multiple origins (e.g. www + apex + preview domains).
  corsOrigins: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL,
  uploadDir: process.env.UPLOAD_DIR || '',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  jwt: {
    accessSecret: accessSecret || 'dev-only-access-secret-not-for-production-2026',
    refreshSecret: refreshSecret || 'dev-only-refresh-secret-not-for-production-2026',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:5000/api/auth/google/callback',
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.FROM_EMAIL || 'noreply@fintrack.in',
  },

  adminSecretKey: process.env.ADMIN_SECRET_KEY,
};

export const isProd = env.nodeEnv === 'production';
