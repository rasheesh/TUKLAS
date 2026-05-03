import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import authRouter     from './routes/auth.js';
import casesRouter    from './routes/cases.js';
import profilesRouter from './routes/profiles.js';
import matchesRouter  from './routes/matches.js';

const app = express();

/* ── CORS origin ──────────────────────────────────────────── */
/*
 * FRONTEND_URL must be set in production env vars on Vercel.
 * We log a warning but do NOT call process.exit() — that crashes
 * Vercel serverless cold starts. The app will still start; CORS
 * will simply reject requests from unknown origins.
 */
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
if (!process.env.FRONTEND_URL && process.env.NODE_ENV === 'production') {
  console.warn('[WARN] FRONTEND_URL is not set in production. CORS will use localhost fallback.');
}

/* ── CORS preflight — MUST be first, before Helmet ───────── */
/*
 * Vercel serverless: each request may hit a fresh instance.
 * The browser sends an OPTIONS preflight before every cross-origin
 * request. This handler responds immediately with the correct CORS
 * headers before any other middleware runs, preventing Helmet from
 * stripping them.
 */
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

/* ── Security headers (Helmet) ────────────────────────────── */
const isProduction = process.env.NODE_ENV === 'production';

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
          allowedOrigin,
          'https://*.supabase.co',
        ],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
        /* upgradeInsecureRequests only in production — omit entirely in dev */
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    /* HSTS only in production */
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    noSniff:       true,
    frameguard:    { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
  })
);

/* ── CORS ─────────────────────────────────────────────────── */
app.use(cors({
  origin:      allowedOrigin,
  credentials: true,
}));

/* ── Body parsers ─────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ── Rate limiting ────────────────────────────────────────── */
/*
 * NOTE: express-rate-limit uses in-memory storage by default.
 * On Vercel serverless, each function instance has its own memory,
 * so rate limits are per-instance, not global. This still provides
 * basic protection against single-client abuse on a single instance.
 * For strict global rate limiting, a Redis store (e.g. @upstash/ratelimit)
 * would be needed — acceptable tradeoff for this deployment.
 */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,   // disable in dev to avoid interfering with hot reload
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
