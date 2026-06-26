import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import compression from 'compression';
import express from 'express';
import { randomBytes } from 'crypto';

import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { SentryErrorInterceptor } from './common/interceptors/sentry-error.interceptor';
import { setupSwagger } from './common/swagger/swagger.setup';

// ========================================
// CSP NONCE GENERATION
// ========================================
function generateCspNonce(): string {
  return randomBytes(16).toString('base64');
}

// ========================================
// SECRETS VALIDATION
// ========================================
function validateSecrets(): void {
  const errors: string[] = [];

  // Required string secrets (must exist and not be empty/whitespace)
  const requiredSecrets = [
    'JWT_ACCESS_SECRET',
    'PIN_PEPPER_SECRET',
    'CSRF_SECRET',
  ];

  for (const secret of requiredSecrets) {
    const value = process.env[secret];
    if (!value || value.trim() === '') {
      errors.push(`Missing or empty required secret: ${secret}`);
    }
  }

  // Midtrans key validation based on environment
  const midtransEnv = process.env.MIDTRANS_ENV || 'sandbox';
  const serverKeyEnvVar =
    midtransEnv === 'production'
      ? 'MIDTRANS_SERVER_KEY_PRODUCTION'
      : 'MIDTRANS_SERVER_KEY_SANDBOX';
  const serverKey = process.env[serverKeyEnvVar];
  if (!serverKey || serverKey.trim() === '') {
    errors.push(
      `Missing or empty required secret: ${serverKeyEnvVar} (MIDTRANS_ENV=${midtransEnv})`,
    );
  }

  if (errors.length > 0) {
    const errorMsg = `\n\n==========================================================
FATAL ERROR: Secrets Validation Failed!

The following issues must be resolved:
${errors.map((v) => `- ${v}`).join('\n')}

The server cannot start without these security secrets.
==========================================================\n`;
    console.error(errorMsg);
    // Wait for log flush before exiting
    setTimeout(() => process.exit(1), 100);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate all required secrets before starting
  validateSecrets();

  // ========================================
  // JSON LOGGING FOR PRODUCTION
  // ========================================
  if (process.env.NODE_ENV === 'production') {
    // Enable JSON logging for production (structured logs for log aggregation)
    logger.log(
      JSON.stringify({
        event: 'app_start',
        message: 'Starting NestJS application in production mode',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      }),
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [nodeProfilingIntegration()],
    // PERFORMANCE: Sample 10% of transactions in production to control costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
  });

  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins: (string | RegExp)[] = [
    'http://localhost:5173',
    'http://localhost:4173',
    frontendUrl,
  ].filter((origin): origin is string => typeof origin === 'string');

  // ========================================
  // SECURITY HEADERS (Helmet)
  // ========================================

  // Midtrans allowed domains for CSP (configurable via CSP_MIDTRANS_DOMAINS)
  const midtransFrameDomains = process.env.CSP_MIDTRANS_DOMAINS
    ? process.env.CSP_MIDTRANS_DOMAINS.split(',').map((d) => d.trim())
    : ['https://app.sandbox.midtrans.com', 'https://app.midtrans.com'];

  const midtransConnectDomains = process.env.CSP_MIDTRANS_DOMAINS
    ? process.env.CSP_MIDTRANS_DOMAINS.split(',')
        .map((d) => d.trim())
        .map((d) => {
          // Convert app.* to api.* for connect-src
          return d.replace('app.', 'api.');
        })
    : ['https://api.sandbox.midtrans.com', 'https://api.midtrans.com'];

  // CSP nonce middleware - generates unique nonce per request
  // Also sets CSP header directly with nonce for inline scripts
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const nonce = generateCspNonce();
      // Store nonce in res.locals for access in templates (if needed)
      res.locals.cspNonce = nonce;
      // Also store in cookie for frontend access (httpOnly for security)
      res.cookie('csp-nonce', nonce, {
        httpOnly: false, // Frontend needs to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      next();
    },
  );

  // Disable Helmet's automatic CSP (we'll set it manually with nonce)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable default CSP
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );

  // CSP middleware - set CSP header with per-request nonce
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const nonce = res.locals.cspNonce;
      const cspDirectives = [
        "default-src 'self'",
        "base-uri 'self'",
        'block-all-mixed-content',
        "child-src 'self' blob:",
        "frame-ancestors 'self'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "form-action 'self'",
        `frame-src 'self' ${midtransFrameDomains.join(' ')}`,
        `connect-src 'self' ${midtransConnectDomains.join(' ')}`,
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'nonce-${nonce}'`,
        'upgrade-insecure-requests',
      ].join('; ');
      res.setHeader('Content-Security-Policy', cspDirectives);
      next();
    },
  );

  // ========================================
  // CORS Configuration
  // ========================================
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Length'],
    maxAge: 86400, // 24 hours
  });

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // ========================================
  // VALIDATION & GLOBAL SETTINGS
  // ========================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Compression
  app.use(compression());

  // ========================================
  // SECURITY HEADERS (additional)
  // ========================================
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.removeHeader('X-Powered-By');
      next();
    },
  );

  // ========================================
  // STATIC FILES
  // ========================================
  // TINGGI-06: Only serve storage path if configured (frontend is served by Caddy)
  if (process.env.STORAGE_PATH) {
    app.use('/storage', express.static(process.env.STORAGE_PATH));
  }

  // ========================================
  // EXCEPTION FILTER & INTERCEPTORS
  // ========================================
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SentryErrorInterceptor());

  // ========================================
  // SWAGGER DOCUMENTATION
  // ========================================
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
    logger.log('Swagger documentation available at /api/docs');
  }

  // ========================================
  // START SERVER
  // ========================================
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

  const port = process.env.PORT ?? 3000;

  // Replace console.log with structured JSON log
  logger.log(
    JSON.stringify({
      event: 'app_ready',
      message: `Application running on port ${port}`,
      port,
      timestamp: new Date().toISOString(),
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  }
}
void bootstrap();
