# Brief 158: Guidance-to-Memory Bridge for Escalations

**Date:** 2026-04-16
**Status:** draft
**Depends on:** Brief 147 (learning loop closure — the memory-reinforcement APIs this brief calls are set up there)
**Unlocks:** real exception learning — same escalation doesn't recur run after run

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-7)
- **Capabilities:** MP-7.2 — when a user resolves an escalation, the guidance is captured as a durable memory so the next occurrence auto-resolves

## Context

Escalations today have two shapes:

1. **Human steps** (`executor: human`): `src/engine/heartbeat.ts:394-415` suspends the run, waits for `resumeHumanStep(stepRunId, humanInput)`. The human input is written to `step_runs.outputs` (line 1536) and `activities.process.run.resumed` (line 1582). **Not written as a memory.** Next run of the same process starts blind.

2. **Confidence gates and retry exhaustion** (heartbeat `waiting_review` path): user approves/edits/rejects via `review-actions.ts`. Edit feedback flows through `feedback-recorder.ts` which now creates correction memories (`createMemoryFromFeedback` line 141-220). **But unstructured escalation guidance** — e.g. the human responded to "I'm stuck on this quote" with "use combined pricing when the customer asks about materials + labour" — that text lives only in `humanInput` or `feedback.comment`, never in memory.

The result: the same escalation recurs. A builder hits an edge case, the user teaches them, and three days later the same step escalates for the same reason. The audit flagged this as MP-7.2.

`createMemoryFromFeedback` already knows how to dedupe, reinforce on repeats, and scope to process. We need to call the same helper (or a cousin) from `resumeHumanStep` and from the review-action edit path for reject/edit comments when they carry guidance.

## Objective

When a user resolves an escalation with natural-language guidance — either completing a human step with text input, or editing/rejecting a `waiting_review` output with a comment — that guidance becomes a process-scoped memory (`type: "guidance"`) that memory-assembly loads for the next run of the same step.

## Non-Goals

- Classifying the guidance for quality — all human guidance is recorded; quality is handled by reinforcement (repeated guidance strengthens)
- Changing what triggers an escalation (confidence, retries, explicit human steps) — only the resolution side
- Promoting guidance into `quality_criteria` — that's Brief 147's pattern path; this brief keeps guidance in memories only. Upgrading to criteria is a separate proposal if guidance repeats 3+ times (tracked via reinforcement count)
- Cross-process guidance sharing — each memory is process-scoped; agent-scoped promotion is a future brief

## Inputs

1. `src/engine/heartbeat.ts:1506-1582` — `resumeHumanStep(stepRunId, humanInput)` — where to tap in
2. `src/engine/heartbeat.ts:394-415` — `executor: human` suspend writes `input_fields` from step config; document which `humanInput` fields are text-shaped
3. `src/engine/harness-handlers/feedback-recorder.ts:141-220` — `createMemoryFromFeedback` — reusable with minor extension (new memory `type` value)
4. `src/engine/review-actions.ts` — `editRun`, `rejectRun` — where `feedback.comment` is recorded. Check whether free-text comment is already passed into the memory bridge or dropped
5. `src/engine/harness-handlers/memory-assembly.ts:131-151` — process-scoped memory loader; confirm `type: "guidance"` would be included in the default load (or add it)
6. `packages/core/src/db/schema.ts` — `memoryTypeValues` — needs `"guidance"` if not already present
7. `docs/insights/181-feedback-to-memory.md` (if exists) — principle behind MP-4.1 that this brief extends to a new class of feedback
8. `src/engine/harness-handlers/feedback-recorder.test.ts` — test patterns to mirror
9. `src/engine/heartbeat.test.ts` — `resumeHumanStep` test scaffold

## Constraints

- Guidance must be scoped to the **process + step**, not just process — otherwise guidance about step A bleeds into step B's context. Use `scopeType: "process"`, `scopeId: processId`, and embed stepId inside the memory content or metadata
- Guidance payloads can be long (user writes a paragraph). Truncate at ~500 chars for memory content; keep full payload on the source record (`stepRuns.outputs` / `feedback.comment`)
- PII redaction: guidance may contain emails/phone numbers. Apply the same scrubber used by credential-vault logging (`src/engine/credential-vault.ts`)
- Must not fire on trivial inputs (empty string, single-word "ok"/"done"). Minimum length heuristic (e.g., 15 chars + contains whitespace)
- Reuse `createMemoryFromFeedback` dedupe logic so "use combined pricing" doesn't create 20 memories over 20 recurrences — instead, reinforcement count climbs

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Guidance-as-memory pattern | `createMemoryFromFeedback` in `feedback-recorder.ts:141-220` | adopt | Exact pattern we need; extend with a new memory type |
| Text truncation + redaction | `credential-vault.ts` scrubbers | pattern | Same codebase's safety pattern |
| Per-step scoping | `memory-assembly.ts:131-151` (already loads step-scoped context at execution) | adopt | Uses same addressing convention |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/core/src/db/schema.ts` | Modify: add `"guidance"` to `memoryTypeValues` if not present |
| `src/engine/harness-handlers/feedback-recorder.ts` | Modify: extract a `createGuidanceMemory({ processId, stepId, content, sourceKind: "human-step" \| "review-comment" })` helper that wraps existing dedup + reinforcement logic but writes `type: "guidance"`, stores stepId in `metadata.stepId`, redacts + truncates |
| `src/engine/heartbeat.ts:1506-1582` | Modify: after `resumeHumanStep` writes `humanInput` to `step_runs.outputs`, if any `humanInput[*]` is a non-trivial text value (length ≥ 15, contains whitespace), call `createGuidanceMemory` |
| `src/engine/review-actions.ts` | Modify: in `editRun` and `rejectRun`, if `comment` is non-trivial, call `createGuidanceMemory` with `sourceKind: "review-comment"` (in addition to existing `createMemoryFromFeedback` for structured edit diffs) |
| `src/engine/harness-handlers/memory-assembly.ts:131-151` | Modify: include `type: "guidance"` in the default process-scoped load. Render guidance memories under a clear heading so the agent knows these are operator directives, not auto-learned corrections |
| `src/engine/harness-handlers/feedback-recorder.test.ts` | Modify: new test suite for `createGuidanceMemory` — dedup, reinforcement, step scoping, redaction, minimum-length gate |
| `src/engine/heartbeat.test.ts` | Modify: assert that resuming a human step with text input creates a guidance memory; resuming with `{ approved: true }` alone does not |
| `src/engine/review-actions.test.ts` (if exists) or new | Create: assert that editing with a substantive comment creates both an edit memory and a guidance memory |

## User Experience

- **Jobs affected:** Review (easier — same problem doesn't come back), Delegate (confidence that Alex learns)
- **Primitives involved:** Escalation card, edit comment field
- **Process-owner perspective:**
  - Run 1: Alex escalates "I'm stuck on this quote — should I include materials?" User types: "Yes — when materials > $500, bundle them under a 'Supplies' line item. Otherwise roll into labour."
  - Run 2 (same step, similar context): Alex's context includes: *"Operator guidance (reinforced 1 time): When materials > $500, bundle as 'Supplies' line item. Otherwise roll into labour."* Alex no longer escalates; produces the right output.
  - Run 3+: Reinforcement climbs. If guidance is contradictory in a later run, the new guidance dedupes-or-supersedes via existing reinforcement logic
- **Interaction states:**
  - Trivial human input (`"ok"`, `{ approved: true }`): no memory written
  - Substantive text input: guidance memory created silently (no UI interruption)
  - Existing guidance reinforced: reinforcement count increments, no duplicate row
- **Designer input:** Not invoked — no new UI surfaces. Potential future surface: "what Alex learned from this" card showing guidance memories per process — out of scope here

## Acceptance Criteria

1. [ ] `"guidance"` added to `memoryTypeValues`
2. [ ] `createGuidanceMemory` helper exists and reuses dedupe + reinforcement logic from `createMemoryFromFeedback`
3. [ ] `resumeHumanStep` calls `createGuidanceMemory` when `humanInput` contains a text field of length ≥ 15 chars with whitespace
4. [ ] `resumeHumanStep` does NOT call `createGuidanceMemory` when input is `{ approved: true }`, `{ done: true }`, or only non-text fields
5. [ ] `editRun` and `rejectRun` call `createGuidanceMemory` when `comment` is substantive (same minimum-length gate)
6. [ ] Guidance memory content is redacted (emails, phone numbers) and truncated to 500 chars
7. [ ] Guidance memory stores `stepId` in metadata so the same process but different step doesn't collide
8. [ ] Same guidance text, same step, second occurrence → reinforcement count increments, no new row
9. [ ] `memory-assembly` loads `type: "guidance"` memories alongside existing `correction`/`solution` types for process-scoped context
10. [ ] Guidance is rendered under a clear heading ("Operator guidance:") in the assembled context so the agent recognises it as directive rather than auto-learned correction
11. [ ] Token budget respected: guidance memories share the existing process-scope budget
12. [ ] Unit test: human-step resume with text input → memory created
13. [ ] Unit test: human-step resume with `{ approved: true }` → no memory
14. [ ] Unit test: `editRun` with comment → guidance memory + correction memory both created
15. [ ] Unit test: repeat guidance reinforces, doesn't duplicate
16. [ ] Unit test: PII is redacted before persisting
17. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) scoping correctness (process + step, not process only), (b) guidance does not escape into wrong process contexts, (c) PII handling is consistent with credential-vault scrubbers, (d) token budget in memory-assembly is not blown by a user who writes 20+ long guidance comments, (e) interaction with Brief 147 — a 3+ repeat guidance could later promote to `quality_criteria` via existing pattern detection
3. Present work + review findings to human for approval

## Smoke Test

```bash
pnpm run type-check

pnpm vitest run src/engine/harness-handlers/feedback-recorder.test.ts
pnpm vitest run src/engine/heartbeat.test.ts
pnpm vitest run src/engine/review-actions.test.ts

# Integration trace:
# Start a process with a human step.
# Resume with humanInput = { note: "Use combined pricing when materials > $500" }
# Confirm memories table has one row, type="guidance", scope_id=processId, content contains "combined pricing"
# Start another run of the same process; inspect the memory-assembly context; confirm guidance is present
```

## After Completion

1. Update `docs/state.md` with MP-7.2 complete
2. Update `docs/meta-process-roadmap.md` — mark MP-7.2 done
3. If reinforcement counts on specific guidance memories climb quickly, consider a future brief to auto-propose them as `quality_criteria` via Brief 147's pattern mechanism
