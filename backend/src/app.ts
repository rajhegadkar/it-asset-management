import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import path from 'path';
import zlib from 'zlib';
import swaggerUi from 'swagger-ui-express';
import fs, { readFileSync } from 'fs';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { auditTrail } from './middlewares/audit.js';
import apiRouter from './routes/index.js';

export const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS: only the origins listed in CORS_ORIGIN may call the API with credentials.
// "*" is honoured only outside production (env.ts never defaults to "*" in production).
const allowAnyOrigin = !env.IS_PROD && env.CORS_ORIGIN.includes('*');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin, curl, server-to-server
      if (allowAnyOrigin || env.CORS_ORIGIN.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// Behind nginx / a load balancer set TRUST_PROXY=1 so req.ip is the real client.
// Left off by default so X-Forwarded-For cannot be spoofed to dodge rate limits or fake audit IPs.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

// Rate Limiter: counted per signed-in user (falls back to IP for anonymous calls), so a whole office
// behind one NAT address does not share a single budget. Tune with API_RATE_LIMIT (requests / 15 min).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true',
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        // verified (signature only), so a forged token cannot be used to get a fresh budget
        const payload: any = jwt.verify(auth.slice(7), env.JWT_SECRET, { ignoreExpiration: true });
        if (payload?.userId) return `user:${payload.userId}`;
      } catch {
        /* fall back to IP */
      }
    }
    return `ip:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again in a few minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api/', apiLimiter);

// Strict limiter for credential endpoints (credential stuffing / TOTP brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true' ? 100000 : 30,
  skipSuccessfulRequests: true, // only failed attempts count, so busy offices behind one NAT IP are not blocked
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many sign-in attempts from this IP. Please wait 15 minutes and try again.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/refresh-token', authLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Uploaded files (imported spreadsheets etc.) are no longer served publicly.

// Audit trail for every successful write
app.use('/api/v1', auditTrail);

// Swagger Documentation UI (disabled in production unless ENABLE_API_DOCS=true)
if (!env.IS_PROD || process.env.ENABLE_API_DOCS === 'true') try {
  const swaggerDoc = JSON.parse(
    readFileSync(path.resolve(__dirname, 'docs/swagger.json'), 'utf-8')
  );
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
} catch {
  // Fallback if running via tsx or different cwd
  try {
    const swaggerDoc = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'src/docs/swagger.json'), 'utf-8')
    );
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  } catch (e) {
    console.warn('Swagger doc load notice:', e);
  }
}

// API v1 Routes
app.use('/api/v1', apiRouter);

// Root API Metadata endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Enterprise IT Asset Management (ITAM) API',
    status: 'ONLINE',
    version: '1.0.0',
    documentation: '/api/docs',
    apiBase: '/api/v1',
  });
});

// Serve Frontend SPA if built (checks all candidate build paths)
const possibleFrontendPaths = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), './frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(process.cwd(), './public'),
];
const frontendDistPath = possibleFrontendPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

// Explicit root route with content negotiation
app.get('/', (req, res) => {
  const accept = req.headers['accept'] || '';
  if (accept.includes('application/json') || !accept.includes('text/html') || process.env.NODE_ENV === 'test') {
    return res.json({
      name: 'Enterprise IT Asset Management (ITAM) API',
      status: 'ONLINE',
      version: '1.0.0',
      documentation: '/api/docs',
      apiBase: '/api/v1',
    });
  }
  if (frontendDistPath) {
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
  return res.json({
    name: 'Enterprise IT Asset Management (ITAM) API',
    status: 'ONLINE',
    version: '1.0.0',
    documentation: '/api/docs',
    apiBase: '/api/v1',
  });
});

if (frontendDistPath) {
  // Built JS/CSS files have content hashes in their names, so browsers may cache them for a year;
  // they are also gzip-compressed once in memory (no extra dependency) — ~70% smaller downloads.
  const distDir = frontendDistPath;
  const gzCache = new Map<string, Buffer>();
  app.get(/^\/assets\/.+\.(js|css|svg)$/, (req, res, next) => {
    if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
    const file = path.join(distDir, req.path);
    if (!file.startsWith(distDir + path.sep)) return next();
    let gz = gzCache.get(file);
    if (!gz) {
      if (!fs.existsSync(file)) return next();
      gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 });
      gzCache.set(file, gz);
    }
    const ext = path.extname(file);
    res.setHeader('Content-Type', ext === '.js' ? 'application/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'image/svg+xml');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(gz);
  });
  app.use(
    express.static(frontendDistPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    })
  );
  app.get('*', (req, res, next) => {
    // API routes and missing static files (e.g. /assets/x.js) must 404, not receive index.html
    if (req.path.startsWith('/api') || path.extname(req.path)) {
      return next();
    }
    // always revalidate the page shell so a new release is picked up immediately
    res.sendFile(path.join(frontendDistPath, 'index.html'), { cacheControl: false, headers: { 'Cache-Control': 'no-cache' } });
  });
}

// Centralized Error Handler
app.use(errorHandler);
