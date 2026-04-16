# Brief 157: Stuck State Visibility in ProgressBlock

**Date:** 2026-04-16
**Status:** draft
**Depends on:** none
**Unlocks:** MP-3.1 (autonomous digest can cite "waiting on Sarah's reply"), MP-7.3 is complete and surfaces stale reviews — this brief surfaces expected waits before they become stale

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-3)
- **Capabilities:** MP-3.2 — distinguish "actively running" from "waiting for external event" in the UI

## Context

Ditto has three legitimate "paused" states that the UI currently conflates:

1. **`waiting_review`** — trust gate paused the run for human review. User action required.
2. **`waiting_human`** set by an `executor: human` step — user input required.
3. **`waiting_human`** set by a `wait_for` step (`src/engine/heartbeat.ts:766-792`) — waiting for an **external event** (email reply, webhook, etc.) with an optional `timeoutAt`. No user action required; it's doing its job.

The `ProgressBlock` renderer at `packages/web/components/blocks/progress-block.tsx:18-49` only knows three statuses: `running`, `paused`, `complete`. A `wait_for` on "Sarah's reply" shows as **Paused** — the same visual as "needs your review." Users cannot tell:

- Is Alex blocked on me (action required)?
- Is Alex waiting for a counterparty (no action needed)?
- Is Alex hung (something broke)?

The `processRuns.timeoutAt` column (`packages/core/src/db/schema.ts:306`) already stores when the wait expires. `suspendState` (line 280) stores the `wait_for.event` and human-readable context. We have the data; we just don't surface it.

Brief 155 introduces `"decomposing"` as a status. This brief adds `"waiting_reply"`, `"waiting_schedule"`, and clarifies that `"paused"` means "needs your review."

## Objective

When a user looks at a ProgressBlock, they immediately understand: (a) is it actively running, (b) what it's waiting for (event vs. human vs. schedule), (c) when that wait expires. No more "is it stuck or just polite?"

## Non-Goals

- Changing how `wait_for` or scheduling works — only surfacing existing state
- Adding push notifications or email digests about stuck items (MP-3.1 autonomous digest, separate brief)
- Retrying/resuming stuck processes automatically — still user-initiated
- Visual redesign of ProgressBlock beyond necessary status label/copy updates

## Inputs

1. `packages/core/src/content-blocks.ts:105-112` — `ProgressBlock` shape, `status` union
2. `packages/web/components/blocks/progress-block.tsx` — renderer with `STATUS_BAR_COLOR` + `STATUS_BADGE_VARIANT` maps
3. `src/engine/heartbeat.ts:760-820` — `wait_for` suspend path writing `suspendState` + `timeoutAt`
4. `src/engine/heartbeat.ts:394-415` — `executor: human` step suspend path
5. `src/engine/heartbeat.ts` (trust-gate) and `harness-handlers/trust-gate.ts` — `waiting_review` flow
6. `packages/core/src/db/schema.ts:280, 306` — `suspendState`, `timeoutAt` columns on `processRuns`
7. `packages/web/lib/compositions/today.ts` / `work.ts` — where ProgressBlocks are prepended for active runs (search for `ProgressBlock`/`progress`)
8. `src/engine/self-tools/detect-risks.ts` — stale-review detector (Brief fix 2026-04-16) — should NOT alert on `waiting_reply` until timeoutAt passes
9. `processes/templates/follow-up-sequences.yaml` — example source of `wait_for: event: reply`

## Constraints

- The `ProgressBlock` type lives in `@ditto/core` — extending the status union is a core-engine-first change per CLAUDE.md engine/product split
- UI must degrade gracefully for old servers — if an unknown status arrives, render as "paused" rather than crash
- The "waiting_reply" / "waiting_schedule" status must NOT trigger MP-7.3 stale-review risks until `timeoutAt` elapses (otherwise every scheduled follow-up becomes a "risk" after 24h)
- Wait labels must be human-readable — not `"reply:<messageId>"`. Pull from `suspendState.waitFor.event` + the step's `name` field
- Screen-reader accessibility: status badge must carry an `aria-label` that expands "waiting_reply" to "waiting for reply"

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Richer status enum | GitHub Actions UI (`queued / in_progress / waiting / success / failure`) | pattern | Established precedent that users already understand |
| Wait-until label | Calendar-app "Waiting on `<person>`" language | pattern | Operational, low-anxiety copy |
| Graceful fallback for unknown status | React unknown-variant handling in existing renderer (default map branch) | adopt | Pattern already used in `progress-block.tsx:35-37` |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/core/src/content-blocks.ts` | Modify: extend `ProgressBlock` — `status: "running" \| "decomposing" \| "waiting_review" \| "waiting_human" \| "waiting_reply" \| "waiting_schedule" \| "complete" \| "failed"`. Add optional `waitContext?: { kind: "review" \| "human" \| "reply" \| "schedule"; label: string; timeoutAt?: string }` |
| `src/engine/content-blocks.ts` | Re-export shim — no change expected, just verify the re-export still compiles |
| `packages/web/components/blocks/progress-block.tsx` | Modify: extend status maps with new variants. Render `waitContext.label` + relative time-until-timeout under the main progress bar. Default branch ≠ crash |
| `packages/web/lib/compositions/today.ts` / `work.ts` / any feed assembler writing ProgressBlocks | Modify: set `status` based on the live `processRuns.status` + `suspendState`. Build `waitContext.label`: for `waiting_review` → "Needs your review"; for `executor: human` → "Needs your input: `<step name>`"; for `wait_for` → "Waiting for reply from `<person>`" (resolved via `suspendState`); for `deferredUntil` on step → "Scheduled to run `<relative time>`" |
| `src/engine/self-tools/get-briefing.ts` | Modify: include wait-state summary in the briefing — "2 processes running, 1 waiting for Sarah's reply (5 days remaining), 1 waiting on your review" |
| `src/engine/self-tools/detect-risks.ts` / `risk-detector.ts` | Modify: stale-review detector should skip runs where `status="waiting_human"` AND `timeoutAt` is in the future (i.e., known-good wait). Alert if `timeoutAt` has elapsed and the run is still waiting |
| `packages/web/components/blocks/progress-block.test.tsx` (new or existing) | Create/modify: snapshot-style tests for each status rendering |
| `src/engine/heartbeat-primitives.test.ts` | Modify: assert that a run suspended via `wait_for` produces a ProgressBlock surface with `status: "waiting_reply"` when read through the composition layer |

## User Experience

- **Jobs affected:** Orient (what's happening), Review (nothing sneaks up), Decide (what actually needs me)
- **Primitives involved:** ProgressBlock, sidebar "My Work" items, Today/Work composition surfaces
- **Process-owner perspective:**
  - "Quoting process — Waiting for reply from supplier@acme.com · 4 days remaining" → reassuring, zero action needed
  - "Invoice approval — Needs your review" → red dot in sidebar, click to act
  - "Daily outreach — Scheduled to run in 6 hours" → informational, zero anxiety
  - "Legacy process — Paused 11 days ago (deadline passed)" → elevated visual (same as stale-review risk)
- **Interaction states:**
  - All 4 wait-types render with distinct badges and copy
  - Passing `timeoutAt` into the past without resolution triggers the stale-review risk flow
  - Mobile renderer keeps copy truncated with tooltip reveal
- **Designer input:** Lightweight — copy decisions above; if visual polish needed, route to Designer. For now, reuse existing badge colours: `waiting_review` / `waiting_human` stay caution-amber; `waiting_reply` / `waiting_schedule` use info-neutral

## Acceptance Criteria

1. [ ] `ProgressBlock.status` union extended with `waiting_review`, `waiting_human`, `waiting_reply`, `waiting_schedule`, `failed`
2. [ ] Optional `ProgressBlock.waitContext` carries `{ kind, label, timeoutAt? }` for all waiting variants
3. [ ] Renderer shows a distinct badge per kind; unknown values fall back to the generic "paused" style
4. [ ] `waitContext.label` is populated from the process run's `suspendState` — reply events include the counterparty handle/email, human steps include the step name, schedule events include the relative time
5. [ ] `timeoutAt` is rendered as a relative countdown (e.g., "5 days remaining") using a small utility; past-due renders as "expired `<N>` hours ago"
6. [ ] Stale-review risk detector (Brief fix 2026-04-16) skips `waiting_human` runs where `timeoutAt > now`
7. [ ] Stale-review risk detector fires when `timeoutAt <= now` AND run is still `waiting_human`
8. [ ] `get_briefing` summary distinguishes the three wait kinds: "N need your attention" vs "N scheduled" vs "N waiting on replies"
9. [ ] Accessibility: status badge has `aria-label` and the countdown is announced by screen readers
10. [ ] Unit test: ProgressBlock renderer covers each status variant (snapshot)
11. [ ] Unit test: composition layer builds correct `waitContext` for a process run suspended via `wait_for`
12. [ ] Unit test: composition layer builds correct `waitContext` for a `executor: human` step
13. [ ] Unit test: composition layer builds correct `waitContext` for a scheduled (`deferredUntil`) step
14. [ ] No regression: existing ProgressBlock usages continue to work (only three original statuses) — verify via existing tests
15. [ ] `pnpm run type-check` passes at root and in `packages/core`

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) engine-first — core type updated before web consumer, (b) fallback renders are safe, (c) risk detector logic matches the new wait semantics, (d) privacy — counterparty handles appear only in authenticated workspace contexts, not in public surfaces, (e) copy is non-anxious ("Waiting for reply" not "Blocked")
3. Present work + review findings to human for approval

## Smoke Test

```bash
pnpm run type-check

# Core + web renderer tests
pnpm vitest run packages/web/components/blocks/progress-block.test.tsx
pnpm vitest run src/engine/heartbeat-primitives.test.ts

# Live trace:
# Start a process that calls wait_for on an email reply.
# Observe the ProgressBlock in Today composition renders:
#   "Waiting for reply from <email>" with "<N> days remaining"
# Advance system time past timeoutAt.
# Confirm stale-review risk appears (briefing surfaces it).
```

## After Completion

1. Update `docs/state.md` with MP-3.2 complete
2. Update `docs/meta-process-roadmap.md` — mark MP-3.2 done
3. Insight candidate: "State truth-telling in UI" — all pause states deserve distinct labels, not a single "paused"
