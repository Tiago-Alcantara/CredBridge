# Graph Report - /home/tiago-linux/projects/CredBridge/apps/api  (2026-05-03)

## Corpus Check
- 57 files · ~20,791 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 238 nodes · 212 edges · 50 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Modules & Audit|App Modules & Audit]]
- [[_COMMUNITY_DTOs & Prisma Service|DTOs & Prisma Service]]
- [[_COMMUNITY_Domain Concepts & Docs|Domain Concepts & Docs]]
- [[_COMMUNITY_AuthService|AuthService]]
- [[_COMMUNITY_DI Tokens & Module Interfaces|DI Tokens & Module Interfaces]]
- [[_COMMUNITY_AuthController|AuthController]]
- [[_COMMUNITY_SettlementsController|SettlementsController]]
- [[_COMMUNITY_SettlementsRepository|SettlementsRepository]]
- [[_COMMUNITY_SettlementsService|SettlementsService]]
- [[_COMMUNITY_ReceivablesRepository|ReceivablesRepository]]
- [[_COMMUNITY_ReceivablesController|ReceivablesController]]
- [[_COMMUNITY_ReceivablesService|ReceivablesService]]
- [[_COMMUNITY_Prisma Schema & Migrations|Prisma Schema & Migrations]]
- [[_COMMUNITY_AuditService|AuditService]]
- [[_COMMUNITY_DocumentsRepository|DocumentsRepository]]
- [[_COMMUNITY_DocumentsController|DocumentsController]]
- [[_COMMUNITY_DocumentsService|DocumentsService]]
- [[_COMMUNITY_S3 Storage Service|S3 Storage Service]]
- [[_COMMUNITY_Stellar Blockchain Service|Stellar Blockchain Service]]
- [[_COMMUNITY_AuditController|AuditController]]
- [[_COMMUNITY_Misc 20|Misc 20]]
- [[_COMMUNITY_Misc 21|Misc 21]]
- [[_COMMUNITY_Misc 22|Misc 22]]
- [[_COMMUNITY_Misc 23|Misc 23]]
- [[_COMMUNITY_Misc 24|Misc 24]]
- [[_COMMUNITY_Misc 25|Misc 25]]
- [[_COMMUNITY_Misc 26|Misc 26]]
- [[_COMMUNITY_Misc 27|Misc 27]]
- [[_COMMUNITY_Misc 29|Misc 29]]
- [[_COMMUNITY_Misc 30|Misc 30]]
- [[_COMMUNITY_Misc 31|Misc 31]]
- [[_COMMUNITY_Misc 32|Misc 32]]
- [[_COMMUNITY_Misc 33|Misc 33]]
- [[_COMMUNITY_Misc 34|Misc 34]]
- [[_COMMUNITY_Misc 35|Misc 35]]
- [[_COMMUNITY_Misc 36|Misc 36]]
- [[_COMMUNITY_Misc 37|Misc 37]]
- [[_COMMUNITY_Misc 38|Misc 38]]
- [[_COMMUNITY_Misc 39|Misc 39]]
- [[_COMMUNITY_Misc 40|Misc 40]]
- [[_COMMUNITY_Misc 41|Misc 41]]
- [[_COMMUNITY_Misc 42|Misc 42]]
- [[_COMMUNITY_Misc 43|Misc 43]]
- [[_COMMUNITY_Misc 44|Misc 44]]
- [[_COMMUNITY_Misc 45|Misc 45]]
- [[_COMMUNITY_Misc 46|Misc 46]]
- [[_COMMUNITY_Misc 47|Misc 47]]
- [[_COMMUNITY_Misc 48|Misc 48]]
- [[_COMMUNITY_Misc 49|Misc 49]]
- [[_COMMUNITY_Misc 63|Misc 63]]

## God Nodes (most connected - your core abstractions)
1. `AuthService` - 8 edges
2. `AuthModule` - 8 edges
3. `AuthService` - 7 edges
4. `ReceivablesRepository` - 7 edges
5. `AuthController` - 6 edges
6. `AuditService` - 6 edges
7. `Initial schema migration` - 6 edges
8. `SettlementsController` - 5 edges
9. `SettlementsRepository` - 5 edges
10. `SettlementsService` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Settlement interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/settlement.ts → docs/STATUS.md
- `Investor interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/investor.ts → docs/STATUS.md
- `CredBridge README (monorepo overview)` --references--> `Types Barrel Index`  [EXTRACTED]
  README.md → packages/types/src/index.ts
- `SettlementsService` --conceptually_related_to--> `PixService`  [AMBIGUOUS]
  apps/api/src/modules/settlements/settlements.service.ts → apps/api/src/shared/payments/pix.service.ts
- `Nest starter README (apps/api)` --conceptually_related_to--> `CredBridge README (monorepo overview)`  [INFERRED]
  apps/api/README.md → README.md

## Communities (64 total, 42 thin omitted)

### Community 0 - "App Modules & Audit"
Cohesion: 0.15
Nodes (23): AppController e2e test, AppModule (NestJS Root), AuditController, AuditLogInput interface, AuditModule, AuditService, AuditLog table (Prisma), AuthController (+15 more)

### Community 1 - "DTOs & Prisma Service"
Cohesion: 0.25
Nodes (14): CreateDocumentDto, CreateNestedDocumentDto, CreateReceivableDto, CreateSettlementDto, PrismaModule, PrismaService, ReceivablesController, ReceivablesModule (+6 more)

### Community 2 - "Domain Concepts & Docs"
Cohesion: 0.17
Nodes (13): CredBridge README (monorepo overview), Nest starter README (apps/api), Stellar SEP-10 challenge/verify (stub), Document interface, DocumentType (invoice|contract|duplicate|kyc), RegisterDocumentInput, UploadDocumentInput, Types Barrel Index (+5 more)

### Community 4 - "DI Tokens & Module Interfaces"
Cohesion: 0.32
Nodes (8): BLOCKCHAIN_SERVICE DI Token, BlockchainService Interface, BlockchainModule (Global), KYC_SERVICE DI Token, KycService Interface, KycModule (Global), KycProviderService, StellarService

### Community 12 - "Prisma Schema & Migrations"
Cohesion: 0.6
Nodes (6): Align with shared types migration, Document table (Prisma), Initial schema migration, Prisma config, Receivable table (Prisma), Settlement table (Prisma)

### Community 24 - "Misc 24"
Cohesion: 0.5
Nodes (4): PAYMENTS_SERVICE token, PaymentsService (interface), PaymentsModule, PixService

### Community 25 - "Misc 25"
Cohesion: 0.5
Nodes (4): S3Service, STORAGE_SERVICE token, StorageService (interface), StorageModule

### Community 26 - "Misc 26"
Cohesion: 0.5
Nodes (4): CreateReceivableInput, Receivable, ReceivableStatus, ReceivableType

## Ambiguous Edges - Review These
- `SettlementsService` → `PixService`  [AMBIGUOUS]
  apps/api/src/modules/settlements/settlements.service.ts · relation: conceptually_related_to

## Knowledge Gaps
- **41 isolated node(s):** `AppModule`, `AuditModule`, `JwtAuthGuard`, `AuthModule`, `LoginDto` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SettlementsService` and `PixService`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Are the 3 inferred relationships involving `ReceivablesRepository` (e.g. with `CreateDocumentDto` and `CreateSettlementDto`) actually correct?**
  _`ReceivablesRepository` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppModule`, `AuditModule`, `JwtAuthGuard` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._