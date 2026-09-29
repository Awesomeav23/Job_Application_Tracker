import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth';
import applicationRoutes from './routes/applications';
import documentRoutes from './routes/documents';
import aiRoutes from './routes/ai';
import analyticsRoutes from './routes/analytics';

// Extend Express's Request type so auth middleware can attach the authenticated user.
// This lets downstream handlers read req.user.id without extra boilerplate.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

// Create the Express application instance.
export const app = express();

// Allow browser clients to call the API from a different origin.
// If FRONTEND_ORIGIN is set, only that origin is allowed; otherwise reflect the
// request origin so local dev works from any port.
app.use(cors({ origin: env.FRONTEND_ORIGIN ?? true }));

// Parse incoming JSON request bodies.
app.use(express.json());

// Health check endpoint for local startup and deployment probes.
app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// A basic API root endpoint to confirm the server is responding.
// The '/' handler covers Vercel's behavior of stripping the '/api' prefix
// when invoking api/index.ts directly at exactly '/api' (the rewrite skips
// that case), so both paths return the same status.
app.get(['/api', '/'], (_req, res) => {
  res.json({ name: 'AI Job Application Tracker API', status: 'ok' });
});

// Mount the authentication routes under /api/auth.
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', aiRoutes);
app.use('/api', analyticsRoutes);

// Central error handler for unexpected server errors.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' } });
});
