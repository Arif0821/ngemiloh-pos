# Sentry Integration Setup

## Overview

Sentry provides error tracking and performance monitoring for the Ngemiloh POS system.

## Prerequisites

- Sentry account (free tier available)
- DSN (Data Source Name) from Sentry dashboard

## Setup Steps

### 1. Get Sentry DSN

1. Go to https://sentry.io
2. Create new project (Node.js/NestJS)
3. Copy the DSN URL

### 2. Configure Environment

Add to `.env`:
```
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 3. Install Package (if not already)

```bash
cd backend
npm install @sentry/node @sentry/tracing
```

### 4. Add to Application

In `main.ts`:

```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({}),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});
```

### 5. Test

```bash
curl http://localhost:3000/health
# Check Sentry dashboard for incoming events
```

## Features

- Error tracking
- Performance monitoring
- Release tracking
- User feedback

## Sample Rate

Set `tracesSampleRate` to control volume:
- 1.0 = 100% (all transactions)
- 0.1 = 10% (production use)
