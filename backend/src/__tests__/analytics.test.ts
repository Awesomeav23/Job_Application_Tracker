import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { prisma } from '../config/prisma';

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'password123',
    displayName: 'Analytics User',
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
  await prisma.analysis.deleteMany();
  await prisma.interviewQuestionSet.deleteMany();
  await prisma.application.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('analytics endpoints', () => {
  it('returns totals, status counts, and response metrics for a user', async () => {
    const user = await register('analytics-user@example.com');

    const appOne = await createApplication(user.token, {
      company: 'Acme',
      jobTitle: 'Engineer',
      jobDescription: 'Build software products.',
    });

    const appTwo = await createApplication(user.token, {
      company: 'Beta',
      jobTitle: 'Analyst',
      jobDescription: 'Review product metrics.',
    });

    await request(app)
      .patch(`/api/applications/${appOne.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'APPLIED' });

    await request(app)
      .patch(`/api/applications/${appOne.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'RECRUITER_SCREEN' });

    await request(app)
      .patch(`/api/applications/${appTwo.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'APPLIED' });

    const response = await request(app)
      .get('/api/analytics')
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.totalApplications).toBe(2);
    expect(response.body.byStatus.SAVED).toBe(0);
    expect(response.body.byStatus.APPLIED).toBe(1);
    expect(response.body.byStatus.RECRUITER_SCREEN).toBe(1);
    expect(response.body.responseRate).toBe(0.5);
    expect(response.body.interviewConversionRate).toBe(0);
    expect(response.body.averageResponseDays).toBeTypeOf('number');
  });

  it('returns zero-filled activity buckets over a time range', async () => {
    const user = await register('analytics-user-2@example.com');

    await createApplication(user.token, {
      company: 'Gamma',
      jobTitle: 'Developer',
      jobDescription: 'Ship features.',
    });

    const response = await request(app)
      .get('/api/analytics/activity')
      .set('Authorization', `Bearer ${user.token}`)
      .query({ bucket: 'week' });

    expect(response.status).toBe(200);
    expect(response.body.bucket).toBe('week');
    expect(Array.isArray(response.body.series)).toBe(true);
    expect(response.body.series.length).toBeGreaterThan(0);
    expect(response.body.series[0]).toHaveProperty('created');
    expect(response.body.series[0]).toHaveProperty('applied');
  });
});
