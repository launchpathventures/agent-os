# Brief 145: Goal Framing — Process Creation to First Run

**Date:** 2026-04-14
**Status:** draft
**Depends on:** none
**Unlocks:** Brief 148 (MP-2 onboarding handoff depends on MP-1.1 template matching), MP-1.6 (end-to-end test)

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-1)
- **Capabilities:** MP-1.1 (template matching in generate_process), MP-1.2 (post-creation activation), MP-1.3 (activate_cycle fullHeartbeat fix)

## Context

When a user approves a process proposal, nothing runs. There are two creation paths and both are broken:

**Path A — Interactive form submission** (`surface-actions.ts:364-399`): User fills out ProcessProposalBlock form → `handleFormSubmit()` calls `executeDelegation("generate_process", {save: true})` → returns StatusCardBlock with "created" status → **dead end**. No run starts. No offer to activate. The engine saves the process and the UI shows "created" and then nothing.

**Path B — Conversational approval** (chat text to Self): User says "yes, create that" → Self calls `generate_process(save=true)` → returns success metadata → Self should offer to run but **there's no delegation guidance telling it to**. Self may or may not suggest activation depending on its reasoning.

Additionally, `activate_cycle` in `cycle-tools.ts:153-162` creates a process run via `startProcessRun()` but never calls `fullHeartbeat()`. Cycles sit in "queued" state indefinitely until the scheduler picks them up. Compare with `start_pipeline` at `self-delegation.ts:1107-1111` which correctly uses `setImmediate(() => fullHeartbeat())`.

And `generate_process` builds YAML from scratch every time, ignoring the 22 templates and `findProcessModel()` scoring (confidence-based keyword matching with industry boost) that the orchestrator already uses in Tier 1 routing at `orchestrator.ts:376-479`.

## Objective

After this brief: both creation paths lead to either immediate execution or a clear activation prompt. Template matching produces better initial definitions. Cycle activation starts running immediately.

## Non-Goals

- Goal decomposition progress streaming (MP-1.4 — separate brief)
- Tier 3 build notifications (MP-1.5 — depends on MP-1.4)
- End-to-end test for full flow (MP-1.6 — separate brief after this ships)
- Process editing or versioning (MP-9)
- Changes to `findProcessModel()` scoring algorithm — it works as-is
- Changes to the ProcessProposalBlock UI component — it already supports form submission

## Inputs

1. `src/engine/self-tools/generate-process.ts` — current implementation: builds YAML from scratch (lines 52-202)
2. `src/engine/system-agents/process-model-lookup.ts` — `findProcessModel()` with keyword scoring, DB-first with filesystem fallback (lines 111-148), confidence >= 0.6 for direct use
3. `src/engine/self-tools/cycle-tools.ts` — `activate_cycle` missing fullHeartbeat (lines 70-197)
4. `src/engine/self-delegation.ts` — `start_pipeline` pattern with `setImmediate(() => fullHeartbeat())` (lines 1107-1111)
5. `src/engine/surface-actions.ts` — form submission handler for `process_proposal` (lines 364-399), returns StatusCardBlock then stops
6. `src/engine/system-agents/orchestrator.ts` — Tier 1 routing uses `findProcessModel()` (lines 376-479)
7. `packages/web/components/blocks/process-proposal-block.tsx` — UI component, form submission fires `onAction("form-submit", { blockType: "process_proposal", values })` (line 71)
8. `docs/meta-process-roadmap.md` — MP-1 section

## Constraints

- `findProcessModel()` must not be modified — it already works with DB-backed models and filesystem fallback
- Template matching confidence threshold must match orchestrator (>= 0.6 for direct use, 0.3-0.6 for "inspired by")
- Post-creation activation in the **form-submit path** must be wired in `surface-actions.ts` — this path does NOT go through Self, so delegation guidance won't help here. The surface action must return an `activationPrompt` in `conversationContext` so the chat handler can offer to run
- Post-creation activation in the **conversational path** must use Self delegation guidance — Self sees the tool result and decides to offer `start_pipeline`
- `activate_cycle` fix must match exactly the `start_pipeline` `setImmediate` pattern — no new abstractions
- No changes to `@ditto/core` — all changes are product layer (`src/engine/`)
- No changes to web UI components — the existing block renderers and action system are sufficient

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Template matching before generation | Orchestrator Tier 1 routing (`process-model-lookup.ts`) | adopt | Same codebase — `findProcessModel()` already implements the scoring |
| Post-creation activation via conversationContext | `surface-actions.ts` SurfaceActionResult pattern | adopt | Same codebase — `conversationContext` field already exists on action results for injecting follow-up context |
| setImmediate heartbeat kick | `self-delegation.ts:1107-1111` | adopt | Proven pattern, one-line addition |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/self-tools/generate-process.ts` | Modify: Before building YAML from scratch, call `findProcessModel()` with the user's description. If confidence >= 0.6, use template as base and adapt step descriptions/names to user context. If 0.3-0.6, mention the template as inspiration. Below 0.3, proceed from scratch |
| `src/engine/self-tools/generate-process.ts` | Modify: After save=true success, include `activationHint: true` and `processSlug` in the result metadata so both paths know activation should be offered |
| `src/engine/surface-actions.ts` | Modify: In `process_proposal` form handler (line 364-399), after successful creation, set `conversationContext: { activationReady: true, processSlug, processName }` on the result so the chat handler can inject "Want me to run this now?" as Self context |
| `src/engine/self-delegation.ts` | Modify: In delegation guidance for Self, add instruction: when `generate_process` returns with `activationHint`, offer to run immediately via `start_pipeline` or connect to pending work |
| `src/engine/self-tools/cycle-tools.ts` | Modify: After `startProcessRun()` in `activate_cycle`, add `setImmediate(() => { fullHeartbeat(runId).catch((err) => console.error(\`Cycle ${runId} failed:\`, err)); })` |
| `src/engine/self-tools/generate-process.test.ts` | Modify or create: Tests for template matching integration and activation hint in result |
| `src/engine/self-tools/cycle-tools.test.ts` | Modify: Add test verifying fullHeartbeat is called after cycle activation |

## User Experience

- **Jobs affected:** Define (process creation), Delegate (activation)
- **Primitives involved:** ProcessProposalBlock (existing), StatusCardBlock (existing)
- **Process-owner perspective:**
  - **Form path:** User fills out proposal form → clicks Create → StatusCardBlock shows "Process created" → conversation context injects "Want me to run this now with [first task]?" → user confirms → pipeline starts → SSE events flow → ProgressBlock appears
  - **Conversational path:** User says "I need a quoting process" → Self proposes template-matched definition → user approves → Self says "Created. Want me to run this with your pending quote request?" → user says yes → pipeline starts
- **Interaction states:**
  - Creation success: StatusCardBlock with "created" status (existing)
  - Activation offered: Self message in conversation (no new UI component)
  - Activation started: StatusCardBlock with "started" status (existing from start_pipeline)
  - Progress: SSE events trigger cache invalidation → feed shows running pipeline (existing)
- **Designer input:** Not invoked — no new visual components, changes are in action routing and delegation guidance

## Acceptance Criteria

1. [ ] `generate_process` calls `findProcessModel()` before building YAML from scratch
2. [ ] When template match confidence >= 0.6, the generated process definition uses the template's structure (steps, tools, executor) as the base, adapted with the user's specific description
3. [ ] When template match confidence 0.3-0.6, the response mentions the template: "I found a similar template ({name}) — I'll use that as a base"
4. [ ] When template match confidence < 0.3, generation proceeds from scratch as before (no regression)
5. [ ] After `generate_process(save=true)` succeeds, result metadata includes `activationHint: true` and `processSlug`
6. [ ] `surface-actions.ts` form handler for `process_proposal`: after successful creation, returns `conversationContext: { activationReady: true, processSlug, processName }` so the chat handler can offer activation
7. [ ] Self delegation guidance includes instruction: when `generate_process` returns with `activationHint`, offer to run via `start_pipeline` or connect to pending work
8. [ ] `activate_cycle` calls `setImmediate(() => fullHeartbeat(runId).catch(...))` after `startProcessRun()`, matching the `start_pipeline` pattern exactly
9. [ ] Existing `generate_process` tests continue to pass (no regression)
10. [ ] New test: template match found (confidence >= 0.6) → generated definition includes template step names
11. [ ] New test: no template match (confidence < 0.3) → generation proceeds from scratch
12. [ ] New test: `activate_cycle` triggers `fullHeartbeat` (verify via mock or spy)
13. [ ] New test: `surface-actions.ts` form handler returns `conversationContext` with activation data after creation
14. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: template matching doesn't bypass user approval, activation is advisory not automatic (user can ignore the offer), cycle fix matches existing pattern exactly, both creation paths (form and conversational) are covered
3. Present work + review findings to human for approval

## Smoke Test

```bash
# Type-check
pnpm run type-check

# Run generate-process tests
pnpm vitest run src/engine/self-tools/generate-process.test.ts

# Run cycle-tools tests
pnpm vitest run src/engine/self-tools/cycle-tools.test.ts

# Verify activate_cycle pattern matches start_pipeline
grep -A5 "setImmediate" src/engine/self-tools/cycle-tools.ts
grep -A5 "setImmediate" src/engine/self-delegation.ts | head -10

# Verify surface-actions returns conversationContext
grep -A10 "activationReady\|conversationContext" src/engine/surface-actions.ts
```

## After Completion

1. Update `docs/state.md` with MP-1.1, MP-1.2, MP-1.3 completion
2. Update `docs/meta-process-roadmap.md` — mark MP-1.1, MP-1.2, MP-1.3 as done
3. Update `docs/roadmap.md` — note meta-process robustness progress
4. Phase retrospective: did template matching produce better initial definitions? Did both creation paths lead to activation?
