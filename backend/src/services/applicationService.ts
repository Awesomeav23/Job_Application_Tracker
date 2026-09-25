import { prisma } from '../config/prisma';
import { applicationCreateSchema, applicationUpdateSchema } from '../config/validation';

export async function createApplication(userId: string, input: unknown) {
  const parsed = applicationCreateSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'body';
      fields[path] = issue.message;
    }

    const error = new Error('VALIDATION_FAILED') as Error & { fields?: Record<string, string> };
    error.fields = fields;
    throw error;
  }

  const data = parsed.data;
  const application = await prisma.application.create({
    data: {
      userId,
      company: data.company,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      status: data.status ?? 'SAVED',
      location: data.location,
      salary: data.salary,
      url: data.url,
      dateApplied: data.dateApplied ? new Date(data.dateApplied) : null,
      notes: data.notes,
    },
  });

  await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: application.status,
    },
  });

  return application;
}

export async function listApplications(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      resume: true,
      coverLetter: true,
    },
  });
}

export async function getApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId,
    },
    include: {
      resume: true,
      coverLetter: true,
    },
  });

  if (!application) {
    const error = new Error('NOT_FOUND') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return application;
}

export async function updateApplication(userId: string, applicationId: string, input: unknown) {
  const parsed = applicationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || 'body';
      fields[path] = issue.message;
    }

    const error = new Error('VALIDATION_FAILED') as Error & { fields?: Record<string, string> };
    error.fields = fields;
    throw error;
  }

  const existing = await prisma.application.findFirst({
    where: {
      id: applicationId,
      userId,
    },
  });

  if (!existing) {
    const error = new Error('NOT_FOUND') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const payload = parsed.data;
  const previousStatus = existing.status;

  if (payload.resumeId !== undefined) {
    if (payload.resumeId === null) {
      // allows clearing the resume attachment
    } else {
      const resume = await prisma.document.findFirst({
        where: { id: payload.resumeId, userId, kind: 'RESUME' },
      });

      if (!resume) {
        const error = new Error('Document not found or wrong kind') as Error & { statusCode?: number; code?: string };
        error.statusCode = 400;
        error.code = 'WRONG_DOCUMENT_KIND';
        throw error;
      }
    }
  }

  if (payload.coverLetterId !== undefined) {
    if (payload.coverLetterId === null) {
      // allows clearing the cover letter attachment
    } else {
      const coverLetter = await prisma.document.findFirst({
        where: { id: payload.coverLetterId, userId, kind: 'COVER_LETTER' },
      });

      if (!coverLetter) {
        const error = new Error('Document not found or wrong kind') as Error & { statusCode?: number; code?: string };
        error.statusCode = 400;
        error.code = 'WRONG_DOCUMENT_KIND';
        throw error;
      }
    }
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      ...(payload.company !== undefined ? { company: payload.company } : {}),
      ...(payload.jobTitle !== undefined ? { jobTitle: payload.jobTitle } : {}),
      ...(payload.jobDescription !== undefined ? { jobDescription: payload.jobDescription } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
      ...(payload.salary !== undefined ? { salary: payload.salary } : {}),
      ...(payload.url !== undefined ? { url: payload.url } : {}),
      ...(payload.dateApplied !== undefined ? { dateApplied: payload.dateApplied ? new Date(payload.dateApplied) : null } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.resumeId !== undefined ? { resumeId: payload.resumeId } : {}),
      ...(payload.coverLetterId !== undefined ? { coverLetterId: payload.coverLetterId } : {}),
    },
  });

  if (payload.status !== undefined && payload.status !== previousStatus) {
    await prisma.applicationEvent.create({
      data: {
        applicationId,
        fromStatus: previousStatus,
        toStatus: payload.status,
      },
    });
  }

  return updated;
}

export async function deleteApplication(userId: string, applicationId: string) {
  const existing = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });

  if (!existing) {
    const error = new Error('NOT_FOUND') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  await prisma.application.delete({
    where: { id: applicationId },
  });

  return { deleted: true };
}
