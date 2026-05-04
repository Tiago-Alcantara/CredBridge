---
type: community
cohesion: 0.15
members: 20
---

# DI Tokens & Module Interfaces

**Cohesion:** 0.15 - loosely connected
**Members:** 20 nodes

## Members
- [[AuthLayout (route group)]] - code - apps/web/src/app/(auth)/layout.tsx
- [[BLOCKCHAIN_SERVICE DI Token]] - code - apps/api/src/shared/blockchain/blockchain.interface.ts
- [[BlockchainModule (Global)]] - code - apps/api/src/shared/blockchain/blockchain.module.ts
- [[BlockchainService Interface]] - code - apps/api/src/shared/blockchain/blockchain.interface.ts
- [[InvestorDashboardPage]] - code - apps/web/src/app/(investor)/investor/dashboard/page.tsx
- [[InvestorLayout]] - code - apps/web/src/app/(investor)/layout.tsx
- [[KYC_SERVICE DI Token]] - code - apps/api/src/shared/kyc/kyc.interface.ts
- [[KycModule (Global)]] - code - apps/api/src/shared/kyc/kyc.module.ts
- [[KycProviderService_1]] - code - apps/api/src/shared/kyc/kyc.service.ts
- [[KycService Interface]] - code - apps/api/src/shared/kyc/kyc.interface.ts
- [[LoginPage]] - code - apps/web/src/app/(auth)/login/page.tsx
- [[MarketingLandingPage]] - code - apps/web/src/app/(marketing)/page.tsx
- [[OnboardingPage stub]] - code - apps/web/src/app/(auth)/onboarding/page.tsx
- [[PartnerDashboardPage]] - code - apps/web/src/app/(partner)/partner/dashboard/page.tsx
- [[PartnerLayout]] - code - apps/web/src/app/(partner)/layout.tsx
- [[PmeDashboardPage]] - code - apps/web/src/app/(pme)/pme/dashboard/page.tsx
- [[PmeLayout]] - code - apps/web/src/app/(pme)/layout.tsx
- [[RootLayout (Web)]] - code - apps/web/src/app/layout.tsx
- [[StellarService_1]] - code - apps/api/src/shared/blockchain/stellar.service.ts
- [[TestPage (smoke test)]] - code - apps/web/src/app/test/page.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/DI_Tokens_&_Module_Interfaces
SORT file.name ASC
```
