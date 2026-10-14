import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import fs, { readFileSync } from 'fs';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import apiRouter from './routes/index.js';

export const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from local network, localhost, or any client with credentials
      callback(null, origin || true);
    },
    credentials: true,
  })
);

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api/', apiLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file hosting for uploaded files
app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

// Swagger Documentation UI
try {
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
  app.use(express.static(frontendDistPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Centralized Error Handler
app.use(errorHandler);
