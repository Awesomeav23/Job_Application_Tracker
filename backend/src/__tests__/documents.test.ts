import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../app';
import { prisma } from '../config/prisma';

beforeEach(async () => {
  await prisma.analysis.deleteMany();
  await prisma.application.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('document endpoints', () => {
  it('uploads a resume and attaches it to an application', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'doc-user@example.com',
      password: 'password123',
      displayName: 'Doc User',
    });

    const token = registerRes.body.token;

    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Contoso',
        jobTitle: 'Frontend Engineer',
        jobDescription: 'Build UI features and work across teams.',
      });

    expect(appRes.status).toBe(201);

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'RESUME')
      .field('label', 'Frontend Engineer Resume v1')
      .field('version', 'v1')
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.kind).toBe('RESUME');
    expect(uploadRes.body.label).toBe('Frontend Engineer Resume v1');

    const attachRes = await request(app)
      .patch(`/api/applications/${appRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resumeId: uploadRes.body.id });

    expect(attachRes.status).toBe(200);
    expect(attachRes.body.resumeId).toBe(uploadRes.body.id);

    const listRes = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items.some((item: any) => item.id === uploadRes.body.id)).toBe(true);
  });

  it('rejects attaching a cover letter as a resume', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'doc-user-2@example.com',
      password: 'password123',
      displayName: 'Doc User 2',
    });

    const token = registerRes.body.token;

    const applicationRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Northwind',
        jobTitle: 'Product Manager',
        jobDescription: 'Lead roadmap, customer research and delivery.',
      });

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'COVER_LETTER')
      .field('label', 'Northwind Cover Letter')
      .attach('file', Buffer.from('Dear Hiring Team,\nI am excited to apply.\n'), {
        filename: 'cover-letter.txt',
        contentType: 'text/plain',
      });

    expect(uploadRes.status).toBe(201);

    const attachRes = await request(app)
      .patch(`/api/applications/${applicationRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resumeId: uploadRes.body.id });

    expect(attachRes.status).toBe(400);
    expect(attachRes.body.error.code).toBe('WRONG_DOCUMENT_KIND');
  });

  it('deletes an unanalysed document and clears application references', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'doc-user-3@example.com',
      password: 'password123',
      displayName: 'Doc User 3',
    });

    const token = registerRes.body.token;
    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company: 'Acme',
        jobTitle: 'Data Analyst',
        jobDescription: 'Analyze product metrics and support reporting.',
      });

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'RESUME')
      .field('label', 'Data Analyst Resume')
      .attach('file', Buffer.from('resume data'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    const attachRes = await request(app)
      .patch(`/api/applications/${appRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resumeId: uploadRes.body.id });

    expect(attachRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/documents/${uploadRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(204);

    const refreshedApp = await request(app)
      .get(`/api/applications/${appRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(refreshedApp.body.resumeId).toBeNull();
  });
});
