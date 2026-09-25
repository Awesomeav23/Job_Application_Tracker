import type { Response } from 'express';

export function sendValidationError(res: Response, fields: Record<string, string>) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Request body failed validation.',
      fields,
    },
  });
}

export function sendUnauthorized(res: Response, message = 'Unauthorized') {
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message,
    },
  });
}

export function sendConflict(res: Response, message = 'Resource already exists') {
  return res.status(409).json({
    error: {
      code: 'EMAIL_TAKEN',
      message,
    },
  });
}
