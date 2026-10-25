import { PrismaClient } from '@prisma/client';
import { isProd } from './env.js';

// Reuse a single PrismaClient across hot-reloads in development.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
