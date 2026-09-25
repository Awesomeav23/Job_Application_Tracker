import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';

const STORAGE_ROOT = path.resolve(process.cwd(), 'uploads');

function buildStorageKey(userId: string, fileName: string) {
  return path.posix.join('documents', userId, fileName).replace('\\', '/');
}

function ensureStorageDirectory() {
  return fs.promises.mkdir(STORAGE_ROOT, { recursive: true });
}

function sanitizeFileName(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  return safeName || 'document';
}

function isSupportedMimeType(mimeType: string) {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
  ];

  return allowed.includes(mimeType) || mimeType.startsWith('text/');
}

function extractedTextFromBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('xml')) {
    return buffer.toString('utf8').slice(0, 50000);
  }

  return null;
}

export async function listDocuments(userId: string, kind?: 'RESUME' | 'COVER_LETTER', includeArchived = false) {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      ...(kind ? { kind } : {}),
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { createdAt: 'desc' },
  });

  return { items: documents, total: documents.length };
}

export async function createDocument(
  userId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  input: { kind: 'RESUME' | 'COVER_LETTER'; label: string; version?: string | null }
) {
  const kind = input.kind;
  const label = input.label?.trim();
  const version = input.version?.trim();

  if (!file) {
    const error = new Error('File is required') as Error & { code?: string };
    error.code = 'VALIDATION_FAILED';
    throw error;
  }

  if (!kind || (kind !== 'RESUME' && kind !== 'COVER_LETTER')) {
    const error = new Error('Document kind must be RESUME or COVER_LETTER') as Error & { code?: string };
    error.code = 'VALIDATION_FAILED';
    throw error;
  }

  if (!label || label.length < 1 || label.length > 200) {
    const error = new Error('Label is required and must be under 200 characters') as Error & { code?: string };
    error.code = 'VALIDATION_FAILED';
    throw error;
  }

  if (file.size > 5 * 1024 * 1024) {
    const error = new Error('File exceeds 5MB limit') as Error & { code?: string };
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }

  if (!isSupportedMimeType(file.mimetype)) {
    const error = new Error('Unsupported file type') as Error & { code?: string };
    error.code = 'UNSUPPORTED_FILE_TYPE';
    throw error;
  }

  const extension = path.extname(file.originalname || 'document') || '.bin';
  const safeBaseName = sanitizeFileName(path.basename(file.originalname || 'document', extension));
  const storageName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeBaseName}${extension}`;
  const storageKey = buildStorageKey(userId, storageName);
  const finalPath = path.join(STORAGE_ROOT, storageKey);

  await ensureStorageDirectory();
  await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.promises.writeFile(finalPath, file.buffer);

  const document = await prisma.document.create({
    data: {
      userId,
      kind,
      label,
      version: version || null,
      storageKey,
      originalFileName: file.originalname || 'document',
      mimeType: file.mimetype,
      sizeBytes: file.size,
      extractedText: extractedTextFromBuffer(file.buffer, file.mimetype),
    },
  });

  return document;
}

export async function getDocument(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    const error = new Error('Document not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return document;
}

export async function updateDocument(userId: string, documentId: string, input: { label?: string; version?: string | null }) {
  const document = await getDocument(userId, documentId);

  const label = input.label?.trim();
  const version = input.version === undefined ? document.version : input.version?.trim() || null;

  if (label !== undefined && (!label || label.length > 200)) {
    const error = new Error('Label must be between 1 and 200 characters') as Error & { code?: string };
    error.code = 'VALIDATION_FAILED';
    throw error;
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(input.version !== undefined ? { version } : {}),
    },
  });

  return updated;
}

export async function archiveDocument(userId: string, documentId: string) {
  const document = await getDocument(userId, documentId);

  return prisma.document.update({
    where: { id: documentId },
    data: { archivedAt: new Date() },
  });
}

export async function unarchiveDocument(userId: string, documentId: string) {
  await getDocument(userId, documentId);

  return prisma.document.update({
    where: { id: documentId },
    data: { archivedAt: null },
  });
}

export async function deleteDocument(userId: string, documentId: string) {
  const document = await getDocument(userId, documentId);

  const analysisCount = await prisma.analysis.count({ where: { documentId } });
  if (analysisCount > 0) {
    const error = new Error('Document is used in analyses and cannot be deleted') as Error & { statusCode?: number; code?: string; analysisCount?: number };
    error.statusCode = 409;
    error.code = 'DOCUMENT_IN_USE';
    error.analysisCount = analysisCount;
    throw error;
  }

  const filePath = path.join(STORAGE_ROOT, document.storageKey);
  await fs.promises.unlink(filePath).catch(() => undefined);

  await prisma.document.delete({ where: { id: documentId } });
  return true;
}

export async function getDocumentFile(userId: string, documentId: string) {
  const document = await getDocument(userId, documentId);
  const filePath = path.join(STORAGE_ROOT, document.storageKey);

  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    return { fileBuffer, document };
  } catch {
    const error = new Error('Stored file not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
}

export function validateDocumentAttachmentKind(kind: 'RESUME' | 'COVER_LETTER', expected: 'RESUME' | 'COVER_LETTER') {
  if (kind !== expected) {
    const error = new Error('Wrong document kind for this field') as Error & { statusCode?: number; code?: string };
    error.statusCode = 400;
    error.code = 'WRONG_DOCUMENT_KIND';
    throw error;
  }
}
