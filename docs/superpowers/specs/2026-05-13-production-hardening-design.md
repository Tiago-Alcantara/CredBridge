# Production Hardening Design

## Goal

Eliminate information leakage in production: stack traces in API error responses, verbose internal fields in success responses, missing HTTP security headers, unprotected auth endpoints, and publicly accessible test page.

## Scope

### API (NestJS)
- Global exception filter: sanitizes error responses in production (no stack traces, generic 5xx messages)
- Helmet: adds standard HTTP security headers
- Rate limiting: `@nestjs/throttler` — strict on auth endpoints, relaxed globally

### Web (Next.js)
- Security headers in `next.config.ts`
- Delete `/test` page (hardcoded credentials, test tooling — not for production)

## Not in scope
- Response serialization via class-transformer (deferred — separate spec if needed)
- Auth middleware changes
- HTTPS enforcement (handled at infra/reverse-proxy level)
