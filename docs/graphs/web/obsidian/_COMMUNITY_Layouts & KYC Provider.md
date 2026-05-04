---
type: community
cohesion: 0.21
members: 14
---

# Layouts & KYC Provider

**Cohesion:** 0.21 - loosely connected
**Members:** 14 nodes

## Members
- [[AuthLayout (route group)]] - code - apps/web/src/app/(auth)/layout.tsx
- [[InvestorDashboardPage]] - code - apps/web/src/app/(investor)/investor/dashboard/page.tsx
- [[InvestorLayout]] - code - apps/web/src/app/(investor)/layout.tsx
- [[KycProviderService]] - code - apps/api/src/shared/kyc/kyc.service.ts
- [[LoginPage]] - code - apps/web/src/app/(auth)/login/page.tsx
- [[MarketingLandingPage]] - code - apps/web/src/app/(marketing)/page.tsx
- [[OnboardingPage stub]] - code - apps/web/src/app/(auth)/onboarding/page.tsx
- [[PartnerDashboardPage]] - code - apps/web/src/app/(partner)/partner/dashboard/page.tsx
- [[PartnerLayout]] - code - apps/web/src/app/(partner)/layout.tsx
- [[PmeDashboardPage]] - code - apps/web/src/app/(pme)/pme/dashboard/page.tsx
- [[PmeLayout]] - code - apps/web/src/app/(pme)/layout.tsx
- [[RootLayout (Web)]] - code - apps/web/src/app/layout.tsx
- [[StellarService]] - code - apps/api/src/shared/blockchain/stellar.service.ts
- [[TestPage (smoke test)]] - code - apps/web/src/app/test/page.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Layouts_&_KYC_Provider
SORT file.name ASC
```
