---
type: community
cohesion: 0.12
members: 29
---

# Backend Modules & DB Migrations

**Cohesion:** 0.12 - loosely connected
**Members:** 29 nodes

## Members
- [[API Bootstrap (main.ts)]] - code - apps/api/src/main.ts
- [[Add User table migration]] - code - apps/api/prisma/migrations/20260502185341_add_user/migration.sql
- [[Align with shared types migration]] - code - apps/api/prisma/migrations/20260502184234_align_with_shared_types/migration.sql
- [[AppController e2e test]] - code - apps/api/test/app.e2e-spec.ts
- [[AppModule (NestJS Root)]] - code - apps/api/src/app.module.ts
- [[AuditController_1]] - code - apps/api/src/modules/audit/audit.controller.ts
- [[AuditLog table (Prisma)]] - code - apps/api/prisma/migrations/20260501155215_init/migration.sql
- [[AuditLogInput interface]] - code - apps/api/src/modules/audit/audit.service.ts
- [[AuditModule_1]] - code - apps/api/src/modules/audit/audit.module.ts
- [[AuditService_1]] - code - apps/api/src/modules/audit/audit.service.ts
- [[AuthController_1]] - code - apps/api/src/modules/auth/auth.controller.ts
- [[AuthModule_1]] - code - apps/api/src/modules/auth/auth.module.ts
- [[AuthService_1]] - code - apps/api/src/modules/auth/auth.service.ts
- [[Document table (Prisma)]] - code - apps/api/prisma/migrations/20260501155215_init/migration.sql
- [[DocumentsController_1]] - code - apps/api/src/modules/documents/documents.controller.ts
- [[DocumentsModule_1]] - code - apps/api/src/modules/documents/documents.module.ts
- [[DocumentsRepository_1]] - code - apps/api/src/modules/documents/documents.repository.ts
- [[DocumentsService_1]] - code - apps/api/src/modules/documents/documents.service.ts
- [[Initial schema migration]] - code - apps/api/prisma/migrations/20260501155215_init/migration.sql
- [[JwtAuthGuard_1]] - code - apps/api/src/modules/auth/jwt-auth.guard.ts
- [[JwtPayload interface]] - code - apps/api/src/modules/auth/auth.service.ts
- [[JwtStrategy (Passport)]] - code - apps/api/src/modules/auth/jwt.strategy.ts
- [[LoginDto_1]] - code - apps/api/src/modules/auth/dto/login.dto.ts
- [[Prisma config]] - code - apps/api/prisma.config.ts
- [[PrismaService (shared)]] - code - apps/api/src/shared/prisma/prisma.service.ts
- [[Receivable table (Prisma)]] - code - apps/api/prisma/migrations/20260501155215_init/migration.sql
- [[RegisterDto_1]] - code - apps/api/src/modules/auth/dto/register.dto.ts
- [[Settlement table (Prisma)]] - code - apps/api/prisma/migrations/20260501155215_init/migration.sql
- [[User table (Prisma)]] - code - apps/api/prisma/migrations/20260502185341_add_user/migration.sql

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Backend_Modules_&_DB_Migrations
SORT file.name ASC
```
