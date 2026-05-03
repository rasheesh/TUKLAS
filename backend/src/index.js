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

const app  = express();
const port = process.env.PORT || 4000;

/* ── CORS origin — must be explicitly set in production ───── */
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] FRONTEND_URL env variable is not set. Refusing to start in production without an explicit CORS origin.');
  process.exit(1);
}
const corsOrigin = allowedOrigin || 'http://localhost:3000';

/* ── Compression ──────────────────────────────────────────── */
app.use(compression());

/* ── Security headers (Helmet) ────────────────────────────── */
/*
 * Helmet sets a suite of HTTP response headers that protect against
 * common web vulnerabilities:
 *   - Content-Security-Policy  — restricts resource origins
 *   - X-Frame-Options          — prevents clickjacking (DENY)
 *   - X-Content-Type-Options   — prevents MIME sniffing (nosniff)
 *   - Referrer-Policy          — limits referrer leakage
 *   - Strict-Transport-Security — enforces HTTPS (production only)
 *   - Permissions-Policy       — disables unused browser features
 *
 * CSP is tuned to allow exactly what TUKLAS needs:
 *   - Google Fonts (stylesheet + font files)
 *   - Supabase Storage (case photos)
 *   - OpenStreetMap tiles (Leaflet map)
 *   - unpkg CDN is intentionally excluded — icons are now self-hosted
 */
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
          'https://*.supabase.co',       // case photos from Supabase Storage
          'https://*.tile.openstreetmap.org', // Leaflet map tiles
        ],
        connectSrc:     [
          "'self'",
          corsOrigin,                    // frontend → backend API
          'https://*.supabase.co',       // direct Supabase calls (anon key)
        ],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    /* Enforce HTTPS in production only — dev runs on http://localhost */
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    /* Prevent browsers from guessing content types */
    noSniff: true,
    /* Prevent this API from being embedded in iframes */
    frameguard: { action: 'deny' },
    /* Limit referrer information sent to third parties */
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    /* Remove X-Powered-By: Express — don't advertise the stack */
    hidePoweredBy: true,
  })
);

/* ── CORS ─────────────────────────────────────────────────── */
app.use(cors({
  origin:      corsOrigin,
  credentials: true,   // required for cookies
}));

/* ── Body parsers ─────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ── Rate limiting ────────────────────────────────────────── */

/*
 * Global fallback limiter — catches any endpoint not covered by
 * a more specific limiter below. Prevents bulk scraping and DoS.
 */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

/* Login — strict: 10 attempts per 15 minutes per IP */
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

/* Session check — 60 per 15 minutes (page loads + tab switches) */
app.use('/api/auth/session', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many session checks. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

/* Password change — 5 per 15 minutes per IP */
app.use('/api/auth/me/password', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password change attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

/* Public case submission — 20 per hour per IP (prevents spam reports) */
app.use('/api/cases', (req, res, next) => {
  if (req.method !== 'POST') return next();
  return rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
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

app.listen(port, () => {
  console.log(`TUKLAS backend running on http://localhost:${port}`);
});
