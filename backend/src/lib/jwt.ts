import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Create a signed JWT for a specific user.
// The payload includes the user ID and the secret is read from environment variables.
export function signToken(userId: string) {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign({ userId }, env.JWT_SECRET, options);
}

// Verify that a token is valid and return the user ID embedded in it.
// If the token is expired, invalid, or tampered with, this throws.
export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as { userId: string };
}
