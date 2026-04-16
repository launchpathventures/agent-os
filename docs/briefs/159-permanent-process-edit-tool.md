# Brief 159: Permanent Process Edit Tool

**Date:** 2026-04-16
**Status:** draft
**Depends on:** none (builds on existing `generate_process` + `adapt_process` infrastructure)
**Unlocks:** MP-9.2 (version history / rollback), real process evolution as user needs change

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-9)
- **Capabilities:** MP-9.1 — users can permanently edit an existing process through conversation. MP-9.3 scope confirmation routes between `adapt_process` (run-scoped) and this new tool (permanent)

## Context

Ditto has two process-shaping tools today:

- `generate_process` (`src/engine/self-tools/generate-process.ts:53`) — creates a **new** process. `save=true` writes a new row. There is no path to modify an existing one.
- `adapt_process` (`src/engine/self-tools/adapt-process.ts:38`) — writes a `definitionOverride` onto the current `processRuns` row. **Run-scoped and restricted to system processes only** (line 88). Next run uses the template again.

The audit surfaced this as the core gap in MP-9: a user who says "remove the follow-up step in my quoting process" has no durable path. They can either (a) ask `adapt_process` — blocked on non-system processes — or (b) generate a brand-new process, orphaning the history of the old one.

The schema is almost ready:
- `processes.definition` (JSON) holds the canonical definition
- `processes.version` is an integer
- No version-history table exists (rollback lives under MP-9.2 — this brief creates the forward-edit path that makes history meaningful)

Safety matters: permanent edits should not break in-flight runs. Brief 044's `adapt_process` got this right — it wrote per-run overrides. A permanent edit is safe as long as new runs start using v+1 while existing runs finish on their bound version. The schema supports this implicitly because each run resolves the definition at start time and caches via `definitionOverride`.

## Objective

The Self has a new `edit_process` tool that updates an existing process definition permanently, with explicit user confirmation, under optimistic locking, producing a new version that only affects runs started after the edit. An `edit_process_preview` variant shows the proposed change before commit.

## Non-Goals

- Full version history table with rollback UX (MP-9.2 — a follow-up brief)
- Branching/forking of processes (one linear version chain per process slug)
- Editing mid-flight runs — existing runs continue on their snapshot definition
- Editing system processes through this tool — system processes stay under `adapt_process` scope plus engine-level changes
- Visual YAML diff UI — preview returns plain text / markdown; UI polish later

## Inputs

1. `src/engine/self-tools/generate-process.ts:53-260` — how a new process is validated, stored, and returned to Self. Reuse the validation helpers
2. `src/engine/self-tools/adapt-process.ts:38-120` — optimistic locking via `definitionOverrideVersion`, safety guards, structured diff; mine for reusable patterns
3. `packages/core/src/db/schema.ts` — `processes.definition`, `processes.version` (scan)
4. `src/engine/process-loader.ts` — `validateProcessDefinition`, `flattenSteps`, schema guards
5. `src/engine/self-delegation.ts` — where `selfTools: LlmToolDefinition[]` is declared; new tools must be registered here with the `confirmation required` pattern
6. `cognitive/self.md` — "Irreversible actions require explicit confirmation" — document the two-call pattern (preview → confirm)
7. `src/engine/trust.ts` — trust-tier runs; confirm that a tier relaxation already applied to a process doesn't accidentally downgrade during edit (the edit should preserve tier state)
8. `src/engine/heartbeat.ts` `startProcessRun` (line 1485) — verify run definition snapshot behaviour so an in-flight edit doesn't affect it

## Constraints

- Every edit requires explicit user confirmation (two-call pattern: `edit_process(preview=true)` → user sees diff → `edit_process(confirmed=true, expectedVersion=N)`)
- Optimistic locking: edit must reject if `expectedVersion` differs from current `processes.version`. Error message invites the Self to re-read and retry
- The previous definition JSON is preserved in a new `process_definition_history` table (keyed by `processId`, `version`) so MP-9.2 rollback can land without schema migration
- New runs after the edit use v+1. In-flight runs continue with their run-bound snapshot (verify via schema review)
- Validation: edits must pass the same `validateProcessDefinition` as `generate_process(save=true)` — including `tools:` referential integrity (Insight-180) and step-graph cycle detection
- System processes are excluded (`processes.system === true`) — they stay under `adapt_process` + engineering changes. Return clear error
- Cannot edit a process that has a run currently `running` (safety guard: prevent race between edit and active execution). Deferred: allow if the user passes `force=true` with clear warning — default off

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Optimistic-locking + preview pattern | `adapt_process` in `src/engine/self-tools/adapt-process.ts` | adopt | Identical safety pattern in-codebase |
| Versioning + history table | CRDTs / event-sourced config (e.g., Airtable table-schema versions, Retool app versions) | pattern | Standard approach to mutable schemas with rollback |
| Confirmation-required tool pattern | `adjust_trust(confirmed=true)` at `src/engine/self-tools/adjust-trust.ts` | adopt | Same two-call pattern already established |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/core/src/db/schema.ts` | Modify: new `process_definition_history` table: `{ id, processId FK, version, definition JSON, replacedAt timestamp, replacedBy text, changeSummary text }` |
| `drizzle/` | Generate migration via `pnpm db:generate` |
| `src/engine/self-tools/edit-process.ts` (new) | Create: `handleEditProcess({ processSlug, proposedDefinition, expectedVersion?, confirmed?, changeSummary? })`. Preview path returns a diff + next version number. Confirm path validates, snapshots old to history, writes new definition, bumps version. Reject on lock mismatch, in-flight run, or validation failure |
| `src/engine/self-delegation.ts` | Modify: register `edit_process` in `selfTools`. Tool description emphasises confirmation + preview |
| `src/engine/self-tools/edit-process.test.ts` (new) | Create: preview mode returns diff without writing; confirm with correct `expectedVersion` writes + history entry; mismatched version is rejected; invalid definition is rejected; system process is rejected; in-flight run blocks edit |
| `cognitive/self.md` | Modify: add guidance under "Irreversible actions" — how to route between `adapt_process` (run-scoped) and `edit_process` (permanent). Example conversation: user says "change this" → ask "just this run, or every future run?" → call the appropriate tool |
| `docs/adrs/031-process-edit-versioning.md` (new) | Create: ADR recording why we keep history in a separate table (vs `processes.definition_history` JSON column) — primarily queryability + schema evolution |

## User Experience

- **Jobs affected:** Define (explicitly edit a process), Decide (route between per-run and permanent scope)
- **Primitives involved:** ProcessProposalBlock (reused for preview), conversational confirmation pattern
- **Process-owner perspective:**
  1. User: "Skip the follow-up step in my quoting process."
  2. Self: "Quick check — just this one run, or every future run of quoting?"
  3. User: "Every future run."
  4. Self calls `edit_process(preview=true, processSlug="quoting", proposedDefinition=<patched>)` and renders a ProcessProposalBlock showing the diff. "Here's the change: removing step `send-follow-up` after `draft-quote`. Current version 4 → 5. Confirm?"
  5. User: "Yes."
  6. Self calls `edit_process(confirmed=true, expectedVersion=4, changeSummary="Removed send-follow-up step per user request")`. Returns success with new version.
  7. Any run started after this point uses v5. Currently-running v4 runs finish on v4.
- **Interaction states:**
  - Preview success: ProcessProposalBlock with unified diff
  - Preview on system process: refusal with pointer to `adapt_process`
  - Confirm with lock mismatch: error in-conversation ("Someone (or you, elsewhere) edited this since we looked — want me to re-fetch and try again?")
  - Confirm with in-flight run: error ("There's a run currently executing — wait for it to pause/complete, or confirm with `force=true` acknowledging the risk")
  - Invalid proposed definition: error surfacing the specific validation failure
- **Designer input:** Reuse ProcessProposalBlock for diff preview. If diff rendering needs polish (colour coded), route to Designer — for this brief keep plain text

## Acceptance Criteria

1. [ ] `process_definition_history` table created and migrated
2. [ ] `edit_process` tool registered in `selfTools` with clear description
3. [ ] Preview mode returns a structured diff (added/removed/changed steps) without writing
4. [ ] Confirm mode validates via existing `validateProcessDefinition` (reuses generate-process validation path)
5. [ ] Optimistic lock: confirm with stale `expectedVersion` is rejected
6. [ ] System processes (`processes.system === true`) reject edit with message pointing to `adapt_process`
7. [ ] In-flight (status=`running`) run blocks edit unless `force=true` is passed; `force` path logs a warning activity
8. [ ] On successful edit: previous definition + metadata written to `process_definition_history`, `processes.definition` updated, `processes.version` bumped
9. [ ] Already-running runs continue using their snapshot definition — verified by test starting a run, editing mid-flight (after pausing), then resuming and confirming the run still uses pre-edit steps
10. [ ] Runs started after the edit use the new definition — verified by starting a fresh run post-edit
11. [ ] Tool follows the two-call confirmation pattern: `preview=true` renders diff, `confirmed=true` writes
12. [ ] `cognitive/self.md` documents when to use `edit_process` vs `adapt_process`
13. [ ] ADR-031 explains the versioning decision
14. [ ] `tools:` referential integrity check runs on proposed definition (Insight-180)
15. [ ] Unit tests: preview no-op, confirm success, stale-version reject, system-process reject, in-flight reject, validation fail, history row written
16. [ ] `pnpm run type-check` passes
17. [ ] `pnpm db:generate` produces a clean migration

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) safety against in-flight runs — a race between `edit_process` and `startProcessRun` cannot produce a half-upgraded state, (b) validation parity with `generate_process(save=true)` — no easier path to a bad definition, (c) history table is append-only (no updates, no deletes), (d) confirmation pattern is genuinely two-call (LLM cannot pass `confirmed=true` on first turn), (e) locking error message is informative, not alarming
3. Present work + review findings to human for approval

## Smoke Test

```bash
pnpm run type-check
pnpm db:generate
pnpm vitest run src/engine/self-tools/edit-process.test.ts

# Live trace:
# Seed a non-system process "quoting" v1.
# Call edit_process(preview=true, processSlug="quoting", proposedDefinition=<missing-step>)
# → returns diff, no write
# Call edit_process(confirmed=true, expectedVersion=1, proposedDefinition=<missing-step>, changeSummary="Removed follow-up")
# → returns { version: 2 }, processes.version = 2, processes.definition updated, history row exists
# Call edit_process(confirmed=true, expectedVersion=1, ...)
# → returns error "Version conflict: expected 1, current is 2"
```

## After Completion

1. Update `docs/state.md` with MP-9.1 complete (+ 9.3 conversational routing in `self.md`)
2. Update `docs/meta-process-roadmap.md` — mark MP-9.1 and MP-9.3 done; MP-9.2 (rollback) becomes trivial once history exists (candidate for a small follow-up brief)
3. Insight candidate: "Versioning primitive for any mutable engine-level schema" — the history-table pattern may apply to agent definitions, quality criteria, etc.
