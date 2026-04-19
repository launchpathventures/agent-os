# Brief 200: Workspace Git-over-HTTPS Server + Bootstrap

**Date:** 2026-04-20
**Status:** ready
**Depends on:** Brief 197 (phase design — shared constraints)
**Unlocks:** user-facing access for Brief 199 (memories projection) and **every future Category-1/2/3/4 legibility sub-brief**; this brief is shared infrastructure, not memories-specific

## Goal

- **Roadmap phase:** Phase 9+ (legibility — shared infrastructure)
- **Capabilities delivered:**
  - Ditto serves the workspace projection tree as an authenticated git remote over HTTPS
  - User runs `git clone https://<workspace>.ditto.you.git` once with credentials Ditto issues them, then `git pull` to refresh
  - Zero external-service dependency — Ditto is the git server; no GitHub, no GitLab, no Gitea
  - Workspace bootstrap (git init, initial commit, README, `.gitignore`) on first workspace activation
  - A "Clone workspace" UI affordance in Ditto that surfaces the URL and lets the user generate a clone credential

## Context

Brief 199 projects memories to `/workspace/memories/` inside the Ditto workspace's Railway container. Without a serving mechanism, the projection is invisible to the user — the files live in a container, not on their laptop. Earlier architect drafts proposed syncing to the user's GitHub; user rejected the external dependency. This brief makes Ditto itself the git remote: the workspace IS the repo; the user clones it from Ditto.

This is standard self-hosted-git shape (`gitea`, `gogs`, Azure DevOps all do this). `isomorphic-git` provides both the write side (Brief 199's commits) and the serve side (this brief's HTTP protocol). Authentication integrates with Ditto's existing session mechanism via a separate credential type ("Clone credential") because git clients use HTTP basic-auth, which doesn't mesh with session cookies.

Because every future legibility sub-brief (outbound comms, inbound comms, generated artefacts, and the remaining Category-4 internal-state sub-briefs) will project into the same workspace volume, this brief's infrastructure is amortised across all of them. It is phase infrastructure, not memories-specific.

## Objective

Ship an authenticated git-over-HTTPS server integrated into Ditto's existing HTTP stack that serves the workspace projection tree as a cloneable git repo, plus a one-time workspace bootstrap that initialises the repo with a README and sensible `.gitignore`, plus a UI affordance that surfaces the clone URL and lets the user generate a clone credential.

## Non-Goals

- **No push support (v1 is clone/pull-only).** User edits in their clone are not pushed back to Ditto. Aligned with parent brief §Constraints (read-only projection v1).
- **No SSH server.** HTTPS only. Git clients handle HTTPS natively; SSH adds key-distribution complexity for no v1 benefit.
- **No public (unauthenticated) URLs.** Every clone requires a credential. No "public repo" mode.
- **No WebDAV, FUSE, SFTP, or other access modes.** Git clone/pull is the v1 access mechanism; other modes are deferred to future briefs if demand surfaces.
- **No Git LFS.** Projection content is all markdown; no binary blobs expected.
- **No per-file access control.** Credential-holder sees the whole clone. Secret filtering happens at projection-time (Brief 199); the clone does not re-filter.
- **No multi-user workspace access in this brief.** Per `ditto.you` topology (project memory `domain_topology`), workspaces are per-user. If a workspace ever becomes multi-user, that's a separate brief.
- **No CDN / cache layer.** Direct serve from the workspace container. Workspaces have one user; clone cadence is manual; caching is premature optimisation.
- **No GUI repo browser** (gitea-style). User browses in their own editor/tool after cloning. Ditto's existing UI is where the inspection story lives; the clone is for tool-independent access.

## Inputs

1. `docs/briefs/197-user-facing-legibility-phase.md` — parent brief; binding constraints
2. `docs/briefs/199-memories-projection-and-safety-filter.md` — the content this server serves
3. `docs/research/user-facing-legibility-patterns.md` — cabinet's pattern (cabinet commits; Ditto also serves)
4. Ditto's existing HTTP routing (verify framework: check `packages/web/` and `src/engine/` for existing Hono/Express/Next route registration; match the prevailing pattern)
5. Ditto's existing session/auth mechanism (verify in `src/engine/auth*` or `packages/web/app/api/auth*`); credential generation + validation must bridge to this layer
6. `isomorphic-git` documentation, specifically the HTTP server components (`isomorphic-git/http/node`, fetch/push endpoint handlers)
7. Git Smart HTTP protocol (reference: https://git-scm.com/docs/http-protocol) — for understanding ref advertisement, `info/refs?service=git-upload-pack`, and `git-upload-pack` endpoint shapes
8. `docs/adrs/025-centralized-network-service.md` — deployment shape; confirms workspace = container-per-user
9. Project memory `project_domain_topology.md` — `ditto.you` = per-user workspace face; clone URL shape should fit this topology
10. Insight-180 (side-effecting function guard) — serving git content reads from the workspace volume; receive-pack is not implemented v1 so no write-side concerns

## Constraints

All parent brief §Constraints inherit. Additionally:

- **`isomorphic-git` chosen ahead of build.** Matches Brief 199's choice; pure JS; no native deps; includes HTTP server helpers in `@isomorphic-git/http-node`. Added as `depend` in Provenance.
- **HTTP framework is Next.js 15 Route Handlers.** Ditto's web server is Next.js (`packages/web/`); there is no Hono/Express/Fastify. The git server mounts as a catch-all Route Handler at `packages/web/app/ws.git/[[...path]]/route.ts` (Next.js optional catch-all dynamic route). Handler bridges Next.js `Request` / `Response` to `@isomorphic-git/http-node`'s handler shape (lightweight adapter in `src/engine/legibility/git-server.ts`).
- **Middleware exemption.** `packages/web/middleware.ts` applies the `ditto_workspace_session` HMAC-signed cookie check to most routes. The `/ws.git/*` path MUST be exempted from that middleware because git clients use HTTP basic-auth (`Authorization: Basic <base64(user:pass)>`), not session cookies. Middleware matcher config gets a negative match for `^/ws\.git(/|$)`.
- **URL topology is path-based, not sub-domain-based.** Clone URL is `https://ditto.you/<workspace-slug>/ws.git` (workspace-slug comes from existing Ditto workspace identity — verify the identifier used in `packages/web/middleware.ts` / existing workspace config; use that same identifier in the URL). Per-workspace sub-domains (e.g., `<slug>.ditto.you`) are NOT assumed because that DNS topology is not currently deployed. If per-workspace sub-domains ship later, the URL can additionally support that shape; but v1 uses path-based to avoid pre-committing DNS.
- **Clone credentials are a new credential type, separate from session cookies.** Git HTTP clients use `Authorization: Basic <base64(user:pass)>`. The server accepts this; user is any non-empty string (e.g., `clone`); pass is a Ditto-issued token (32+ chars, cryptographically random). Tokens are stored hashed (bcrypt or scrypt), not plaintext.
- **Clone credentials are user-visible and user-revokable.** UI shows the list of issued credentials with last-used timestamp; user can revoke any credential; revoked credentials return HTTP 401 on next clone/pull attempt.
- **Rate-limit the server endpoints.** Per-credential limit: 30 requests/minute for info/refs; 5 clones/hour. Protects against misconfigured clients spinning in a retry loop. Not a security control; a safety control. **New module** — there is no shared Ditto rate-limit helper today (existing rate-limit patterns are ad-hoc, e.g., in `src/engine/network-verify.ts`). Brief 200 introduces `src/engine/legibility/rate-limit.ts` as a small standalone helper; if a shared helper emerges later, refactor is trivial.
- **No external-service dependency.** No GitHub, GitLab, Gitea. The server is self-contained. Brief verified by `grep -r "github\|gitlab\|gitea" src/engine/legibility/` returning only matches in comments/docs.
- **Engine-core boundary.** Server code lives in `src/engine/legibility/`. Auth-bridge code may touch existing `src/engine/auth*` modules if needed. Zero `packages/core/` changes unless a new credential type must be added to the schema — in which case it's a schema migration handled with the Drizzle discipline (Insight-190), and the brief must be updated to reflect this.
- **Side-effecting function guard (Insight-180) — credential issuance exemption.** `issueCloneCredential` persists a row to the DB (internal side effect) but is NOT wrapped in a process-run (it's a direct admin UI action triggered by a user clicking "Generate credential" on the clone page). Insight-180's `stepRunId` guard targets **externally-observable** side effects that should be tied to an accountable process-run (email sends, webhook posts, payment operations). Clone credential issuance is an admin UI action that writes to a single DB row and is audit-logged via the `activities` table; it does NOT need `stepRunId`. Exemption documented inline at the top of `git-server-auth.ts`: `// stepRunId not required: admin-UI-triggered credential issuance; internal side effect only; audit-logged via activities table`. Read-serving endpoints (info/refs, upload-pack) have no side effects and are trivially exempt.
- **No mobile clone UX.** Mobile users see the clone URL in the UI but cannot clone from a phone practically; "Edit @ desk" (Insight-012) applies.
- **Workspace bootstrap is idempotent.** Running bootstrap on an already-bootstrapped workspace is a no-op; verified by an integration test that runs bootstrap twice.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Self-hosted git-over-HTTPS server | gitea / gogs (public architecture) | pattern | Mature self-hosted-git pattern; Ditto's composition uses `isomorphic-git` rather than a gitea dependency |
| `isomorphic-git` + `@isomorphic-git/http-node` | github.com/isomorphic-git/isomorphic-git — MIT license, v1.x (mature), ~10k stars, active maintenance, TypeScript-native. Brief verification (2026-04-20): no existing usage in Ditto `package.json` files, so this is a genuine net-new `depend`. | depend | Pure JS (zero native deps; works in Next.js Edge and Node runtimes); matches Brief 199's choice (shared dep amortises cost); includes HTTP serve helpers |
| Clone credential as separate auth type | Standard PAT pattern (GitHub PAT, GitLab PAT, etc.) | pattern | Established user-facing pattern for separating long-lived machine-usable credentials from session cookies |
| Rate limiting shape | Existing Ditto rate-limit patterns (verify `src/engine/rate-limit*` or equivalent) | pattern (self-reuse) | Match existing Ditto conventions |
| Bootstrap README template | Original (Ditto-specific explanation of the clone-pull round-trip and legibility model) | original | Ditto-specific content |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/legibility/git-server.ts` | Create: exports Next.js-Route-Handler-compatible handlers for `GET /ws.git/.../info/refs?service=git-upload-pack` and `POST /ws.git/.../git-upload-pack` (the two Smart HTTP endpoints Ditto needs to serve for read-only clone); bridges Next.js `Request` / `Response` to `@isomorphic-git/http-node`'s expected shape |
| `src/engine/legibility/git-server-auth.ts` | Create: issue + validate + revoke clone credentials; bcrypt-hashed storage (cost 12); basic-auth validation helper |
| `src/engine/legibility/rate-limit.ts` | Create: small in-memory per-credential rate limiter (30 req/min info/refs; 5 clones/hour). Standalone module; no dependency on future shared helpers |
| `src/engine/legibility/workspace-bootstrap.ts` | Create: `bootstrapWorkspaceGit(repoPath)` — idempotently `git init`, writes initial `README.md` + `.gitignore`, commits as `Ditto Agent`; called from existing workspace-readiness / provisioner code (verify integration point by grepping for `workspace-readiness` or `workspace-provisioner` in `src/engine/`) |
| `src/engine/legibility/git-server.test.ts` | Create: integration tests — clone a test workspace via real git client; verify auth rejection on bad cred; verify rate-limit; verify pull returns only new commits |
| `src/engine/legibility/git-server-spike.test.ts` | Create: Insight-180 spike test — ONE real `git clone` against a live local server; verifies Smart HTTP protocol compatibility with `@isomorphic-git/http-node` before the rest of the brief builds |
| `packages/web/app/ws.git/[[...path]]/route.ts` | Create: Next.js 15 Route Handler — optional catch-all that forwards `GET`/`POST` to `git-server.ts`. Matches conventional Next.js routing in this repo. |
| `packages/web/middleware.ts` | **Modify:** exempt `/ws.git/*` from the `ditto_workspace_session` cookie check (git clients use basic-auth on the request, not cookies). Add negative matcher or explicit bypass logic. |
| `packages/web/app/clone/page.tsx` | Create: UI affordance — displays clone URL, "Generate credential" button, list of issued credentials with revoke affordance. Route path matches existing top-level convention (sibling to `about/`, `admin/`, `chat/`). |
| `docs/dictionary.md` | Modify: add "Clone Credential" and "Workspace Clone URL" entries |
| `.env.example` | **Possibly modify:** if a new secret is needed for credential signing, add it here with documentation |
| `packages/core/src/db/schema.ts` **(only if required)** | Possibly modify: add `clone_credentials` table IF the existing `credentials` table shape is unsuitable. **If this table is added, migration discipline per Insight-190 applies; brief AC adjusts.** |

**No changes to memories-specific code** (that's Brief 199).

## User Experience

- **Jobs affected:** Curate (enables tool-independent access that Brief 199's in-Ditto chat + inline preview cannot deliver). Also Define indirectly: Jordan's clone-and-demo workflow is "showing the system's learning" to others.
- **Primitives involved:** a new UI surface (clone page) — likely an `ActionBlock` + `CodeBlock` (for the URL) + a simple list rendering for issued credentials. No new ContentBlock type required.
- **Process-owner perspective:**
  - **Rob** (SMB trades): never uses this. The clone page exists but he has no reason to click it. Confirms the "no persona penalty for non-adopters" property.
  - **Lisa**: opens the clone page once, copies the URL, opens Terminal (or has a more-technical colleague help), runs `git clone`. After that she uses her normal editor. Credentials stay in her system keychain; she does not re-auth.
  - **Jordan**: native user. Clones immediately; adds to VSCode; pulls before demos; rotates credentials on schedule.
  - **Nadia**: same as Lisa; team-scale diffs against her clone.
- **Interaction states:**
  - No credentials issued yet → "Generate your first clone credential" prompt, cost explained ("this credential lets you clone the workspace from any machine")
  - Credentials exist → list with last-used timestamps + revoke affordance
  - Credential generated → shown once (copy to clipboard), with clear warning "this is the only time you'll see the full credential" (standard PAT UX)
  - Credential revoked → disappears from list; next clone attempt with that cred returns HTTP 401 with a message pointing at the clone page
  - Server error (isomorphic-git failure, filesystem unavailable) → HTTP 503 with a human-readable message
  - Rate-limited → HTTP 429 with `Retry-After` header and a hint about the limits
- **Designer input:** not invoked directly for this brief — the clone page is a standard PAT-style UI with well-established conventions (GitHub, GitLab, Vercel tokens). However, the copy is user-facing and the "Generate your first credential" prompt deserves editorial attention; flag to Designer in a follow-on copy pass, not blocking.

## Acceptance Criteria

1. [ ] `src/engine/legibility/git-server.ts` exists and exports Next.js-Route-Handler-compatible handlers for the two Smart HTTP endpoints; `packages/web/app/ws.git/[[...path]]/route.ts` mounts as the catch-all; `packages/web/middleware.ts` exempts `/ws.git/*` from session-cookie enforcement.
2. [ ] A standard git client (`git clone https://ditto.you/<workspace-slug>/ws.git`) with valid basic-auth credentials successfully clones the workspace and checks out `main`. Verified by integration test that spawns a subprocess `git clone`. Workspace slug derives from the existing workspace identifier (verify the field in `packages/web/middleware.ts` / workspace config before hard-coding).
3. [ ] `git pull` after a new memory write produces the updated commit in the clone. Verified by integration test.
4. [ ] Unauthenticated requests to `/ws.git/*` return HTTP 401 with a message pointing at the Ditto UI's clone page. Verified by integration test.
5. [ ] Invalid credentials return HTTP 401; no information leak about whether the username or password was wrong.
6. [ ] `src/engine/legibility/git-server-auth.ts` exists and exports `issueCloneCredential(userId)`, `validateCloneCredential(token)`, `revokeCloneCredential(credentialId)`; tokens are cryptographically random (≥32 bytes; standard Node `randomBytes`); stored hashed (bcrypt cost 12 or scrypt equivalent), never plaintext; never logged.
7. [ ] Revoked credentials return HTTP 401 immediately on next request (no TTL-based caching that could allow post-revoke access for minutes).
8. [ ] `src/engine/legibility/workspace-bootstrap.ts` exists and is idempotent. Running `bootstrapWorkspaceGit(path)` twice is a no-op on the second run. Called from existing workspace-readiness/provisioner code (verify the exact integration point before build).
9. [ ] Bootstrap creates: `/workspace/README.md` (explains the clone-pull round-trip + legibility model), `/workspace/.gitignore` (excludes Ditto-internal paths — credentials, step-run blobs, `.ditto/`), initial commit on `main` authored by `Ditto Agent <agent@ditto.local>`.
10. [ ] Rate limiting: per-credential 30 req/min for `info/refs`, 5 clones/hour for `git-upload-pack`. Exceeding returns HTTP 429 with `Retry-After`. Verified by integration test.
11. [ ] **Zero external-service dependency:** `grep -rn "github\\|gitlab\\|gitea\\|bitbucket" src/engine/legibility/` returns only matches in comments or doc strings. No API calls, no HTTP requests to external hosts.
12. [ ] UI affordance at `/clone` (or equivalent existing Ditto route convention) exists; displays clone URL, has "Generate credential" button; lists issued credentials with revoke affordance; new credential shown once with "copy to clipboard" and the "you'll only see this once" warning.
13. [ ] **Engine-core boundary check:** `git diff --stat main..HEAD | grep packages/core` empty UNLESS a new `clone_credentials` schema was required; if required, Drizzle journal discipline per Insight-190 is followed (next available idx, SQL + snapshot verified).
14. [ ] `pnpm run type-check` passes at root with zero errors; full `pnpm test` passes with zero regressions.
15. [ ] **Insight-180 exemption documentation:** `git-server-auth.ts` begins with `// stepRunId not required: admin-UI-triggered credential issuance; internal side effect only; audit-logged via activities table`. `git-server.ts` begins with `// stepRunId not required: read-serving endpoints have no side effects`. Audit-log writes from `issueCloneCredential` and `revokeCloneCredential` land in the `activities` table with `action: "clone_credential_issued"` / `"clone_credential_revoked"`, `actorType: "human"`, `actorId: <userId>`.
16. [ ] Spike test (`src/engine/legibility/git-server-spike.test.ts` per Insight-180): ONE real `git clone` roundtrip against a live local server, verifies the Smart HTTP protocol works end-to-end with `isomorphic-git`'s HTTP helpers. Run ONCE manually before wiring the route; pass before the rest of the build.

## Review Process

1. Spawn fresh-context Dev Reviewer with `docs/architecture.md`, `docs/review-checklist.md`, parent Brief 197, this brief, and Brief 199 (sibling)
2. Reviewer verifies: (a) `isomorphic-git` + `@isomorphic-git/http-node` is actually the right library (alternative: `node-git-server` — verify choice is robust); (b) existing Ditto HTTP framework / route convention is respected; (c) clone-credential storage choice is sound (new table vs existing `credentials` table); (d) auth integration doesn't break session-based UI access; (e) rate limits are defensible; (f) no external-service dependency anywhere; (g) bootstrap is idempotent; (h) spike test actually runs a real git clone against a real server, not a mock
3. Spike-test gate: the Insight-180 spike test must pass BEFORE the rest of the brief's ACs are considered. If the spike reveals `isomorphic-git` HTTP helpers don't work as expected, brief pivots to `node-git-server` or similar — note in the retrospective.
4. Present work + review findings to human

## Smoke Test

```bash
# 1. Bootstrap a fresh workspace (if not already bootstrapped)
pnpm dev  # Starts Ditto workspace; bootstrap runs automatically if needed
# Verify: /workspace/.git exists; /workspace/README.md exists; /workspace/.gitignore excludes Ditto-internal paths

# 2. Generate a clone credential via the UI
# Navigate to /clone in the Ditto UI; click "Generate credential"; copy the token

# 3. Clone the workspace from any git client
git clone https://clone:<token>@ditto.you/<workspace-slug>/ws.git test-clone
cd test-clone
ls memories/  # Expect: the projected memories tree (if Brief 199 has written any)
cat README.md  # Expect: the bootstrap README

# 4. Seed a memory via Ditto, then pull
# In Ditto chat: "Remember that I prefer terse responses"
cd test-clone && git pull
# Expect: new commit on main; memories/self/preferences.md updated

# 5. Revoke the credential; verify subsequent pull fails
# In Ditto UI /clone: click "Revoke" on the active credential
cd test-clone && git pull
# Expect: fatal: Authentication failed (HTTP 401)

# 6. Rate limit test (manual; optional)
# Hammer info/refs 31 times in a minute; expect 429 on the 31st

# 7. Engine-core boundary
git diff --stat main..HEAD | grep packages/core
# Expect: empty, unless clone_credentials table was added (confirmed with Insight-190 discipline)

# 8. No external dependency
grep -rn "github\|gitlab\|gitea\|bitbucket" src/engine/legibility/
# Expect: comments/docs only; no API calls, no external HTTP hosts

# 9. Type-check + test suite
pnpm run type-check && pnpm test
# Expect: 0 errors; 0 regressions
```

## After Completion

1. Update `docs/state.md` with: git server shipped, workspace bootstrap integrated, UI affordance live; all future legibility sub-briefs now have zero-cost user access
2. Update `docs/roadmap.md`: legibility infrastructure row marked complete; future Category-1/2/3/4 sub-briefs surfaced as unlocked
3. Update `docs/landscape.md`: add `isomorphic-git` + `@isomorphic-git/http-node` entries under a "Git Infrastructure" section (pair with the existing Git discipline Insight-190)
4. Joint retrospective with Briefs 198 + 199: did the chokepoint-refactor-first-then-feature sequencing pay off? Did the pilot end-to-end user experience (clone, pull, grep) feel as promised to test personas (have a real Jordan-like user walk through)? Was `isomorphic-git` the right choice or did the spike reveal gaps?
5. Write ADR if a new `clone_credentials` table was added (decision: separate credential type vs reuse of `credentials` table); otherwise no ADR (server shape is a standard pattern and does not warrant one)
6. If the spike test revealed `isomorphic-git` HTTP helpers were insufficient and the build pivoted, document the pivot as a pattern-level finding for future Ditto work that wants to serve git
