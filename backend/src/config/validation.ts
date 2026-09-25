import { z } from 'zod';

export const applicationCreateSchema = z.object({
  company: z.string().min(1).max(200),
  jobTitle: z.string().min(1).max(200),
  jobDescription: z.string().min(1).max(20000),
  status: z.enum(['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']).optional(),
  location: z.string().max(200).optional(),
  salary: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
  dateApplied: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  resumeId: z.string().nullable().optional(),
  coverLetterId: z.string().nullable().optional(),
});

export const applicationUpdateSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  jobTitle: z.string().min(1).max(200).optional(),
  jobDescription: z.string().min(1).max(20000).optional(),
  status: z.enum(['SAVED', 'APPLIED', 'RECRUITER_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']).optional(),
  location: z.string().max(200).nullable().optional(),
  salary: z.string().max(200).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  dateApplied: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  resumeId: z.string().nullable().optional(),
  coverLetterId: z.string().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});
