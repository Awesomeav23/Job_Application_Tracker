import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { signToken } from '../lib/jwt';
import { requireAuth } from '../middleware/auth';
import { sendConflict, sendUnauthorized, sendValidationError } from '../utils/errors';

// Create the auth router so endpoints live under /api/auth.
const router = Router();

// Validation rules for user registration.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

// Validation rules for login.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Create a new user account.
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'body';
      fields[path] = issue.message;
    }

    return sendValidationError(res, fields);
  }

  const { email, password, displayName } = parsed.data;

  // Prevent duplicate accounts for the same email.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return sendConflict(res, 'Email already in use');
  }

  // Hash the password before saving to the database.
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
    },
  });

  // Return a JWT so the client can authenticate future requests.
  const token = signToken(user.id);

  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

// Authenticate an existing user and issue a new token.
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, { email: 'Invalid email', password: 'Password must be at least 8 characters' });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendUnauthorized(res, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return sendUnauthorized(res, 'Invalid credentials');
  }

  const token = signToken(user.id);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

// Return the current authenticated user.
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  });

  if (!user) {
    return sendUnauthorized(res, 'User not found');
  }

  return res.json(user);
});

// Update the current user's profile (display name only for now).
const updateProfileSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
});

router.patch('/me', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'body';
      fields[path] = issue.message;
    }
    return sendValidationError(res, fields);
  }

  const { displayName } = parsed.data;
  const normalized = displayName === undefined
    ? undefined
    : displayName === null
      ? null
      : displayName.trim() || null;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: normalized === undefined ? {} : { displayName: normalized },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  });

  return res.json(user);
});

// Change the current user's password. Requires the current password.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'body';
      fields[path] = issue.message;
    }
    return sendValidationError(res, fields);
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return sendUnauthorized(res, 'User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return sendUnauthorized(res, 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return res.status(204).send();
});

export default router;
