---
type: community
cohesion: 0.09
members: 32
---

# Web API Hooks (auth/receivables/settlements)

**Cohesion:** 0.09 - loosely connected
**Members:** 32 nodes

## Members
- [[.constructor()_15]] - code - apps/web/src/lib/api/client.ts
- [[ApiError]] - code - apps/web/src/lib/api/client.ts
- [[apiFetch()]] - code - apps/web/src/lib/api/client.ts
- [[audit.ts]] - code - apps/web/src/lib/api/audit.ts
- [[auth-storage.ts]] - code - apps/web/src/lib/api/auth-storage.ts
- [[auth.ts]] - code - apps/web/src/lib/api/auth.ts
- [[clearAccessToken()]] - code - apps/web/src/lib/api/auth-storage.ts
- [[client.ts]] - code - apps/web/src/lib/api/client.ts
- [[documents.ts]] - code - apps/web/src/lib/api/documents.ts
- [[extractApiErrorMessage()]] - code - apps/web/src/lib/api/client.ts
- [[getAccessToken()]] - code - apps/web/src/lib/api/auth-storage.ts
- [[handleCreate()]] - code - apps/web/src/app/test/page.tsx
- [[handleLogin()]] - code - apps/web/src/app/test/page.tsx
- [[handleLogout()]] - code - apps/web/src/app/test/page.tsx
- [[handlePing()]] - code - apps/web/src/app/test/page.tsx
- [[handleRegister()]] - code - apps/web/src/app/test/page.tsx
- [[logout()]] - code - apps/web/src/lib/api/auth.ts
- [[page.tsx_3]] - code - apps/web/src/app/test/page.tsx
- [[receivables.ts]] - code - apps/web/src/lib/api/receivables.ts
- [[setAccessToken()]] - code - apps/web/src/lib/api/auth-storage.ts
- [[settlements.ts]] - code - apps/web/src/lib/api/settlements.ts
- [[useAuditTrail()]] - code - apps/web/src/lib/api/audit.ts
- [[useCreateDocument()]] - code - apps/web/src/lib/api/documents.ts
- [[useCreateReceivable()]] - code - apps/web/src/lib/api/receivables.ts
- [[useCreateSettlement()]] - code - apps/web/src/lib/api/settlements.ts
- [[useDocumentsByReceivable()]] - code - apps/web/src/lib/api/documents.ts
- [[useLogin()]] - code - apps/web/src/lib/api/auth.ts
- [[useReceivable()]] - code - apps/web/src/lib/api/receivables.ts
- [[useReceivables()]] - code - apps/web/src/lib/api/receivables.ts
- [[useRegister()]] - code - apps/web/src/lib/api/auth.ts
- [[useSettlements()]] - code - apps/web/src/lib/api/settlements.ts
- [[useSettlementsByReceivable()]] - code - apps/web/src/lib/api/settlements.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Web_API_Hooks_(auth/receivables/settlements)
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Root Provider & Theme]]

## Top bridge nodes
- [[client.ts]] - degree 6, connects to 1 community