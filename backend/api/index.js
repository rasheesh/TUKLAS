/**
 * Vercel serverless entry point.
 *
 * Vercel runs Express apps as serverless functions. Instead of calling
 * app.listen(), we export the Express app as the default export.
 * Vercel intercepts all requests and passes them to this handler.
 *
 * The actual app setup (middleware, routes) lives in src/index.js —
 * this file just re-exports the app without starting a server.
 */
import app from '../src/app.js';

export default app;
