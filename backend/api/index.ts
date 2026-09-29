import serverless from 'serverless-http';
import { app } from '../src/app';

// Wrap the Express app with serverless-http so Vercel's request/response
// lifecycle plays nicely with middlewares that expect a stream (multer,
// large multipart uploads, streamed responses). Without this, file
// uploads silently fail because Vercel pre-buffers the body.
export default serverless(app);
