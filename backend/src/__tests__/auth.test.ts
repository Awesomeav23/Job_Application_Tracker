import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { prisma } from '../config/prisma';

// Clear users before each test so the suite starts from a clean DB state.
beforeEach(async () => {
  await prisma.user.deleteMany();
});

// Close Prisma after the test file finishes.
afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth endpoints', () => {
  // Registering a valid user should create the record and return a token.
  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.displayName).toBe('Test User');
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  // Duplicate emails should be rejected with a 409 conflict.
  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password456',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  // A user should be able to log in and then access a protected route with the returned token.
  it('logs in and allows a protected route', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTypeOf('string');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('test@example.com');
  });

  // Requests without a valid JWT should be rejected.
  it('blocks access without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
