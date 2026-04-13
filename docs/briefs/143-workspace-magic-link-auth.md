# Brief: Workspace Magic-Link Authentication

**Date:** 2026-04-13
**Status:** draft
**Depends on:** Brief 123 (magic link infrastructure), Brief 088 (network API auth)
**Unlocks:** Secure workspace access on Railway, settings page, social account connections

## Goal

- **Roadmap phase:** Phase 9: Network Agent Continuous Operation
- **Capabilities:** Workspace owner authentication via magic link, session-gated workspace access

## Context

The workspace runs on Railway as a public URL. Currently there is **zero authentication** — anyone who knows the URL gets full workspace access (conversations, settings, processes, people data). This was acceptable during local development but is a blocker for production use.

Magic link infrastructure already exists for `/chat` (Brief 123): token generation, rate limiting, session cookies, consumption. The `/chat` auth flow works — email input → magic link sent → click link → session cookie set → authenticated. But this only protects the `/chat` page. The main workspace (`/`) and all workspace API routes are wide open.

The admin dashboard (`/admin`) uses a separate username/password login (Brief 090), but the project principle is **magic link only, no passwords**. The admin login should eventually migrate too, but that's out of scope here.

## Objective

The workspace owner can only access the workspace after authenticating via magic link. Unauthenticated visitors see a login screen. The owner's email is configured once (during setup or as an env var), and all magic links go to that address.

## Non-Goals

- Multi-user workspace access (single owner for MVP)
- Migrating admin dashboard auth (separate concern)
- OAuth / social login
- Password-based auth of any kind
- Protecting the front door / welcome page (that's public by design)

## Inputs

1. `src/engine/magic-link.ts` — existing magic link infrastructure (create, validate, consume, rate limit)
2. `packages/web/app/chat/auth/route.ts` — existing magic link auth flow for /chat
3. `packages/web/app/api/v1/chat/session/route.ts` — existing session cookie pattern
4. `packages/web/app/page.tsx` — entry point (currently no auth)
5. `packages/web/app/entry-point.tsx` — workspace vs setup routing
6. `packages/web/components/layout/workspace.tsx` — main workspace layout

## Constraints

- Magic link only — no passwords anywhere in the workspace auth flow
- Reuse the existing magic link infrastructure from Brief 123 — don't rebuild
- Session cookie pattern: httpOnly, secure in production, 30-day rolling TTL (same as /chat)
- Workspace owner email configured via `WORKSPACE_OWNER_EMAIL` env var (set on Railway)
- Front door (`/welcome`) and public marketing pages remain unauthenticated
- The `/chat` auth flow (Brief 123) continues to work independently — it authenticates visitors, not the owner
- Workspace API routes (`/api/v1/integrations/*`, future workspace-internal routes) are gated by the same session
- Network API routes (`/api/v1/network/*`) keep their existing Bearer token auth — separate concern

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/web/middleware.ts` | Create: Next.js middleware — check session cookie on workspace routes, redirect to login if missing. Allow `/welcome`, `/chat`, `/api/v1/network/*`, `/api/v1/chat/*` through. |
| `packages/web/app/login/page.tsx` | Create: Login page — shows email input (pre-filled if `WORKSPACE_OWNER_EMAIL` is set), sends magic link, shows "check your email" confirmation. |
| `packages/web/app/login/auth/route.ts` | Create: Magic link callback — validates token, sets `ditto_workspace_session` cookie, redirects to `/`. |
| `packages/web/app/api/v1/workspace/session/route.ts` | Create: Session check endpoint — returns `{ authenticated, email }` from cookie. |
| `packages/web/app/api/v1/workspace/request-link/route.ts` | Create: Send magic link endpoint — validates email matches owner, creates magic link, sends via AgentMail. |
| `.env.example` | Modify: add `WORKSPACE_OWNER_EMAIL` |
| `packages/web/components/layout/workspace.tsx` | Modify: add user email display / logout in nav (optional, if simple) |

## Acceptance Criteria

1. [ ] Unauthenticated visitor to `/` gets redirected to `/login`
2. [ ] Login page shows email input and "Send magic link" button
3. [ ] Magic link is sent to the configured owner email via AgentMail
4. [ ] Clicking magic link sets `ditto_workspace_session` cookie and redirects to `/`
5. [ ] Authenticated owner can access all workspace routes (`/`, Settings, etc.)
6. [ ] Session persists across browser restarts (30-day cookie)
7. [ ] `/welcome` page remains accessible without auth (public front door)
8. [ ] `/chat` auth flow (Brief 123) continues to work independently
9. [ ] Network API routes (`/api/v1/network/*`) are unaffected (keep Bearer token auth)
10. [ ] `WORKSPACE_OWNER_EMAIL` env var controls who can authenticate
11. [ ] If `WORKSPACE_OWNER_EMAIL` is not set (local dev), workspace is accessible without auth
12. [ ] Rate limiting: max 5 magic links per hour (reuses existing rate limit from Brief 123)
13. [ ] Workspace-internal API routes (`/api/v1/integrations/*`) are gated by workspace session cookie
14. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review checks: middleware correctness, cookie security, session lifecycle, no password anywhere, clean separation from network auth
3. Present work + review to human

## Smoke Test

```bash
# Type check
pnpm run type-check

# Unit tests
pnpm test

# Manual: visit workspace URL without session → should redirect to /login
# Manual: enter owner email → receive magic link → click → arrive at workspace
# Manual: visit /welcome without session → should work (public)
# Manual: visit /api/v1/integrations/unipile without session cookie → should 401
```

## After Completion

1. Update `docs/state.md`: "Workspace auth: magic-link login for workspace owner"
2. Set `WORKSPACE_OWNER_EMAIL` on Railway for the deployed workspace
3. Update Settings connections panel to verify session before showing connections
