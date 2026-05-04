/**
 * Vercel serverless entry point.
 *
 * Vercel runs Express apps as serverless functions. Instead of calling
 * app.listen(), we export the Express app as the default export.
 * Vercel intercepts all requests and passes them to this handler.
 *
 * The actual app setup (middleware, routes) lives in src/index.js —
 * this file just re-exports the app without starting a server.
 *
 * IMPORTANT: bodyParser must be disabled so Vercel does not pre-consume
 * the request stream before multer can read multipart/form-data bodies.
 * Without this, file uploads (POST /api/cases) arrive with an empty body.
 */
import app from '../src/app.js';

export default app;

export const config = {
  api: {
    bodyParser: false,
  },
};
