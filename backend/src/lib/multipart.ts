import type { Request } from 'express';
import busboy from 'busboy';

export interface ParsedFile {
  fieldName: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ParsedMultipart {
  fields: Record<string, string>;
  files: Record<string, ParsedFile>;
}

// Parses a multipart/form-data request body into fields + files. Written
// as a Promise instead of a stream-based middleware so it works both on
// long-lived Node (dev) and Vercel serverless, where multer's stream
// handling silently fails.
export function parseMultipart(req: Request, maxFileBytes = 5 * 1024 * 1024): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: { fileSize: maxFileBytes },
    });

    const fields: Record<string, string> = {};
    const files: Record<string, ParsedFile> = {};
    let fileLimitExceeded = false;
    let settled = false;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      fn();
    }

    bb.on('field', (name, value) => {
      fields[name] = value;
    });

    bb.on('file', (name, stream, info) => {
      const chunks: Buffer[] = [];
      let size = 0;

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      stream.on('limit', () => {
        fileLimitExceeded = true;
        stream.resume();
      });

      stream.on('end', () => {
        if (fileLimitExceeded) return;
        files[name] = {
          fieldName: name,
          originalname: info.filename,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
          size,
        };
      });

      stream.on('error', (err) => {
        settle(() => reject(err));
      });
    });

    bb.on('close', () => {
      if (fileLimitExceeded) {
        const err = new Error('FILE_TOO_LARGE') as Error & { code?: string };
        err.code = 'FILE_TOO_LARGE';
        settle(() => reject(err));
        return;
      }
      settle(() => resolve({ fields, files }));
    });

    bb.on('error', (err) => {
      settle(() => reject(err as Error));
    });

    req.pipe(bb);
  });
}
