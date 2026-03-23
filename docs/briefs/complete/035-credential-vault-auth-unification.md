# Brief: Credential Vault + Auth Unification (Phase 6c-1)

**Date:** 2026-03-23
**Status:** ready (approved 2026-03-23)
**Depends on:** Brief 025 (Integration Tools + Agent Tool Use)
**Unlocks:** Brief 036 (Process I/O), secure credential management for all integration paths

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** Credential vault (encrypted storage), per-process credential scoping, unified auth resolution across CLI/REST/tool-use paths, credential management CLI

## Context

Briefs 024-025 established integration infrastructure with env-var-based auth. This works for dogfooding but is insufficient for real-world use:
- Credentials are global (any process can read any env var)
- No encryption at rest
- REST and CLI handlers resolve auth independently (`resolveRestAuth()` vs `resolveAuth()`)
- The tool resolver (Brief 025) calls protocol handlers with no `processId` context, preventing per-process credential scoping

This brief introduces encrypted, per-process credential storage and unifies the two auth resolution paths into a single vault-backed function. It also threads `processId` through all execution paths so the vault can enforce scoping.

See parent brief 026 for the full Phase 6c design, including the two-path analysis.

## Non-Goals

- Process I/O (triggers, output delivery) — Brief 036
- Full OAuth flow UI (web dashboard — Phase 10)
- Webhook infrastructure
- Token refresh automation (stored credentials include `expiresAt` for future use, but no auto-refresh loop in this brief)
- Per-agent credential scoping (Phase 12)
- MCP protocol handler (Insight-065)
- Vault key rotation / re-encryption (future work — if `DITTO_VAULT_KEY` changes, existing credentials become unreadable)

## Inputs

1. `docs/briefs/026-credentials-rest-process-io.md` — parent brief (Phase 6c design)
2. `docs/adrs/005-integration-architecture.md` — credential architecture (brokered pattern)
3. `src/engine/integration-handlers/cli.ts` — `resolveAuth()` to swap to vault (already has `processId` param)
4. `src/engine/integration-handlers/rest.ts` — `resolveRestAuth()` to swap to vault (needs `processId` param)
5. `src/engine/integration-handlers/index.ts` — `executeIntegration()` dispatch (needs `processId` threading)
6. `src/engine/tool-resolver.ts` — `resolveTools()` dispatch (needs `processId` for vault scoping)
7. `src/engine/harness-handlers/memory-assembly.ts` — where `resolveTools()` is called (has `context.processRun.processId`)
8. `src/engine/step-executor.ts` — routes to `executeIntegration()` for integration steps (needs `processId`)
9. `src/engine/harness-handlers/step-execution.ts` — calls `executeStep()` (has `context.processRun.processId`)

## Constraints

- MUST encrypt credentials at rest (AES-256-GCM via Node.js `crypto`). Encryption key derived from `DITTO_VAULT_KEY` via HKDF (SHA-256, salt per credential = IV). This handles passphrase-quality input safely — raw env var bytes are never used directly as the AES key.
- MUST scope credentials by (processId, service) — queries enforce scoping
- MUST NOT log credential values anywhere (activity logs, step runs, agent context, Self context, console output)
- MUST NOT include credential values in `HarnessContext`, `SelfContext`, or memory assembly output
- MUST fail hard if `DITTO_VAULT_KEY` is absent — credential operations throw, never fall back to unencrypted storage
- Env var fallback: when no vault credential exists for a (processId, service) scope, fall back to env vars with a deprecation warning. This prevents breaking existing setups during migration. The fallback is the ONLY place env vars are read for auth.
- MUST NOT change Self's delegation model or tool set
- MUST use Ditto-native types (no SDK type leaks — Brief 032 pattern)
- `scrubCredentials()` (exported from cli.ts) continues to work for both vault-sourced and env-sourced credentials

## Provenance

| What | Source | Why this source |
|---|---|---|
| Brokered credentials | Composio (`composio.dev`) | Agent never sees tokens. Platform executes on agent's behalf. |
| Encrypted credential storage | Node.js `crypto` (AES-256-GCM) | Standard library, no additional dependency. Battle-tested. |
| Per-process credential scoping | Original | No existing platform scopes credentials per-process. |
| Token lifecycle fields | Nango managed auth pattern | `expiresAt` field. Full refresh loop deferred. |
| Unified auth resolution | Original | Both CLI and REST handlers currently have independent env-var auth. Vault unifies. |
| Env var fallback pattern | 12-factor app (migration path) | Gradual adoption without breaking existing setups. |

## What Changes (Work Products)

| File | Action |
|---|---|
| `src/engine/credential-vault.ts` | Create: Encrypted credential storage. `storeCredential(processId, service, value, expiresAt?)`, `getCredential(processId, service)` → `{ value, source: "vault" }`, `deleteCredential(processId, service)`, `listCredentials(processId?)` → `{ processId, service, expiresAt, createdAt }[]`. AES-256-GCM: random IV per encrypt, HKDF key derivation from `DITTO_VAULT_KEY`, authTag stored alongside. Credential value is a single string — for services needing multiple auth values (e.g., username + token), store as JSON string `{"GH_TOKEN":"...","GH_USERNAME":"..."}` and destructure at resolution time. Also exports `resolveServiceAuth(processId, service, authConfig)` — unified auth: tries vault (parses JSON if multi-value), falls back to env vars with `console.warn("[DEPRECATION] ...")`, returns `{ envVars: Record<string, string>, source: "vault" \| "env" }` (CLI handler injects into process.env, REST handler extracts auth header). |
| `src/engine/credential-vault.test.ts` | Create: encrypt/decrypt roundtrip, scoping enforcement (process A can't read process B), missing `DITTO_VAULT_KEY` throws, env var fallback with warning, list credentials hides values, duplicate store replaces. 5+ tests. |
| `src/db/schema.ts` | Modify: Add `credentials` table — `id` (text PK), `processId` (text, FK to processes), `service` (text), `encryptedValue` (text, base64), `iv` (text, base64), `authTag` (text, base64), `expiresAt` (integer, nullable), `createdAt` (integer). Unique constraint on `(processId, service)`. |
| `src/test-utils.ts` | Modify: Add `credentials` table to `createTables` SQL. |
| `src/engine/integration-handlers/cli.ts` | Modify: `resolveAuth()` calls `resolveServiceAuth()` from vault instead of reading env vars directly. `executeCli()` accepts optional `processId` param and passes to `resolveAuth()`. |
| `src/engine/integration-handlers/rest.ts` | Modify: `resolveRestAuth()` calls `resolveServiceAuth()` from vault instead of reading env vars directly. Accepts `processId` parameter. `executeRest()` accepts optional `processId` in params. |
| `src/engine/integration-handlers/index.ts` | Modify: `IntegrationStepConfig` gains optional `processId`. `executeIntegration()` passes `processId` to CLI/REST handlers. |
| `src/engine/tool-resolver.ts` | Modify: `resolveTools(toolNames, integrationDir?, processId?)` — threads `processId` through `executeCliTool()`/`executeRestTool()` closures to protocol handlers. |
| `src/engine/harness-handlers/memory-assembly.ts` | Modify: Pass `context.processRun.processId` as third arg to `resolveTools()` call (~line 236). |
| `src/engine/step-executor.ts` | Modify: `executeStep()` gains optional `processId` param. Passes to `executeIntegration()` config for the `integration` executor case. |
| `src/engine/harness-handlers/step-execution.ts` | Modify: Pass `context.processRun.processId` to `executeStep()`. |
| `src/cli/commands/credential.ts` | Create: `ditto credential add <service> --process <slug>` — masked input prompt via @clack/prompts, stores via `storeCredential()`. `ditto credential list [--process <slug>]` — shows service, process, expiresAt, createdAt (never values). `ditto credential remove <service> --process <slug>` — deletes via `deleteCredential()`. |
| `src/cli.ts` | Modify: Register credential subcommands. |
| `integrations/github.yaml` | Modify: Add comment noting vault-backed auth (env var fallback preserved). |
| `integrations/slack.yaml` | Modify: Add comment noting vault-backed auth (env var fallback preserved). |
| `docs/architecture.md` | Modify: Update credential scoping language from "per-process, per-agent" to "per-process, per-service (per-agent deferred to Phase 12)". |
| `docs/adrs/005-integration-architecture.md` | Modify: Update Section 3 to reflect (processId, service) scoping with per-agent deferred to Phase 12. |

## User Experience

- **Jobs affected:** Delegate (credential management)
- **Primitives involved:** Trust Control (credential scope visible in `credential list`)
- **Process-owner perspective:** "I store my GitHub token once, scoped to my dev process. No other process can use it. If I forget to add a vault credential, the system falls back to my env var but warns me."
- **Interaction states:** `credential add` — masked password input via @clack/prompts. `credential list` — table output, never shows values. `credential remove` — confirmation prompt.
- **Designer input:** Not invoked — CLI-only. Full credential UX in Phase 10.

## Acceptance Criteria

1. [ ] Credential vault encrypts values at rest using AES-256-GCM (random IV per credential, authTag stored)
2. [ ] Credentials are scoped by (processId, service) — `getCredential(processA, github)` cannot return processB's credential
3. [ ] Credential values NEVER appear in logs, step runs, agent context, Self context, or console output
4. [ ] `DITTO_VAULT_KEY` absent → vault operations throw (never unencrypted fallback)
5. [ ] `resolveServiceAuth()` tries vault first, falls back to env vars with deprecation warning
6. [ ] `ditto credential add <service> --process <slug>` stores encrypted credential (masked input)
7. [ ] `ditto credential list` shows credentials without revealing values
8. [ ] `ditto credential remove <service> --process <slug>` deletes credential
9. [ ] CLI `executeCli()` accepts and passes `processId` to auth resolution
10. [ ] REST `executeRest()` accepts and passes `processId` to auth resolution
11. [ ] Tool resolver `resolveTools()` accepts `processId` and threads through dispatch closures
12. [ ] Memory-assembly handler passes `context.processRun.processId` to `resolveTools()`
13. [ ] Step executor passes `processId` to `executeIntegration()` for integration steps
14. [ ] Tests: vault (encrypt/decrypt, scoping, missing key, env fallback, list, duplicate replace) — 6+ tests
15. [ ] Tests: processId threading through tool resolver dispatch — 2+ tests
16. [ ] Existing tests still pass (236+ tests)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: credential scoping is (processId, service), no credential values leak to any context, vault encryption uses random IV, env var fallback works for migration, processId threaded through both execution paths (integration steps + tool use), `scrubCredentials()` still works, no Self changes
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Without vault key — operations must fail
pnpm cli credential add github --process gh-test
# → Error: DITTO_VAULT_KEY environment variable is required

# 2. With vault key — store and list
export DITTO_VAULT_KEY="test-vault-key-exactly-32-chars!"
pnpm cli credential add github --process gh-test
# (prompts for token with masked input, stores encrypted)

pnpm cli credential list
# → github | process: gh-test | expires: never | added: 2026-03-23

# 3. Scoping — different process can't see it
pnpm cli credential list --process other-process
# → (empty)

# 4. Run integration — vault resolves credential
pnpm cli start gh-test
# Expected: auth resolved from vault, tool calls succeed

# 5. Env var fallback — no vault credential, env var present
pnpm cli credential remove github --process gh-test
export GH_TOKEN=test-token
pnpm cli start gh-test
# Expected: warning "[DEPRECATION] Using env var GH_TOKEN — migrate to ditto credential add"

# 6. Check logs — no credential values anywhere
```

## After Completion

1. Update `docs/state.md` — Brief 035 complete, credential vault operational
2. Brief 036 (Process I/O) unblocked
