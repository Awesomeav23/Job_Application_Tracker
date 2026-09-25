import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const STATUS_ORDER = ['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const;

function toStatusMap() {
  return STATUS_ORDER.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<string, number>);
}

function normalizeRange(from?: string, to?: string) {
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  if (start && Number.isNaN(start.getTime())) {
    throw new Error('INVALID_DATE');
  }
  if (end && Number.isNaN(end.getTime())) {
    throw new Error('INVALID_DATE');
  }
  return { start, end };
}

function getBucketStart(date: Date, bucket: 'day' | 'week') {
  if (bucket === 'day') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAnalytics(userId: string, from?: string, to?: string) {
  const { start, end } = normalizeRange(from, to);

  const applications = await prisma.application.findMany({
    where: {
      userId,
      ...(start ? { createdAt: { gte: start } } : {}),
      ...(end ? { createdAt: { lte: end } } : {}),
    },
    include: {
      events: {
        orderBy: { occurredAt: 'asc' },
      },
    },
  });

  const totalApplications = applications.length;
  const byStatus = toStatusMap();

  for (const application of applications) {
    byStatus[application.status] = (byStatus[application.status] ?? 0) + 1;
  }

  const applied = applications.filter((application) => application.events.some((event) => event.toStatus === 'APPLIED'));
  const recruiterScreen = applications.filter((application) => application.events.some((event) => event.toStatus === 'RECRUITER_SCREEN'));
  const interview = applications.filter((application) => application.events.some((event) => event.toStatus === 'INTERVIEW'));

  const responseRate = applied.length > 0 ? recruiterScreen.length / applied.length : null;
  const interviewConversionRate = recruiterScreen.length > 0 ? interview.length / recruiterScreen.length : null;

  const responseDays: number[] = [];

  for (const application of applications) {
    const appliedEvent = application.events.find((event) => event.toStatus === 'APPLIED');
    if (!appliedEvent) continue;

    const nextEvent = application.events.find((event) => event.occurredAt.getTime() > appliedEvent.occurredAt.getTime());
    if (!nextEvent) continue;

    const diffDays = (nextEvent.occurredAt.getTime() - appliedEvent.occurredAt.getTime()) / (1000 * 60 * 60 * 24);
    responseDays.push(diffDays);
  }

  const averageResponseDays = responseDays.length > 0 ? responseDays.reduce((sum, value) => sum + value, 0) / responseDays.length : null;

  return {
    totalApplications,
    byStatus,
    responseRate,
    interviewConversionRate,
    averageResponseDays,
    range: {
      from: start ? start.toISOString() : null,
      to: end ? end.toISOString() : null,
    },
  };
}

export async function getActivity(userId: string, from?: string, to?: string, bucket: 'day' | 'week' = 'week') {
  const { start, end } = normalizeRange(from, to);

  const rangeStart = start ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
  const rangeEnd = end ?? new Date();

  const applications = await prisma.application.findMany({
    where: {
      userId,
      createdAt: {
        gte: rangeStart,
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      events: {
        orderBy: { occurredAt: 'asc' },
        select: {
          occurredAt: true,
          toStatus: true,
        },
      },
    },
  });

  const series: Array<{ periodStart: string; created: number; applied: number }> = [];
  const cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    const bucketStart = new Date(getBucketStart(cursor, bucket));
    const bucketEnd = new Date(bucketStart);

    if (bucket === 'day') {
      bucketEnd.setDate(bucketEnd.getDate() + 1);
    } else {
      bucketEnd.setDate(bucketEnd.getDate() + 7);
    }

    const createdCount = applications.filter((application) => {
      const createdAt = new Date(application.createdAt);
      return createdAt >= bucketStart && createdAt < bucketEnd;
    }).length;

    const appliedCount = applications.filter((application) => {
      return application.events.some((event) => {
        const occurredAt = new Date(event.occurredAt);
        return event.toStatus === 'APPLIED' && occurredAt >= bucketStart && occurredAt < bucketEnd;
      });
    }).length;

    series.push({
      periodStart: bucketStart.toISOString(),
      created: createdCount,
      applied: appliedCount,
    });

    if (bucket === 'day') {
      cursor.setDate(cursor.getDate() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return {
    bucket,
    series,
  };
}
