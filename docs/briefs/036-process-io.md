# Brief: Process I/O — Triggers + Output Delivery (Phase 6c-2)

**Date:** 2026-03-23
**Status:** ready (approved 2026-03-23)
**Depends on:** Brief 035 (Credential Vault + Auth Unification)
**Unlocks:** Phase 7 (Awareness — process dependency events from external triggers), non-coding templates fully operational

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** External input sources, polling-based triggers, output delivery to external destinations, `triggeredBy` taxonomy

## Context

Brief 035 delivers secure credential storage and unified auth resolution. This brief connects process boundaries to external systems:

- **Input sources** — a process definition declares where its input comes from (e.g., "new emails matching X"). A polling loop checks the source on a schedule and creates work items via the existing capture pipeline.
- **Output delivery** — a process definition declares an `output_delivery` config (distinct from the existing `outputs[].destination` label, which is descriptive). `output_delivery` is an executable integration config `{ service, action, params }` that fires after the process run completes and passes the trust gate.

Together with Brief 035, this completes Phase 6 and makes the non-coding templates (invoice-follow-up, content-review, incident-response) operational with real external systems.

See parent brief 026 for the full Phase 6c design.

### Insight-066 disposition

Insight-066 (Process Outputs Are Polymorphic) proposes typed output schemas. This brief's `output_delivery:` config maps to the "API call" output type in Insight-066's taxonomy. A simple executable integration config is sufficient to prove process I/O works. Richer output schema architecture (data, rendered view, document, external artifact) is Phase 7+ work.

## Non-Goals

- Credential vault (Brief 035)
- Webhook server (deferred to Phase 7+ — re-entry: when polling proves insufficient)
- Event-driven triggers (this brief does polling only)
- Data sync/caching layer (Insight-010)
- Rich output schema (Insight-066 — Phase 7+)
- Self-level trigger awareness (Self already sees all runs via `loadWorkStateSummary()`)

## Inputs

1. `docs/briefs/026-credentials-rest-process-io.md` — parent brief
2. `docs/adrs/005-integration-architecture.md` — integration architecture
3. `src/engine/credential-vault.ts` — credential resolution (from Brief 035)
4. `src/engine/integration-handlers/index.ts` — protocol dispatch (extended with processId in Brief 035)
5. `src/engine/heartbeat.ts` — process run lifecycle (where output delivery hooks in)
6. `src/engine/process-loader.ts` — process definition parsing (extend with source/output_delivery fields)
7. `src/engine/self-context.ts` — `loadWorkStateSummary()` (verify trigger-spawned runs are visible)
8. `templates/invoice-follow-up.yaml` — first template to connect to real systems
9. `docs/insights/066-process-outputs-are-polymorphic.md` — design context for output delivery

## Constraints

- Output delivery happens AFTER trust gate approval (harness pipeline order preserved)
- Trigger mechanism: polling-based only (check source on configurable interval)
- Triggers create work items via existing capture pipeline (not bypassing intake/routing)
- `triggeredBy` field on process runs: extend existing values ("manual", "self") with "trigger" and "system"
- Polling loop must be stoppable (graceful shutdown)
- `source`/`output_delivery` fields are optional on process definitions (most processes don't have them)
- MUST NOT change Self's delegation model or tool set
- Credential resolution uses `resolveServiceAuth()` from Brief 035 (vault-backed)

## Provenance

| What | Source | Why this source |
|---|---|---|
| Process trigger mechanism | Standard polling pattern (cron-style) | Simplest trigger mechanism. Webhook upgrade later. |
| Output delivery | Nango actions pattern | Code-first TypeScript functions for external writes. |
| triggeredBy taxonomy | Original | Distinguishes human, Self, automated trigger, and system agent origins. |
| Capture pipeline for triggers | Existing `capture` command flow (Brief 014b) | Triggers enter the same intake → classify → route path as manual input. |

## What Changes (Work Products)

| File | Action |
|---|---|
| `src/engine/process-io.ts` | Create: Process I/O handler. `startPolling(processSlug, intervalMs)` — polls source, creates work items via capture pipeline with `triggeredBy: "trigger"`. `deliverOutput(processRunId)` — resolves `output_delivery` config from process definition, calls integration handler with run outputs. `stopPolling(processSlug)` — graceful stop. Source config: `{ service, action, params, intervalMs }`. Output delivery config: `{ service, action, params }`. |
| `src/engine/process-io.test.ts` | Create: Polling creates work items with correct triggeredBy, output delivery calls integration handler, output delivery only after approval, stop polling works, missing output_delivery is no-op. 4+ tests. |
| `src/db/schema.ts` | Modify: Add `source` (text, nullable, JSON) and `outputDelivery` (text, nullable, JSON) fields on `processes` table. Note: this is distinct from the existing `outputs[].destination` field on `ProcessDefinition`, which is a descriptive label. `outputDelivery` is an executable integration config `{ service, action, params }`. |
| `src/engine/process-loader.ts` | Modify: Parse `source:` and `output_delivery:` from process YAML into ProcessDefinition. Validate service references against integration registry. |
| `src/engine/heartbeat.ts` | Modify: After process run completes and is approved (trust gate passes), check if process has `outputDelivery` — if so, call `deliverOutput()`. |
| `templates/invoice-follow-up.yaml` | Modify: Add `source:` (email check) and `output_delivery:` (accounting API post) fields as examples. |
| `src/cli/commands/trigger.ts` | Create: `ditto trigger start <process> [--interval <ms>]` — starts polling for a process source. `ditto trigger stop <process>` — stops polling. `ditto trigger status` — shows active polling loops. |
| `src/cli.ts` | Modify: Register trigger subcommands. |

## User Experience

- **Jobs affected:** Define (process definitions gain source/output_delivery), Orient (trigger status visible)
- **Primitives involved:** Process Card (shows source/output_delivery config)
- **Process-owner perspective:** "My invoice process now checks for new emails every 5 minutes. When one arrives, it starts automatically. When the process completes and I approve the output, it posts to Xero. I can see trigger-spawned runs in my normal work queue."
- **Interaction states:** `trigger start` — confirmation of polling started. `trigger status` — table of active loops. `trigger stop` — confirmation.
- **Designer input:** Not invoked — CLI-only. Full trigger UX in Phase 10.

## Acceptance Criteria

1. [ ] Process definitions support `source:` field (service, action, params, intervalMs)
2. [ ] Process definitions support `output_delivery:` field (service, action, params) — distinct from existing `outputs[].destination` label
3. [ ] Process loader validates source/output_delivery service references against integration registry
4. [ ] `ditto trigger start <process>` starts polling loop that creates work items via capture pipeline
5. [ ] Work items created by triggers have `triggeredBy: "trigger"` on the process run
6. [ ] `ditto trigger stop <process>` gracefully stops polling
7. [ ] Output delivery calls integration handler AFTER trust gate approval (not before)
8. [ ] Output delivery uses `resolveServiceAuth()` (vault-backed) for credential resolution
9. [ ] Self's `loadWorkStateSummary()` shows trigger-spawned runs (verify — no code change expected)
10. [ ] Tests: polling, output delivery, approval gate, graceful stop — 4+ tests
11. [ ] Existing tests still pass (250+ tests, accounting for Brief 035 additions)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: output delivery after trust gate, triggers use capture pipeline (not bypass), triggeredBy taxonomy correct, no Self changes, graceful shutdown, credential resolution via vault
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Add source and output_delivery to a process YAML
# (invoice-follow-up.yaml with source: email check, output_delivery: accounting post)

# 2. Sync and start trigger
pnpm cli sync
pnpm cli trigger start invoice-follow-up --interval 60000
# → Polling invoice-follow-up source every 60s

# 3. Trigger status
pnpm cli trigger status
# → invoice-follow-up | polling | interval: 60s | last check: ...

# 4. Simulate trigger (or wait for source to match)
# Work item should appear in status
pnpm cli status
# → [trigger] invoice-follow-up: processing...

# 5. After process completes and is approved:
# Output delivery should fire
pnpm cli approve <run-id>
# → Output delivered via output_delivery: accounting.post_invoice

# 6. Stop trigger
pnpm cli trigger stop invoice-follow-up
# → Stopped polling invoice-follow-up
```

## After Completion

1. Update `docs/state.md` — Phase 6 complete (both 035 + 036 done)
2. Update `docs/roadmap.md` — mark all Phase 6 items as done
3. All three non-coding templates can now connect to real external systems
4. Evaluate Nango/Composio adoption based on experience
5. Phase 7 (Awareness) re-entry condition met
6. Update architecture.md credential scoping language
