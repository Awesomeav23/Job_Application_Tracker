import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { archiveDocument, createDocument, deleteDocument, getDocument, getDocumentFile, listDocuments, unarchiveDocument, updateDocument } from '../services/documentService';
import { sendValidationError } from '../utils/errors';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
    ];

    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
      return;
    }

    cb(new Error('UNSUPPORTED_FILE_TYPE'));
  },
});

const documentCreateSchema = z.object({
  kind: z.enum(['RESUME', 'COVER_LETTER']),
  label: z.string().min(1).max(200),
  version: z.string().max(100).optional().nullable(),
});

const documentUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  version: z.string().max(100).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const kind = typeof req.query.kind === 'string' ? (req.query.kind as 'RESUME' | 'COVER_LETTER') : undefined;
    const includeArchived = req.query.includeArchived === 'true';
    const documents = await listDocuments(req.user!.id, kind, includeArchived);
    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list documents' } });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'A file is required', fields: { file: 'File is required' } } });
    }

    const parsed = documentCreateSchema.safeParse({
      kind: req.body.kind,
      label: req.body.label,
      version: req.body.version,
    });

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'body';
        fields[field] = issue.message;
      }
      return sendValidationError(res, fields);
    }

    const document = await createDocument(req.user!.id, req.file, parsed.data);
    return res.status(201).json(document);
  } catch (error: any) {
    if (error.code === 'VALIDATION_FAILED') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
          fields: { file: error.message },
        },
      });
    }

    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB limit' } });
    }

    if (error.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Unsupported file type' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to upload document' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const document = await getDocument(req.user!.id, req.params.id);
    return res.json(document);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to fetch document' } });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const { fileBuffer, document } = await getDocumentFile(req.user!.id, req.params.id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalFileName)}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    return res.send(fileBuffer);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to download document' } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const parsed = documentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'body';
        fields[field] = issue.message;
      }
      return sendValidationError(res, fields);
    }

    const document = await updateDocument(req.user!.id, req.params.id, parsed.data);
    return res.json(document);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    if (error.code === 'VALIDATION_FAILED') {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: error.message } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to update document' } });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const document = await archiveDocument(req.user!.id, req.params.id);
    return res.json(document);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to archive document' } });
  }
});

router.post('/:id/unarchive', async (req, res) => {
  try {
    const document = await unarchiveDocument(req.user!.id, req.params.id);
    return res.json(document);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to unarchive document' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteDocument(req.user!.id, req.params.id);
    return res.status(204).send();
  } catch (error: any) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: {
          code: 'DOCUMENT_IN_USE',
          message: `This document was used in ${error.analysisCount ?? 0} analyses and cannot be deleted. Archive it instead to hide it from your list.`,
          analysisCount: error.analysisCount ?? 0,
        },
      });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to delete document' } });
  }
});

export default router;
