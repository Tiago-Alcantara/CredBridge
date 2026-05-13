# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate information leakage in production — stack traces, missing security headers, unprotected auth endpoints, and publicly accessible test page.

**Architecture:** Global NestJS exception filter sanitizes all error responses in production. Helmet adds HTTP security headers on the API. ThrottlerModule rate-limits auth endpoints. Next.js config adds matching security headers. Test page is deleted.

**Tech Stack:** NestJS 11, `helmet`, `@nestjs/throttler`, Next.js 16

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/api/src/common/filters/http-exception.filter.ts` | Global exception filter |
| Create | `apps/api/src/common/filters/http-exception.filter.spec.ts` | Unit tests for filter |
| Modify | `apps/api/src/main.ts` | Register filter + helmet |
| Modify | `apps/api/src/app.module.ts` | Add ThrottlerModule |
| Modify | `apps/api/src/modules/auth/auth.controller.ts` | Add @Throttle on login/register |
| Modify | `apps/web/next.config.ts` | Security headers |
| Delete | `apps/web/src/app/test/page.tsx` | Remove test page |

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/api/package.json` (via npm install)

- [ ] **Step 1: Install helmet and throttler in the API workspace**

```bash
npm install helmet @nestjs/throttler --workspace=apps/api
```

Expected output: packages added to `apps/api/node_modules`, `package.json` updated.

- [ ] **Step 2: Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "chore(api): add helmet and @nestjs/throttler"
```

---

### Task 2: Global exception filter

**Files:**
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.spec.ts`

- [ ] **Step 1: Create the filter directory**

```bash
mkdir -p apps/api/src/common/filters
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/common/filters/http-exception.filter.spec.ts`:

```typescript
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function makeFilter(isProd: boolean) {
  const filter = new AllExceptionsFilter();
  jest.spyOn(filter as any, 'isProd', 'get').mockReturnValue(isProd);
  return filter;
}

function makeCtx(statusFn = jest.fn(), jsonFn = jest.fn()) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn, json: jsonFn }),
      getRequest: () => ({ method: 'GET', url: '/test' }),
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  describe('in production', () => {
    it('returns sanitized message for HttpException 4xx', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      filter.catch(new HttpException('Email already registered', HttpStatus.CONFLICT), ctx);
      expect(statusFn).toHaveBeenCalledWith(409);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 409, message: 'Email already registered' });
    });

    it('returns generic message for unexpected 5xx errors', () => {
      const filter = makeFilter(true);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      filter.catch(new Error('DB connection failed'), ctx);
      expect(statusFn).toHaveBeenCalledWith(500);
      expect(jsonFn).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    });
  });

  describe('in development', () => {
    it('includes stack trace for unexpected errors', () => {
      const filter = makeFilter(false);
      const statusFn = jest.fn().mockReturnThis();
      const jsonFn = jest.fn();
      const ctx = makeCtx(statusFn, jsonFn);
      const err = new Error('something broke');
      filter.catch(err, ctx);
      expect(statusFn).toHaveBeenCalledWith(500);
      const call = jsonFn.mock.calls[0][0] as Record<string, unknown>;
      expect(call).toHaveProperty('stack');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/api && npx jest src/common/filters/http-exception.filter.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: `FAIL` — `AllExceptionsFilter` not found.

- [ ] **Step 4: Implement the filter**

Create `apps/api/src/common/filters/http-exception.filter.ts`:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as { message?: string }).message ?? exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = { statusCode: status, message };

    if (!this.isProd && exception instanceof Error) {
      body.stack = exception.stack;
    }

    response.status(status).json(body);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/api && npx jest src/common/filters/http-exception.filter.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `PASS` — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/filters/
git commit -m "feat(api): add global exception filter with prod sanitization"
```

---

### Task 3: Register filter + Helmet in main.ts

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Update main.ts**

Replace the contents of `apps/api/src/main.ts` with:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): register helmet and global exception filter"
```

---

### Task 4: Rate limiting with ThrottlerModule

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Add ThrottlerModule to app.module.ts**

Replace the contents of `apps/api/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/prisma/prisma.module';
import { BlockchainModule } from './shared/blockchain/blockchain.module';
import { StorageModule } from './shared/storage/storage.module';
import { KycModule } from './shared/kyc/kyc.module';
import { PaymentsModule } from './shared/payments/payments.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { AuditModule } from './modules/audit/audit.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    BlockchainModule,
    StorageModule,
    KycModule,
    PaymentsModule,
    ReceivablesModule,
    DocumentsModule,
    SettlementsModule,
    AuditModule,
    InvestmentsModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 2: Add strict throttle on auth endpoints**

Replace the contents of `apps/api/src/modules/auth/auth.controller.ts` with:

```typescript
import { Controller, Post, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthRequest) {
    return this.authService.findMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: AuthRequest, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: AuthRequest, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, body);
  }

  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Run existing tests**

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (or same failures as before this task).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat(api): add global rate limiting, 5 req/min on auth endpoints"
```

---

### Task 5: Security headers in Next.js

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Replace the contents of `apps/web/next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

Expected: build succeeds (or same errors as before — do not introduce new errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(web): add security headers via Next.js config"
```

---

### Task 6: Remove /test page

**Files:**
- Delete: `apps/web/src/app/test/page.tsx`

- [ ] **Step 1: Delete the test page**

```bash
rm apps/web/src/app/test/page.tsx
rmdir apps/web/src/app/test 2>/dev/null || true
```

- [ ] **Step 2: Verify build still passes**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

Expected: build succeeds. The route `/test` should no longer exist.

- [ ] **Step 3: Commit**

```bash
git add -A apps/web/src/app/test/
git commit -m "chore(web): remove /test page — hardcoded credentials, not for production"
```

---

## Summary of changes

| Area | Change | Why |
|------|--------|-----|
| API | `AllExceptionsFilter` | No stack traces / internal errors in production responses |
| API | `helmet()` | Standard HTTP security headers |
| API | `ThrottlerModule` + `@Throttle` | 5 req/min on login+register, 100 req/min globally |
| Web | `next.config.ts` headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` |
| Web | Delete `/test` | Hardcoded credentials + debug tooling removed from production |
