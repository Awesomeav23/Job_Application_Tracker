import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';
import { sendUnauthorized } from '../utils/errors';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.userId };
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired token');
  }
}
