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

import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { SentryErrorInterceptor } from './common/interceptors/sentry-error.interceptor';
import { setupSwagger } from './common/swagger/swagger.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'PIN_PEPPER_SECRET',
  ];
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    const errorMsg = `\n\n==========================================================\nFATAL ERROR: Missing Required Environment Variables!\n\nThe following variables MUST be set in Coolify / .env:\n${missingVars.map((v) => `- ${v}`).join('\n')}\n\nThe server cannot start without these security secrets.\n==========================================================\n`;
    console.error(errorMsg);
    // Wait a moment so the log is flushed to stdout before crashing
    await new Promise((resolve) => setTimeout(resolve, 100));
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [nodeProfilingIntegration()],
    // PERFORMANCE: Sample 10% of transactions in production to control costs
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
  });

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  // ========================================
  // SECURITY HEADERS (Helmet)
  // ========================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Enable CSP in production
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          blockAllMixedContent: [],
          childSrc: ["'self'", 'blob:'],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameSrc: [
            "'self'",
            'https://app.sandbox.midtrans.com',
            'https://app.midtrans.com',
          ], // Midtrans sandbox + production
          connectSrc: [
            "'self'",
            'https://api.sandbox.midtrans.com',
            'https://api.midtrans.com',
          ], // Midtrans sandbox + production
          // HIGH FIX S-04: Removed Tailwind CDN - CSS is bundled at build time
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for SvelteKit compatibility
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
    }),
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

  logger.log(`Application running on port ${process.env.PORT ?? 3000}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
