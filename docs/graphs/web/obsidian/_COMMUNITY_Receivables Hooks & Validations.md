---
type: community
cohesion: 0.20
members: 10
---

# Receivables Hooks & Validations

**Cohesion:** 0.20 - loosely connected
**Members:** 10 nodes

## Members
- [[CreateReceivableInput]] - code - packages/types/src/receivable.ts
- [[Receivable]] - code - packages/types/src/receivable.ts
- [[ReceivableStatus]] - code - packages/types/src/receivable.ts
- [[ReceivableType]] - code - packages/types/src/receivable.ts
- [[createReceivableSchema]] - code - apps/web/src/lib/validations/receivable.ts
- [[settleReceivableSchema]] - code - apps/web/src/lib/validations/settlement.ts
- [[uploadDocumentSchema]] - code - apps/web/src/lib/validations/document.ts
- [[useCreateReceivable]] - code - apps/web/src/lib/api/receivables.ts
- [[useReceivables]] - code - apps/web/src/lib/api/receivables.ts
- [[zod]] - code - external

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Receivables_Hooks_&_Validations
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_API Client Core (fetch, errors)]]

## Top bridge nodes
- [[useCreateReceivable]] - degree 2, connects to 1 community
- [[useReceivables]] - degree 2, connects to 1 community