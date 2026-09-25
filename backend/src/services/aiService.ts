import { prisma } from '../config/prisma';

const MOCK_PROVIDER = 'MOCK';
const MODEL_ID = 'mock-v1';
const PROMPT_VERSION = 'v1';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function pickStrengths(jobDescription: string, resumeText: string) {
  const jobTokens = new Set(tokenize(jobDescription));
  const resumeTokens = new Set(tokenize(resumeText));
  const matches = [...jobTokens].filter((token) => resumeTokens.has(token) && token.length > 3);
  return matches.slice(0, 5).map((token) => token.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function pickMissingSkills(jobDescription: string, resumeText: string) {
  const jobTokens = new Set(tokenize(jobDescription));
  const resumeTokens = new Set(tokenize(resumeText));
  const missing = [...jobTokens].filter((token) => !resumeTokens.has(token) && token.length > 4);
  return missing.slice(0, 3).map((token) => token.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function extractSummary(jobDescription: string, resumeText: string, matchScore: number) {
  const jobHint = jobDescription.split(/\s+/).slice(0, 12).join(' ');
  const resumeHint = resumeText.split(/\s+/).slice(0, 12).join(' ');
  return `The resume aligns with ${jobHint.trim() || 'the role'} at a ${matchScore}% fit level; evidence in the document includes ${resumeHint.trim() || 'relevant experience'} .`;
}

export async function runApplicationAnalysis(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      resume: true,
    },
  });

  if (!application) {
    const error = new Error('Application not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (!application.resumeId || !application.resume) {
    const error = new Error('Attach a resume to this application before running an analysis.') as Error & { statusCode?: number; code?: string };
    error.statusCode = 400;
    error.code = 'NO_RESUME_ATTACHED';
    throw error;
  }

  if (!application.resume.extractedText || application.resume.extractedText.trim().length === 0) {
    const error = new Error('Resume text could not be extracted.') as Error & { statusCode?: number; code?: string };
    error.statusCode = 422;
    error.code = 'RESUME_TEXT_UNAVAILABLE';
    throw error;
  }

  const resumeText = application.resume.extractedText;
  const jobDescription = application.jobDescription;
  const jobWords = tokenize(jobDescription);
  const resumeWords = tokenize(resumeText);
  const overlap = new Set(jobWords.filter((word) => resumeWords.includes(word)));
  const matchScore = Math.max(0, Math.min(100, Math.round((overlap.size / Math.max(jobWords.length, 1)) * 100)));

  const strengths = pickStrengths(jobDescription, resumeText);
  const missingSkills = pickMissingSkills(jobDescription, resumeText);
  const relevantExperience = resumeWords.slice(0, 6).map((word) => word.replace(/\b\w/g, (char) => char.toUpperCase()));

  const analysis = await prisma.analysis.create({
    data: {
      userId,
      applicationId,
      documentId: application.resumeId,
      matchScore,
      summary: extractSummary(jobDescription, resumeText, matchScore),
      strengths: strengths.length > 0 ? strengths : ['Relevant background'],
      missingSkills: missingSkills.length > 0 ? missingSkills : ['Role-specific fit details'],
      relevantExperience: relevantExperience.length > 0 ? relevantExperience : ['Project experience'],
      provider: 'MOCK',
      modelId: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      rawResponse: {
        source: 'mock',
        jobDescription,
        resumeSnippet: resumeText.slice(0, 200),
      },
      tokensUsed: 0,
    },
    include: {
      document: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  });

  return {
    id: analysis.id,
    applicationId: analysis.applicationId,
    document: analysis.document,
    matchScore: analysis.matchScore,
    summary: analysis.summary,
    strengths: analysis.strengths,
    missingSkills: analysis.missingSkills,
    relevantExperience: analysis.relevantExperience,
    provider: analysis.provider,
    modelId: analysis.modelId,
    createdAt: analysis.createdAt,
  };
}

export async function listApplicationAnalyses(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });

  if (!application) {
    const error = new Error('Application not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const analyses = await prisma.analysis.findMany({
    where: { applicationId, userId },
    orderBy: { createdAt: 'desc' },
    include: {
      document: {
        select: {
          id: true,
          label: true,
        },
      },
    },
  });

  return { items: analyses.map((analysis) => ({
    id: analysis.id,
    applicationId: analysis.applicationId,
    document: analysis.document,
    matchScore: analysis.matchScore,
    summary: analysis.summary,
    strengths: analysis.strengths,
    missingSkills: analysis.missingSkills,
    relevantExperience: analysis.relevantExperience,
    provider: analysis.provider,
    modelId: analysis.modelId,
    createdAt: analysis.createdAt,
  })) };
}

export async function createInterviewQuestions(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });

  if (!application) {
    const error = new Error('Application not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const jobDescription = application.jobDescription;
  const questions = [
    `Walk me through how you would approach the work described in: ${jobDescription.slice(0, 80)}${jobDescription.length > 80 ? '...' : ''}`,
    'What trade-offs would you make when balancing delivery speed against technical quality?',
    'How do you measure success in a role that brings together product, process, and technical execution?',
  ];

  const record = await prisma.interviewQuestionSet.create({
    data: {
      userId,
      applicationId,
      questions,
      provider: 'MOCK',
      modelId: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      rawResponse: {
        source: 'mock',
        jobDescription,
      },
      tokensUsed: 0,
    },
  });

  return {
    id: record.id,
    applicationId: record.applicationId,
    questions: record.questions,
    provider: record.provider,
    modelId: record.modelId,
    createdAt: record.createdAt,
  };
}

export async function listInterviewQuestions(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
  });

  if (!application) {
    const error = new Error('Application not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const records = await prisma.interviewQuestionSet.findMany({
    where: { applicationId, userId },
    orderBy: { createdAt: 'desc' },
  });

  return { items: records.map((record) => ({
    id: record.id,
    applicationId: record.applicationId,
    questions: record.questions,
    provider: record.provider,
    modelId: record.modelId,
    createdAt: record.createdAt,
  })) };
}
