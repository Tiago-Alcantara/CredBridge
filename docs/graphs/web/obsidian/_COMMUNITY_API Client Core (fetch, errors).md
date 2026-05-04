---
type: community
cohesion: 0.10
members: 22
---

# API Client Core (fetch, errors)

**Cohesion:** 0.10 - loosely connected
**Members:** 22 nodes

## Members
- [[@tanstackreact-query]] - code - external
- [[ApiError_1]] - code - apps/web/src/lib/api/client.ts
- [[AuditEntityType]] - code - packages/types/src/audit.ts
- [[AuditEvent]] - code - packages/types/src/audit.ts
- [[QueryProvider]] - code - apps/web/src/providers/QueryProvider.tsx
- [[apiFetch]] - code - apps/web/src/lib/api/client.ts
- [[clearAccessToken]] - code - apps/web/src/lib/api/auth-storage.ts
- [[extractApiErrorMessage]] - code - apps/web/src/lib/api/client.ts
- [[getAccessToken]] - code - apps/web/src/lib/api/auth-storage.ts
- [[logout]] - code - apps/web/src/lib/api/auth.ts
- [[nextnavigation]] - code - external
- [[setAccessToken]] - code - apps/web/src/lib/api/auth-storage.ts
- [[setOnUnauthorized]] - code - apps/web/src/lib/api/client.ts
- [[useAuditTrail]] - code - apps/web/src/lib/api/audit.ts
- [[useCreateDocument]] - code - apps/web/src/lib/api/documents.ts
- [[useCreateSettlement]] - code - apps/web/src/lib/api/settlements.ts
- [[useDocumentsByReceivable]] - code - apps/web/src/lib/api/documents.ts
- [[useLogin]] - code - apps/web/src/lib/api/auth.ts
- [[useReceivable]] - code - apps/web/src/lib/api/receivables.ts
- [[useRegister]] - code - apps/web/src/lib/api/auth.ts
- [[useSettlements]] - code - apps/web/src/lib/api/settlements.ts
- [[useSettlementsByReceivable]] - code - apps/web/src/lib/api/settlements.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/API_Client_Core_(fetch,_errors)
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Receivables Hooks & Validations]]
- 1 edge to [[_COMMUNITY_Pattern Components (SidebarTopBar)]]

## Top bridge nodes
- [[apiFetch]] - degree 14, connects to 1 community
- [[nextnavigation]] - degree 2, connects to 1 community