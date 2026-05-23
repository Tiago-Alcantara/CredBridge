# Public Landing Subdomain Design

**Date:** 2026-05-23
**Scope:** Exclusive public landing page on Vercel production and optional custom host
**Status:** Approved for implementation planning

## Goal

Serve `cred-bridge.vercel.app` and, when configured, `www.lane-credbridge.app`
as public presentation-only sites. Visitors may view the existing CredBridge
landing page, but cannot navigate from those hosts to login, onboarding,
dashboards, auditing, or other application routes.

## Current Context

- The Next.js 16 web application already serves the marketing landing page at
  `/` from `apps/web/src/app/(marketing)/page.tsx`.
- Authentication and dashboard routes remain part of the same web application.
- The landing currently includes links to `/login` and `/partner/dashboard` in
  `TopNav`, `HeroNetwork`, and `Audiences`.
- A local, uncommitted `vercel.json` edit started a redirect for
  `www.lane-credbridge.app`, but targets a placeholder application domain and
  does not implement landing-only behavior.

## Chosen Behavior

### Public host

For requests whose hostname is `cred-bridge.vercel.app` or
`www.lane-credbridge.app`:

- `/` renders the existing marketing landing visual design in public-only mode.
- The public-only landing shows no login, registration, dashboard, or
  application-access links.
- Direct navigation to application paths, including `/login`, `/onboarding`,
  `/pme/*`, `/investor/*`, `/partner/*`, and `/auditoria`, redirects to `/`.
- Required Next.js runtime assets and static assets continue to load normally.

### Other hosts

Local development, preview deployments, and any other configured host preserve
the existing application behavior:

- `/` continues to be able to link into the current authentication/application
  flow.
- `/login` and dashboard routes remain available according to their existing
  authentication guards.

Creating or configuring a dedicated authenticated production subdomain is out
of scope for this change.

## Architecture

### Host-based route restriction

Add a Next.js 16 `proxy.ts` beside `src/app`, following the framework's current
Proxy convention. The proxy detects the Vercel production host and optional
custom public host from the request hostname, then applies public-host routing
rules before page rendering:

- allow the landing request and framework/static asset requests;
- rewrite the public landing request to its public-only rendering variant;
- redirect any other page request on the public host to `/`;
- return normal routing behavior for all non-public hosts.

The proxy is a presentation boundary for this hostname, not an authentication
mechanism. API and protected application security remain governed by their
existing controls.

### Landing variant

Reuse the existing marketing sections and styling. Introduce an explicit
public-only variant rather than copying the page:

- `TopNav` suppresses login/access links in public-only mode;
- `HeroNetwork` suppresses actions that lead to login or dashboard routes;
- `Audiences` suppresses or replaces application-entry actions so no internal
  navigation is offered;
- purely informational sections and the footer remain available.

The normal landing variant remains unchanged on non-public hosts.

### Deployment configuration

Remove or replace the incomplete host redirect currently present in
`vercel.json`; the public host must render the landing on the same deployment,
not redirect to a placeholder authenticated domain. DNS/domain attachment in
Vercel is an operational step outside the source-code change.

## Error And Edge Handling

- A visitor manually entering a blocked path on the public host receives a
  redirect to the public landing root.
- Query strings on blocked application paths do not expose those pages; the
  response still redirects to `/`.
- Requests for Next.js bundles, images, icon assets, and other landing
  dependencies are excluded from the redirect rule so the page renders fully.

## Verification

- Add focused proxy tests for public-host root handling, blocked page
  redirection, asset pass-through, and non-public-host pass-through.
- Add component/page coverage for the public-only landing variant to verify
  authentication and dashboard links are absent while informational content
  remains.
- Run the web test suite, lint, and production build after implementation.
- Manually smoke-test `cred-bridge.vercel.app/` and a direct blocked URL such
  as `cred-bridge.vercel.app/login`; repeat on `www.lane-credbridge.app`
  if that custom host is attached later.

## Out Of Scope

- Building a new landing page design.
- Creating an authenticated production subdomain.
- Changing authentication, authorization, or backend behavior.
- Removing the application routes from preview or local development hosts.
