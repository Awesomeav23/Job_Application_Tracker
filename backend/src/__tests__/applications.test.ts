import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { prisma } from '../config/prisma';

async function register(email: string, password = 'password123') {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password,
    displayName: 'Test User',
  });

  return response.body;
}

async function createApplication(token: string, payload: Record<string, unknown>) {
  return request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
}

beforeEach(async () => {
  await prisma.applicationEvent.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('application endpoints', () => {
  it('creates an application and records the initial status event', async () => {
    const user = await register('owner@example.com');

    const res = await createApplication(user.token, {
      company: 'Acme',
      jobTitle: 'Software Engineer',
      jobDescription: 'Build internal tooling.',
    });

    expect(res.status).toBe(201);
    expect(res.body.company).toBe('Acme');
    expect(res.body.status).toBe('SAVED');
    expect(res.body.id).toBeTruthy();

    const events = await prisma.applicationEvent.findMany({
      where: { applicationId: res.body.id },
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.fromStatus).toBeNull();
    expect(events[0]?.toStatus).toBe('SAVED');
  });

  it('requires the required fields for creation', async () => {
    const user = await register('missing-fields@example.com');

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        company: 'Acme',
        jobTitle: 'Engineer',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('jobDescription');
  });

  it('updates status and writes a new event', async () => {
    const user = await register('status@example.com');

    const created = await createApplication(user.token, {
      company: 'Acme',
      jobTitle: 'Engineer',
      jobDescription: 'Build product.',
      status: 'SAVED',
    });

    const updated = await request(app)
      .patch(`/api/applications/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'APPLIED' });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('APPLIED');

    const events = await prisma.applicationEvent.findMany({
      where: { applicationId: created.body.id },
      orderBy: { occurredAt: 'asc' },
    });

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[1]?.fromStatus).toBe('SAVED');
    expect(events[1]?.toStatus).toBe('APPLIED');
  });

  it('denies cross-account access', async () => {
    const alice = await register('alice@example.com');
    const bob = await register('bob@example.com');

    const created = await createApplication(alice.token, {
      company: 'Acme',
      jobTitle: 'Engineer',
      jobDescription: 'Work with the team.',
    });

    const res = await request(app)
      .get(`/api/applications/${created.body.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(404);
  });

  it('deletes an application', async () => {
    const user = await register('delete@example.com');

    const createdApp = await createApplication(user.token, {
      company: 'Acme',
      jobTitle: 'Engineer',
      jobDescription: 'Build the product.',
    });

    const res = await request(app)
      .delete(`/api/applications/${createdApp.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);

    const deletedApp = await prisma.application.findUnique({
      where: { id: createdApp.body.id },
    });

    expect(deletedApp).toBeNull();
  });
});
