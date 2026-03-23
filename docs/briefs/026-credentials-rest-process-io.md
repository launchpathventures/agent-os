# Brief: Credential Vault + Process I/O (Phase 6c)

**Date:** 2026-03-21 (reconciled 2026-03-23 — Conversational Self alignment)
**Status:** ready (reconciled and re-approved 2026-03-23)
**Depends on:** Brief 025 (MCP + Agent Tool Use)
**Unlocks:** Phase 7 (Awareness — process dependency events from external triggers), non-coding templates fully operational

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** Credential vault (encrypted storage), token lifecycle, per-process credential scoping, external input sources, output delivery to external destinations, basic trigger mechanism

## Context

Briefs 024-025 build the integration foundation (registry, executor, CLI/MCP/REST handlers, tool use). This brief completes Phase 6 with the two remaining pieces:

1. **Credential vault** — secure, encrypted storage for OAuth tokens, API keys, and service credentials. Scoped per-process so that Process A's Xero credentials can't be used by Process B. This replaces the env-var/static-token approach used in Briefs 024-025.

2. **Process I/O** — connecting process boundaries to external systems. Input sources (new email triggers invoice process), output destinations (approved invoice posted to Xero). This is the capability that makes the non-coding templates (invoice-follow-up, content-review, incident-response) operational with real external systems.

### Relationship to Conversational Self (ADR-016)

The Conversational Self delegates to process runs via `startProcessRun(processSlug, inputs, "self")`. Credential resolution uses the process run's `processId` — no Self-level credential context is needed. The Self creates process runs; the harness resolves credentials within those runs.

**Process I/O triggers** create process runs via the capture pipeline with `triggeredBy: "trigger"`. The Self sees trigger-spawned runs through `loadWorkStateSummary()` alongside Self-delegated runs (`triggeredBy: "self"`) and manual runs (`triggeredBy: "manual"`). The Self doesn't need special awareness of triggers — it already queries all active runs.

### Credential scoping simplification

The original brief scoped credentials by `(processId, agentId, service)`. This is simplified to `(processId, service)` for Phase 6. Rationale:
- Each process step has exactly one agent role — per-agent scoping adds complexity without benefit until multi-agent steps exist
- `stepRuns` has no `agentId` field (it tracks `executorType`, not agent identity)
- Per-agent scoping deferred to Phase 12 (multi-tenancy/governance at scale)
- The scoping model can be tightened later without changing the vault API (add an optional `agentId` column)

## Non-Goals

- Full OAuth flow UI (web dashboard — Phase 10)
- Webhook server infrastructure (deferred to Phase 7+ — re-entry: when polling proves insufficient). This brief implements polling-based triggers: lightweight loop in `process-io.ts` checks sources on a configurable interval, creates work items via existing capture pipeline.
- Data sync/caching layer (Insight-010 — separate from process I/O)
- Nango/Composio adoption (evaluate after this brief proves the minimal pattern)
- Multi-tenancy credential isolation (Phase 12)
- Per-agent credential scoping (Phase 12 — see rationale above)
- Self-level credential threading (credentials are process-scoped, resolved by the harness)

## Inputs

1. `docs/briefs/023-phase-6-external-integrations.md` — parent brief (reconciled with Self)
2. `docs/adrs/005-integration-architecture.md` — credential architecture (brokered pattern)
3. `docs/adrs/016-conversational-self.md` — Self architecture (understand delegation model)
4. `src/engine/integration-registry.ts` — registry to extend with credential references (from Brief 024)
5. `src/engine/integration-handlers/` — protocol handlers to extend with vault resolution (from Brief 025)
6. `src/engine/self-context.ts` — `loadWorkStateSummary()` — understand how Self sees runs (no changes needed)
7. `templates/invoice-follow-up.yaml` — first template to connect to real systems

## Constraints

- MUST encrypt credentials at rest (AES-256-GCM or similar via Node.js crypto)
- MUST scope credentials per-process, per-service (an agent on Process A cannot access Process B's credentials)
- MUST NOT log credential values anywhere (activity logs, step runs, console output)
- MUST NOT include credential values in agent context, harness context, or Self context
- MUST NOT change Self's delegation model or tool set
- Vault key management: environment variable (`DITTO_VAULT_KEY`) for dogfood. Key management service integration deferred.
- MUST fail hard if `DITTO_VAULT_KEY` is absent — credential operations throw, never fall back to unencrypted storage
- Process I/O: output delivery happens AFTER trust gate approval (harness pipeline order preserved)
- Trigger mechanism: polling-based for Phase 6c (check on schedule). Event-driven triggers (webhooks) deferred.
- `triggeredBy` field on process runs: extend existing values ("manual", "self") with "trigger" and "system"

## Provenance

| What | Source | Why this source |
|---|---|---|
| Brokered credentials | Composio (`composio.dev`) | Agent never sees tokens. Platform executes on agent's behalf. |
| Encrypted credential storage | Node.js `crypto` (AES-256-GCM) | Standard library, no additional dependency. Battle-tested. |
| Per-process credential scoping | Original | No existing platform scopes credentials per-process. |
| Token lifecycle | Nango managed auth pattern | Refresh before expiry, rotation support, revocation tracking. |
| Process trigger mechanism | Standard polling pattern (cron-style) | Simplest trigger mechanism. Webhook upgrade later. |
| Output delivery | Nango actions pattern | Code-first TypeScript functions for external writes. |
| triggeredBy taxonomy | Original | Distinguishes human, Self, automated trigger, and system agent origins. |

## What Changes (Work Products)

| File | Action |
|---|---|
| `src/engine/credential-vault.ts` | Create: Encrypted credential storage. Store/retrieve/delete credentials. AES-256-GCM encryption. Scoped by (processId, service). Vault key from `DITTO_VAULT_KEY` env var. |
| `src/engine/credential-vault.test.ts` | Create: Vault tests (encrypt/decrypt, scoping, missing key, invalid credentials). |
| `src/db/schema.ts` | Modify: Add `credentials` table (id, processId, service, encryptedValue, expiresAt, createdAt). Unique constraint on (processId, service) — storing a new credential for the same scope replaces the existing one. Add `trigger` and `outputDestination` text fields on `processes` table. |
| `src/engine/integration-handlers/index.ts` | Modify: Protocol handlers receive credentials from vault (not from env vars). Credential resolution happens at dispatch time using processId + service. |
| `src/engine/integration-registry.ts` | Modify: Registry entries reference credential vault scope, not raw auth values. |
| `src/engine/process-io.ts` | Create: Process I/O handler — resolves input sources and output destinations from process definition. Output delivery: calls integration handler after trust gate approval. Input polling: check source on schedule (configurable interval). Creates work items via existing capture pipeline with `triggeredBy: "trigger"`. |
| `src/engine/process-io.test.ts` | Create: Process I/O tests (output delivery, source polling, credential scoping). |
| `src/engine/heartbeat.ts` | Modify: After process run completes and is approved, call process I/O output delivery if process has `destination:` field. |
| `src/cli/commands/credential.ts` | Create: `ditto credential add <service> --process <slug>` — stores encrypted credential in vault. `ditto credential list` — shows stored credentials (service + process, never values). `ditto credential remove`. |
| `src/cli.ts` | Modify: Register credential commands. |
| `integrations/github.yaml` | Modify: Auth references vault instead of env var. |
| `templates/invoice-follow-up.yaml` | Modify: Add `source:` and `destination:` fields pointing to real integrations (e.g., email source, accounting destination). |

## User Experience

- **Jobs affected:** Define (process definitions gain source/destination), Delegate (credential management)
- **Primitives involved:** Process Card (shows integration status), Trust Control (credential scope visible)
- **Process-owner perspective:** "I store my Xero credentials once, scoped to my invoice process. The process can now read from email and post to Xero. No other process can use those credentials." When a trigger fires, the Self mentions it naturally: "An invoice process started from an incoming email."
- **Interaction states:** `ditto credential add` — interactive prompt for credential value (masked input). `ditto credential list` — shows service + process scope, never values.
- **Designer input:** Not invoked — CLI-only. Full credential UX in Phase 10 (web dashboard).

## Acceptance Criteria

1. [ ] Credential vault encrypts values at rest using AES-256-GCM
2. [ ] Credentials are scoped by (processId, service) — queries enforce scoping
3. [ ] Credential values NEVER appear in logs, step runs, agent context, Self context, or console output
4. [ ] `ditto credential add <service> --process <slug>` stores encrypted credential
5. [ ] `ditto credential list` shows stored credentials without revealing values
6. [ ] `ditto credential remove <service> --process <slug>` deletes credential
7. [ ] Protocol handlers resolve credentials from vault at dispatch time (not from env vars)
8. [ ] Process definitions support `source:` field (external input source)
9. [ ] Process definitions support `destination:` field (external output destination)
10. [ ] Output delivery calls integration handler AFTER trust gate approval
11. [ ] `triggeredBy` field accepts "trigger" value; process I/O creates runs with `triggeredBy: "trigger"`
12. [ ] Self's `loadWorkStateSummary()` shows trigger-spawned runs alongside other runs (no code change needed — verify query already includes them)
13. [ ] Tests: vault encrypt/decrypt, scoping enforcement, missing vault key — 4+ tests
14. [ ] Tests: process I/O output delivery, source polling, credential resolution — 3+ tests
15. [ ] Existing tests still pass (110+ tests)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: credential scoping is (processId, service) not (processId, agentId, service), no credential values in any context, vault encryption correct, output delivery after trust gate, triggeredBy taxonomy correct, no Self changes
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Store a credential
pnpm cli credential add github --process gh-test
# (prompts for token, stores encrypted)

# 2. List credentials (shows scope, not value)
pnpm cli credential list
# → github | process: gh-test | added: 2026-03-22

# 3. Run a process that uses the stored credential
pnpm cli start gh-test

# 4. Expected: integration handler resolves credential from vault, not env var
# 5. Check: no credential values in activity logs or step run output
# 6. Verify: Self's work state shows the run (query all runs, not filtered by triggeredBy)
```

## After Completion

1. Update `docs/state.md` — Phase 6 complete
2. Update `docs/roadmap.md` — mark all Phase 6 items as done
3. All three non-coding templates can now connect to real external systems
4. Evaluate Nango/Composio adoption based on credential management experience
5. Phase 7 (Awareness) re-entry condition met: 2+ processes with external integrations
6. Update architecture.md credential scoping language from "per-process, per-agent" to "per-process, per-service (per-agent deferred to Phase 12)"
7. Update ADR-005 Section 3 to reflect (processId, service) scoping with per-agent deferred to Phase 12
