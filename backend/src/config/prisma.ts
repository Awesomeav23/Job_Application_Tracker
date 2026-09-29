import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Reuse the Prisma client across serverless invocations. Without this,
// each cold start (or Vercel's dev hot-reload) would open a new pool.
export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
