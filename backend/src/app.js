import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';

import authRouter     from './routes/auth.js';
import casesRouter    from './routes/cases.js';
import profilesRouter from './routes/profiles.js';
import matchesRouter  from './routes/matches.js';

const app = express();

/* ── CORS origin — must be explicitly set in production ───── */
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] FRONTEND_URL env variable is not set. Refusing to start in production without an explicit CORS origin.');
  process.exit(1);
}
const corsOrigin = allowedOrigin || 'http://localhost:3000';

/* ── Compression ──────────────────────────────────────────── */
app.use(compression());

/* ── CORS preflight — must come before Helmet and all routes ─ */
/*
 * Vercel serverless functions don't persist connections, so the
 * browser's OPTIONS preflight request may hit a cold instance that
 * hasn't run the cors() middleware yet. Explicitly handling OPTIONS
 * here ensures preflight always gets a 204 with the right headers
 * regardless of middleware ordering.
 */
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

/* ── Security headers (Helmet) ────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:         [
          "'self'",
          'data:',
          'blob:',
          'https://*.supabase.co',
          'https://*.tile.openstreetmap.org',
        ],
        connectSrc:     [
          "'self'",
          corsOrigin,
          'https://*.supabase.co',
        ],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
  })
);

/* ── CORS ─────────────────────────────────────────────────── */
app.use(cors({
  origin:      corsOrigin,
  credentials: true,
}));

/* ── Body parsers ─────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ── Rate limiting ────────────────────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth/session', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many session checks. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth/me/password', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password change attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/cases', (req, res, next) => {
  if (req.method !== 'POST') return next();
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Too many case submissions. Please wait before submitting again.' },
    standardHeaders: true,
    legacyHeaders: false,
  })(req, res, next);
});

/* ── Routes ───────────────────────────────────────────────── */
app.use('/api/auth',           authRouter);
app.use('/api/cases',          casesRouter);
app.use('/api/admin/profiles', profilesRouter);
app.use('/api/matches',        matchesRouter);

/* ── Health check ─────────────────────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

/* ── 404 handler ──────────────────────────────────────────── */
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

/* ── Global error handler ─────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err.message);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

export default app;
