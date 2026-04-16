# Brief 160: Autonomous Digest — "While You Were Away"

**Date:** 2026-04-16
**Status:** draft
**Depends on:** none
**Unlocks:** MP-5.3 (trust-tier digest integration), more confident trust upgrades (users can see autonomous work before agreeing to relax reviews)

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-3, MP-5)
- **Capabilities:** MP-3.1 — the daily briefing summarises what auto-advanced while the user was away. MP-5.3 extends this into a per-process "handled automatically" section shown during trust discussions

## Context

Ditto's trust tiers allow processes to auto-advance past review:
- `spot_checked` tier (`src/engine/harness-handlers/trust-gate.ts:111-131`) samples ~20% of runs for review; 80% auto-advance
- `autonomous` tier (line 132+) auto-advances all non-critical steps

Today's briefing (`src/engine/briefing-assembler.ts:97-164`) surfaces six dimensions: `focus`, `attention`, `upcoming`, `risks`, `suggestions`, `stats`. None of them tell the user what **actually happened while they were away**. `stats` has totals, not a summary.

Consequences:

1. **Trust anxiety.** A user who upgraded a process to `spot_checked` can't see the 80% that ran without review. They assume the worst and downgrade back.
2. **Missed signal.** Auto-advanced runs might still have subtle issues. Without a digest, the user never reviews them — the system's confidence isn't tested.
3. **Reduced felt value.** "12 follow-up emails sent, 2 got responses" is the whole point of delegation. Hiding it makes the product feel quieter than it actually is.

The data exists. `step_runs` carries status (`approved`), `confidenceLevel`, `completedAt`. `processRuns` has `completedAt`, `status`, `totalCostCents`. We need an aggregator keyed by "since user's last active session" and the last-session timestamp is already computed at line 102-118 of briefing-assembler.

## Objective

The briefing includes a `autonomousDigest` section summarising what auto-advanced per process since `lastActiveAt`: counts, notable outcomes (e.g., replies received on autonomous outreach), and an explicit "nothing to surface" state when the window is empty or everything needed review.

## Non-Goals

- Re-reviewing auto-advanced runs — they stay approved; the digest is informational
- Push notifications for each auto-advance (too noisy)
- Per-step granularity in the briefing summary — process-level is enough for the briefing; step detail shows up in process-detail views
- Visual charts — this brief produces text data the Self narrates. Visualisation is a follow-up if users find the number-dense summary hard to parse

## Inputs

1. `src/engine/briefing-assembler.ts:97-164` — current briefing assembly; location where `autonomousDigest` plugs in
2. `src/engine/briefing-assembler.ts:121-128` — the parallel `Promise.all` block where a new `assembleAutonomousDigest(lastActiveAt)` joins
3. `src/engine/harness-handlers/trust-gate.ts:49-150` — trust tier logic and what "auto-advanced" means per tier
4. `packages/core/src/db/schema.ts:263-310` — `processRuns` columns; especially `status`, `startedAt`, `completedAt`, `totalCostCents`
5. `packages/core/src/db/schema.ts:312-348` — `stepRuns` columns; `status`, `confidenceLevel`, `completedAt`
6. `src/engine/self-tools/get-briefing.ts` — consumer that turns `BriefingData` into Self context; `autonomousDigest` needs rendering there
7. `src/engine/self-tools/network-tools.ts` (`handleNetworkStatus`) — existing "outreach results" aggregation; mine for table-building patterns
8. Brief 146 interaction outcome classifier — autonomous outreach with positive replies is high-signal digest material
9. `docs/meta-process-roadmap.md` — MP-3 and MP-5 sections for scope

## Constraints

- Query cost: the digest must not scan the entire step_runs table on every briefing. Bound by `lastActiveAt` + index (or add one if missing on `completedAt`)
- Per-process limits: cap at top 10 processes by activity count; anything beyond rolls up as "plus N more processes"
- Empty state truth: if nothing auto-advanced, the digest says so plainly. Do NOT hallucinate importance (briefing-freshness principle already in MP-3.3)
- Ordered by value, not volume: a process with 3 runs that produced 1 reply beats a process with 40 runs that produced 0 anything
- Privacy: counterparty handles (emails, names) appear only in workspace context, not in exported logs; reuse redaction patterns from the credential-vault scrubber for any external-surface rendering
- Narration layer (Self): the assembler produces structured data; the Self writes the warm language per Insight-073 ("never say 'risk'" / never say "autonomous" coldly)

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| "While you were away" digest format | Slack's "recap since `<time>`" and GitHub Mobile's catch-up view | pattern | User-tested framing for async catch-up |
| Per-process rollup aggregation | Existing `network_status` outreach summary in `handleNetworkStatus` | adopt | Same codebase — already aggregates interactions per user/person |
| Narrative framing | Insight-073 (briefing language stays operational, not alarming) | adopt | Guidance exists; apply to digest copy |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/briefing-assembler.ts` | Modify: new `assembleAutonomousDigest(lastActiveAt: Date \| null)` that returns `AutonomousDigest`. Joins `step_runs` (status=approved, autoAdvanced) with `processRuns` for process names since `lastActiveAt`. Groups by processId; per-group returns `{ processName, autoAdvancedCount, totalCostCents, notableOutcomes: string[] }`. Notable outcomes include things like "3 replies received" (requires join on `interactions` filtered by `outcome=positive`). Cap top 10 by activity |
| `src/engine/briefing-assembler.ts` (BriefingData type) | Modify: add optional `autonomousDigest?: AutonomousDigest` to the return shape |
| `src/engine/briefing-assembler.ts:121-128` | Modify: add `assembleAutonomousDigest(lastActiveAt)` to the `Promise.all` array |
| `src/engine/self-tools/get-briefing.ts` | Modify: include the digest in the Self-facing rendered context — compact format (1-2 lines per process, bullet list) |
| `packages/core/src/db/schema.ts` (migrations) | Verify: index on `(processId, completedAt)` on `stepRuns` exists; if not, add a migration |
| `src/engine/briefing-assembler.test.ts` | Modify: new tests — digest returns summary when auto-advanced runs exist, empty state when none, cap at 10 processes, ordering by value |
| `cognitive/self.md` | Modify: briefing section includes guidance on narrating the digest — warm, concrete, does not pressure for review. Example: "While you were away yesterday: 8 outreach emails sent on your sales cycle (2 replies back — Sarah and Deepak both interested), 3 quotes auto-generated and sent, 1 invoice drafted" |

## User Experience

- **Jobs affected:** Orient (catch up on autonomous work), Review (spot things that slipped through), Decide (trust upgrade confidence)
- **Primitives involved:** Briefing narrative, optional "Handled automatically" collapsible in process detail (out of scope for this brief; follows from MP-5.3)
- **Process-owner perspective:**
  - Return after 2 days away → briefing opens with "Welcome back. Here's what's needed from you today: ...". Then: "While you were away: your quoting process handled 12 quotes (autonomous tier, all under $2k). Your sales outreach sent 8 emails — Sarah and Deepak replied and are interested. Your invoice process paused once for review (it's in your attention list)."
- **Interaction states:**
  - Digest with data: compact summary, warm tone
  - Digest empty (no auto-advances in window): briefing skips the section entirely (no filler text)
  - Digest with positive outcomes: outcomes lead the summary ("Sarah replied") before raw counts
  - Very large window (user away 2 weeks): rolled up further — by week, not per process
- **Designer input:** Copy decisions belong in `cognitive/self.md`; visual surface (if any) is a follow-up. For this brief: data only, Self narrates

## Acceptance Criteria

1. [ ] `assembleAutonomousDigest(lastActiveAt)` added to `briefing-assembler.ts`
2. [ ] `BriefingData.autonomousDigest` type defined and populated
3. [ ] Digest joins `stepRuns` + `processRuns` + `interactions` to compute `notableOutcomes` per process
4. [ ] Results capped at top 10 processes by `autoAdvancedCount` with a "plus N more" suffix beyond 10
5. [ ] Results ordered by signal value (positive outcomes first, then raw counts) — not purely by volume
6. [ ] When `lastActiveAt` is null (first-ever session), digest returns empty — no full-table scan
7. [ ] When no auto-advanced runs exist in the window, digest returns empty and the briefing skips the section (no "nothing to report" filler)
8. [ ] `get_briefing` renders digest content in the Self context within ~200 tokens for typical users (budget respected)
9. [ ] `cognitive/self.md` includes narration guidance — warm, concrete, outcomes-led, no pressure for review
10. [ ] Index on `(processId, completedAt)` on `stepRuns` confirmed or added via migration; digest query uses it
11. [ ] PII: counterparty names in `notableOutcomes` are rendered only in authenticated workspace context (not exported logs)
12. [ ] Unit test: digest returns expected rollup when seeded with approved autoAdvanced step_runs across multiple processes
13. [ ] Unit test: empty state (no auto-advances in window) returns empty digest
14. [ ] Unit test: ordering prioritises a process with 1 positive outcome over one with 10 advances and 0 outcomes
15. [ ] Unit test: cap at 10 processes works, rollup suffix included
16. [ ] Unit test: narrows to `lastActiveAt` window, does not include earlier runs
17. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) query cost — uses the index and window bound, no full-table scan, (b) privacy on counterparty rendering, (c) empty-state truth telling, (d) ordering by value not volume, (e) narration guidance doesn't use anxious language
3. Present work + review findings to human for approval

## Smoke Test

```bash
pnpm run type-check
pnpm vitest run src/engine/briefing-assembler.test.ts

# Manual trace:
# Seed a process with trust tier autonomous.
# Simulate several auto-advanced step_runs over the last 24h with various outcomes.
# Suspend the current session, wait, then call get_briefing.
# Confirm the digest renders with accurate counts and leads with positive outcomes.
```

## After Completion

1. Update `docs/state.md` with MP-3.1 complete
2. Update `docs/meta-process-roadmap.md` — mark MP-3.1 done; MP-5.3 "handled automatically" section in process detail becomes an easy follow-up because the aggregator exists
3. Insight candidate: "The quiet work is the work" — surfacing autonomous activity is a feature, not noise. If user response is positive, fold into architecture principles
