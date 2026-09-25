import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { prisma } from '../config/prisma';

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'password123',
    displayName: 'AI User',
  });

  return response.body;
}

beforeEach(async () => {
  await prisma.analysis.deleteMany();
  await prisma.interviewQuestionSet.deleteMany();
  await prisma.application.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AI analysis endpoints', () => {
  it('creates a resume analysis against the attached resume', async () => {
    const user = await register('ai-user@example.com');

    const applicationRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        company: 'Acme',
        jobTitle: 'Backend Engineer',
        jobDescription: 'Build Node.js APIs with TypeScript and PostgreSQL.',
      });

    const resumeRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${user.token}`)
      .field('kind', 'RESUME')
      .field('label', 'Backend Engineer Resume')
      .field('version', 'v2')
      .attach('file', Buffer.from('I built Node.js APIs in TypeScript and PostgreSQL for microservices.'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    await request(app)
      .patch(`/api/applications/${applicationRes.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ resumeId: resumeRes.body.id });

    const analyzeRes = await request(app)
      .post(`/api/applications/${applicationRes.body.id}/analyze`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(analyzeRes.status).toBe(201);
    expect(analyzeRes.body.applicationId).toBe(applicationRes.body.id);
    expect(analyzeRes.body.document.id).toBe(resumeRes.body.id);
    expect(analyzeRes.body.provider).toBe('MOCK');
    expect(analyzeRes.body.matchScore).toBeGreaterThanOrEqual(0);
    expect(analyzeRes.body.matchScore).toBeLessThanOrEqual(100);
  });

  it('requires a resume before analysis can run', async () => {
    const user = await register('ai-user-2@example.com');

    const applicationRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        company: 'Orbit',
        jobTitle: 'Platform Engineer',
        jobDescription: 'Build cloud infrastructure and deployment tooling.',
      });

    const res = await request(app)
      .post(`/api/applications/${applicationRes.body.id}/analyze`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_RESUME_ATTACHED');
  });

  it('creates interview questions from the job description alone', async () => {
    const user = await register('ai-user-3@example.com');

    const applicationRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        company: 'Signal',
        jobTitle: 'Product Engineer',
        jobDescription: 'Lead product architecture and work closely with design and engineering teams.',
      });

    const res = await request(app)
      .post(`/api/applications/${applicationRes.body.id}/interview-questions`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    expect(res.body.provider).toBe('MOCK');
  });
});
