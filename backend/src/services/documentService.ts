import path from 'path';
import mammoth from 'mammoth';
import { prisma } from '../config/prisma';

function buildStorageKey(userId: string, fileName: string) {
  return path.posix.join('documents', userId, fileName).replace('\\', '/');
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

const MAX_EXTRACTED_CHARS = 50000;

async function extractedTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('xml')) {
    return buffer.toString('utf8').slice(0, MAX_EXTRACTED_CHARS);
  }

  if (mimeType === 'application/pdf') {
    // Lazy-load pdf-parse: its optional @napi-rs/canvas dep throws on
    // serverless cold starts (Vercel), which would crash the whole app
    // before /health could respond. Importing here confines the failure
    // to PDF uploads specifically.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text ?? '').trim();
      return text ? text.slice(0, MAX_EXTRACTED_CHARS) : null;
    } catch {
      return null;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = (value ?? '').trim();
      return text ? text.slice(0, MAX_EXTRACTED_CHARS) : null;
    } catch {
      return null;
    }
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
    // Exclude content (file bytes) from list queries to keep responses light.
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
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
      content: new Uint8Array(file.buffer),
      extractedText: await extractedTextFromBuffer(file.buffer, file.mimetype),
    },
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return document;
}

export async function getDocument(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
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
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

export async function archiveDocument(userId: string, documentId: string) {
  await getDocument(userId, documentId);

  return prisma.document.update({
    where: { id: documentId },
    data: { archivedAt: new Date() },
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function unarchiveDocument(userId: string, documentId: string) {
  await getDocument(userId, documentId);

  return prisma.document.update({
    where: { id: documentId },
    data: { archivedAt: null },
    select: {
      id: true,
      userId: true,
      kind: true,
      label: true,
      version: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteDocument(userId: string, documentId: string) {
  await getDocument(userId, documentId);

  const analysisCount = await prisma.analysis.count({ where: { documentId } });
  if (analysisCount > 0) {
    const error = new Error('Document is used in analyses and cannot be deleted') as Error & { statusCode?: number; code?: string; analysisCount?: number };
    error.statusCode = 409;
    error.code = 'DOCUMENT_IN_USE';
    error.analysisCount = analysisCount;
    throw error;
  }

  await prisma.document.delete({ where: { id: documentId } });
  return true;
}

export async function getDocumentFile(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    const error = new Error('Document not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (!document.content) {
    const error = new Error('Stored file not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const fileBuffer = Buffer.from(document.content);
  const { content: _content, ...documentWithoutContent } = document;
  return { fileBuffer, document: documentWithoutContent };
}

export function validateDocumentAttachmentKind(kind: 'RESUME' | 'COVER_LETTER', expected: 'RESUME' | 'COVER_LETTER') {
  if (kind !== expected) {
    const error = new Error('Wrong document kind for this field') as Error & { statusCode?: number; code?: string };
    error.statusCode = 400;
    error.code = 'WRONG_DOCUMENT_KIND';
    throw error;
  }
}
