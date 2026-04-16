# Brief 155: Orchestrator Decomposition Progress Events

**Date:** 2026-04-16
**Status:** draft
**Depends on:** none (uses existing `harnessEvents` bus + SSE `/api/events` plumbing)
**Unlocks:** MP-1.5 (Tier 3 build notification), MP-2.4 (first-run streaming in magic-link workspace)

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-1)
- **Capabilities:** MP-1.4 — goal decomposition streams progress events the UI can render as a ProgressBlock

## Context

When a user says "help me do X" the flow can take three paths:
- `start_pipeline` → fires `runHeartbeatDetached` (Brief fix 2026-04-16) → `harnessEvents.emit("step-start" | "step-complete" | ...)` → SSE → UI shows `ProgressBlock`. This path is instrumented.
- `activate_cycle` → same pattern, same instrumentation.
- `create_work_item` → classifier routes to `executeOrchestrator` (`src/engine/system-agents/orchestrator.ts:94`) → goal decomposition via `decomposeGoalLLM` or `decomposeGoal` → `routeDecomposedTasks` → `goalHeartbeatLoop(workItemId)` fired via `setImmediate`. **This path emits no events until the first child step runs.**

The audit traced the exact silence: lines 111–136 (LLM decomposition) and 156–174 (fast path). The orchestrator calls `decomposeGoalLLM` (potentially 2–5 seconds of LLM latency) and `routeDecomposedTasks` (per-sub-goal routing decisions) without a single `harnessEvents.emit`. The user approves a proposal and stares at a blank conversation for several seconds with no sign the system is working, no "breaking this down into 3 steps" update, no ProgressBlock. That's the exact moment confidence breaks.

`ProgressBlock` at `packages/core/src/content-blocks.ts:105-112` has the shape we need (`currentStep`, `totalSteps`, `completedSteps`, `status`). `useHarnessEvents` at `packages/web/hooks/use-harness-events.ts` already invalidates `activeRuns` on pipeline events — if we emit during decomposition, the UI stays live.

## Objective

When the orchestrator decomposes a goal, the UI renders a `ProgressBlock` that transitions from `"Understanding the goal..."` → `"Planning 3 steps..."` → `"Starting step 1..."` within 1 second of approval, with no blank-screen gap before the first child run.

## Non-Goals

- Changing how decomposition works (LLM vs fast path) — only emitting events around the existing logic
- Persisting decomposition progress separately from step runs (we reuse the harness event bus)
- Token-level streaming of the decomposition LLM call (separate brief if needed)
- Tier 3 build notification (MP-1.5 — depends on this brief's events but is its own UX surface)

## Inputs

1. `src/engine/system-agents/orchestrator.ts:94-175` — `executeOrchestrator` entry, LLM decomposition path (111–136), fast path (156–174)
2. `src/engine/system-agents/orchestrator.ts` — `decomposeGoalLLM`, `decomposeGoal`, `routeDecomposedTasks` (search for each — emit events inside or wrap)
3. `packages/core/src/harness/events.ts:10-19` — `HarnessEvent` union. Will need a new variant or we reuse `step-start` / `step-complete` with synthetic stepIds
4. `src/engine/events.ts` — re-export
5. `packages/web/hooks/use-harness-events.ts` — SSE consumer; note which event types it forwards
6. `packages/core/src/content-blocks.ts:105-112` — `ProgressBlock` shape
7. `packages/web/components/blocks/progress-block.tsx` — renderer
8. `src/engine/heartbeat.ts:1124-1126` — how `runHeartbeatDetached` already surfaces failures (reuse for decomposition-failed)
9. `src/engine/self-tools/create-work-item.ts` — where the user-visible delegation result returns; caller that sees "action: decomposed" today
10. `docs/meta-process-roadmap.md` — MP-1.4 section

## Constraints

- Do not change `executeOrchestrator`'s return shape — existing callers (`step-executor`, tests) rely on `OrchestrationResult`
- Event volume must stay sane — one "decomposition-started" + one "decomposition-complete" + per-sub-goal "routing" is enough, not per-LLM-token
- Decomposition events must go through the existing `harnessEvents` singleton — do not create a parallel bus
- The `ProgressBlock` emitted for decomposition must use a stable `processRunId`-like identifier that the UI can correlate. When the goal has no parent run yet (ad-hoc `create_work_item`), synthesise an ID from `workItemId` so the block is addressable. Document the convention.
- SSE must remain transient for decomposition — clients joining mid-decomposition should still get a correct ProgressBlock via `activeRuns` query, so the decomposition must be queryable after the fact (store current stage on the work item's `decomposition` JSON column)

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Event types + bus | `packages/core/src/harness/events.ts` existing pattern | adopt | Already in-codebase, already wired through SSE |
| ProgressBlock UX | `packages/web/components/blocks/progress-block.tsx` | adopt | Existing renderer covers the states we need |
| Synthetic run id convention | Trigger.dev `run_id` for orchestration contexts | pattern | Standard pattern — treat decomposition as a pseudo-run for UI continuity |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/core/src/harness/events.ts` | Modify: add `decomposition-started`, `decomposition-sub-goal`, `decomposition-complete`, `decomposition-failed` variants to `HarnessEvent` union. Each carries `workItemId`, and sub-goal events carry `{ label, index, total }` |
| `src/engine/system-agents/orchestrator.ts` | Modify: emit `decomposition-started` at entry of `decomposeGoalLLM` / `decomposeGoal` with estimated-steps (unknown on entry — emit `totalSteps: 0` initially). Emit `decomposition-sub-goal` inside the loop of `routeDecomposedTasks` for each task. Emit `decomposition-complete` right before `setImmediate(goalHeartbeatLoop)`. Wrap with try/catch; on throw emit `decomposition-failed` and rethrow (preserve existing error propagation) |
| `src/db/schema/engine.ts` (via `packages/core/src/db/schema.ts`) | Already has `workItems.decomposition` JSON column — reuse. Add a `stage: "understanding" \| "planning" \| "routing" \| "ready" \| "failed"` key inside that JSON to make the current stage queryable after events pass |
| `packages/web/hooks/use-harness-events.ts` | Modify: forward `decomposition-*` event types. On `decomposition-complete` invalidate `activeRuns`. On `decomposition-failed` surface failure state |
| `packages/web/components/blocks/progress-block.tsx` | Modify: handle a new `block.status === "decomposing"` value. Label renders "Planning N steps…" when decomposition phase |
| `packages/core/src/content-blocks.ts:105-112` | Modify: extend `ProgressBlock.status` union with `"decomposing"` |
| `src/engine/self-tools/create-work-item.ts` | Modify: after classifier determines this is a goal, return `metadata: { workItemId, decompositionStarted: true }` so the conversation can synthesise an initial ProgressBlock before any events arrive |
| `packages/web/lib/engine.ts` | Modify: expose a helper that queries `workItems.decomposition.stage` for late-join clients |
| `src/engine/system-agents/orchestrator.test.ts` | Modify: assert events are emitted in order for both LLM and fast paths |
| `packages/core/src/harness/events.test.ts` (or equivalent) | Modify: typed-emit assertions for new variants |

## User Experience

- **Jobs affected:** Orient (I know what just happened), Define (I see my goal being shaped), Delegate (I trust Alex is actually on it)
- **Primitives involved:** ProgressBlock; conversational follow-up from Self
- **Process-owner perspective:**
  1. User: "Help me follow up with everyone who opened my newsletter last week."
  2. Alex: "On it — let me plan this out."
  3. `ProgressBlock` appears: **Understanding your goal…** (status: decomposing, totalSteps: 0, completedSteps: 0)
  4. After ~1-3s: **Planning 3 steps…** (status: decomposing, totalSteps: 3, completedSteps: 0)
  5. **Step 1: Pulling newsletter open list** (status: running, totalSteps: 3, completedSteps: 0)
  6. Continues as normal pipeline progression
- **Interaction states:**
  - Understanding (LLM call in flight): indeterminate progress, label "Understanding your goal…"
  - Planning (post-LLM, pre-routing): determinate, "Planning N steps…"
  - Routing (per-sub-goal): determinate with last-routed label
  - Ready: transitions to step-level progress
  - Failed: ProgressBlock shows error state with `decomposition-failed` reason
- **Designer input:** Not invoked — reuses existing ProgressBlock; copy decisions covered in ACs

## Acceptance Criteria

1. [ ] `HarnessEvent` union includes `decomposition-started`, `decomposition-sub-goal`, `decomposition-complete`, `decomposition-failed`
2. [ ] `executeOrchestrator` emits `decomposition-started` as its first action for goal-type work items (before any LLM call)
3. [ ] LLM path emits one `decomposition-sub-goal` per task in `routeDecomposedTasks`
4. [ ] Fast path emits one `decomposition-sub-goal` per step in `decomposeGoal`
5. [ ] `decomposition-complete` fires exactly once per decomposition, after routing, before `goalHeartbeatLoop` is kicked
6. [ ] If decomposition throws, `decomposition-failed` fires with the error message and the original error still propagates up (tests cover both paths)
7. [ ] `workItems.decomposition.stage` is updated to `"understanding" | "planning" | "routing" | "ready" | "failed"` at each phase — query-able by clients that miss events
8. [ ] `ProgressBlock.status` extended to include `"decomposing"`; renderer shows a neutral spinner with the appropriate label
9. [ ] `use-harness-events` forwards decomposition events and invalidates `activeRuns` on `decomposition-complete`
10. [ ] When user approves a proposal and a goal is created, the conversation shows a ProgressBlock within 200ms (synthesised from `create_work_item` metadata, not waiting for the SSE round-trip)
11. [ ] Existing orchestrator tests still pass (new events are additive, not behaviour-changing)
12. [ ] Unit test: full event sequence captured for an LLM decomposition path
13. [ ] Unit test: full event sequence captured for a fast (process-slug) decomposition path
14. [ ] Unit test: thrown decomposition → `decomposition-failed` → rethrow
15. [ ] E2E smoke: create a goal via `create_work_item` and assert the browser observes a ProgressBlock before the first step-start event
16. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) event ordering is deterministic, (b) no event leakage across work items (every event carries `workItemId`), (c) the new `ProgressBlock` status does not break existing renderers, (d) synthesised ProgressBlock on the client is cleared when real step events arrive (no stale state), (e) failure path emits `decomposition-failed` AND rethrows (doesn't swallow)
3. Present work + review findings to human for approval

## Smoke Test

```bash
# Type check
pnpm run type-check

# Orchestrator event tests
pnpm vitest run src/engine/system-agents/orchestrator.test.ts

# Manual trace — run the engine, create a goal via CLI, confirm events stream
pnpm cli capture "Follow up with open-rate top 20 contacts from last week"
# Expect, in order:
#   decomposition-started
#   decomposition-sub-goal (x N)
#   decomposition-complete
#   step-start (first child step)
```

## After Completion

1. Update `docs/state.md` with MP-1.4 complete
2. Update `docs/meta-process-roadmap.md` — mark MP-1.4 done; check MP-1.5 (Tier 3 build notification) can now proceed
3. Insight if emergent: document whether synthesised ProgressBlock pattern is reusable for other async server decisions (e.g. trust upgrade analysis, metacognitive checks)
