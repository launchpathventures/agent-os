# Brief: Credential Vault + Process I/O — Phase 6c (Parent)

**Date:** 2026-03-21 (reconciled 2026-03-23 — post Brief 025/031-034b alignment)
**Status:** ready (parent brief — build via sub-briefs 035, 036)
**Depends on:** Brief 025 (Integration Tools + Agent Tool Use)
**Unlocks:** Phase 7 (Awareness — process dependency events from external triggers), non-coding templates fully operational

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** Credential vault (encrypted storage), token lifecycle, per-process credential scoping, external input sources, output delivery to external destinations, basic trigger mechanism

## Context

Briefs 024-025 built the integration foundation (registry, executor, CLI/REST handlers, Ditto-native tool use). This brief completes Phase 6 with the two remaining pieces:

1. **Credential vault** — secure, encrypted storage for OAuth tokens, API keys, and service credentials. Scoped per-process so that Process A's Xero credentials can't be used by Process B. This replaces the env-var/static-token approach used in Briefs 024-025.

2. **Process I/O** — connecting process boundaries to external systems. Input sources (new email triggers invoice process), output destinations (approved invoice posted to Xero). This is the capability that makes the non-coding templates (invoice-follow-up, content-review, incident-response) operational with real external systems.

## Design Decisions

### Two credential resolution paths (post Brief 025)

Brief 025 introduced agent tool use via `tool-resolver.ts`. This creates **two paths** into the protocol handlers, both needing vault-backed credential resolution:

1. **Integration steps** (`executor: integration`): `step-executor.ts` → `executeIntegration()` → `executeCli()`/`executeRest()`. The step executor has access to the process run context.

2. **Agent tool use** (`step.tools: [service.tool]`): `memory-assembly.ts` calls `resolveTools()` → `tool-resolver.ts` → `executeCliTool()`/`executeRestTool()` → `executeCli()`/`executeRest()`. The memory-assembly handler has access to `context.processRun.processId`.

Current state:
- CLI handler: `resolveAuth(service, cliInterface, processId?)` reads env vars. Already has `processId` param (anticipating vault).
- REST handler: `resolveRestAuth(service, restInterface)` reads env vars independently. No `processId` param.
- Tool resolver: calls handlers with no `processId` context.

**Solution:** Unified `resolveServiceAuth()` in `credential-vault.ts` — vault first, env var fallback with deprecation warning. `processId` threaded through both execution paths.

### Credential scoping simplification

Scoped by `(processId, service)`, not `(processId, agentId, service)`. Rationale:
- Each process step has exactly one agent role — per-agent scoping adds complexity without benefit until multi-agent steps exist
- `stepRuns` has no `agentId` field
- Per-agent scoping deferred to Phase 12

### Relationship to Conversational Self (ADR-016)

The Self delegates to process runs via `startProcessRun()`. Credential resolution uses the process run's `processId` — no Self-level credential context needed. Process I/O triggers create runs with `triggeredBy: "trigger"`. The Self sees trigger-spawned runs through `loadWorkStateSummary()` alongside other run types.

### Insight-066 disposition (Process Outputs Are Polymorphic)

Insight-066 proposes typed output schemas. This brief's `output_delivery:` config maps to the "API call" output type (distinct from the existing descriptive `outputs[].destination` label on ProcessDefinition). Keeping it simple for Phase 6c — richer output schema architecture is Phase 7+ work.

## Sub-Brief Structure

Split along the security/orchestration seam:

| Sub-brief | Scope | AC count |
|---|---|---|
| **035 — Credential Vault + Auth Unification** | Vault, unified auth, processId threading, CLI commands | 13 |
| **036 — Process I/O (Triggers + Output Delivery)** | Polling triggers, output delivery, process definition fields | 9 |

Build order: 035 → 036 (process I/O needs credentials for external system access).

## Non-Goals (applies to both sub-briefs)

- Full OAuth flow UI (web dashboard — Phase 10)
- Webhook server infrastructure (deferred to Phase 7+)
- Data sync/caching layer (Insight-010)
- Nango/Composio adoption (evaluate after this brief proves the minimal pattern)
- Multi-tenancy credential isolation (Phase 12)
- Per-agent credential scoping (Phase 12)
- Self-level credential threading (process-scoped, resolved by harness)
- MCP protocol handler (deferred — Insight-065)
- Rich output schema architecture (Insight-066 — Phase 7+)

## After Completion (both sub-briefs)

1. Update `docs/state.md` — Phase 6 complete
2. Update `docs/roadmap.md` — mark all Phase 6 items as done
3. All three non-coding templates can now connect to real external systems
4. Evaluate Nango/Composio adoption based on credential management experience
5. Phase 7 (Awareness) re-entry condition met: 2+ processes with external integrations
6. Update architecture.md credential scoping language from "per-process, per-agent" to "per-process, per-service (per-agent deferred to Phase 12)"
7. Update ADR-005 Section 3 to reflect (processId, service) scoping with per-agent deferred to Phase 12
