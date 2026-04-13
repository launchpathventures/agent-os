# Brief: Growth Composition Intent

**Date:** 2026-04-13
**Status:** draft
**Depends on:** Brief 139 (GTM Cycle Type + Structured Inputs), Composition engine (6 intents — complete), Sidebar (complete), Block registry (complete)
**Unlocks:** Brief 141 (Structured GATE + Posting Queue — can build in parallel if 139 done)

## Goal

- **Roadmap phase:** Phase 14: Network Agent (GTM track)
- **Capabilities:** "Growth" sidebar destination, plan dashboard composed from existing blocks, growth context assembly

## Context

The composition engine maps navigation intents to pure `CompositionContext → ContentBlock[]` functions. Six intents exist. The `CompositionContext` is assembled from React Query cache in `packages/web/lib/composition-context.ts` — synchronous reads from cached data, with lazy fetches for specialized data (e.g., `roadmap` data only fetched when `intent === "roadmap"`).

**Critical gap in parent brief's design:** `ActiveRunSummary` only carries `runId`, `processSlug`, `processName`, `currentStep`, `totalSteps`, `completedSteps`, `status`, `startedAt`. It does NOT carry `inputs` (where `gtmContext` lives), `cycleType`, `cycleConfig`, or step outputs. The `composeGrowth()` function needs all of these to render plan dashboards.

**Solution:** Follow the `roadmap` data pattern — add a `growthPlans` field to `CompositionContext` that is lazy-fetched when `intent === "growth"`. A new API endpoint assembles the richer data server-side.

## Objective

A "Growth" sidebar item appears in workspace navigation. Clicking it renders a dashboard showing all active GTM pipeline instances as growth plans — with plan names, goals, progress, cycle phase, experiments, and posting queue — all composed from existing block types.

## Non-Goals

- New React block components (use existing 24 block types)
- Structured GATE review enrichment (Brief 141)
- Posting queue surface actions (Brief 141)
- Step output parsing logic for experiments (Brief 141 provides the data; this brief renders what's available)

## Inputs

1. `packages/web/lib/compositions/types.ts` — CompositionIntent and CompositionContext types
2. `packages/web/lib/compositions/index.ts` — Composition registry
3. `packages/web/lib/composition-context.ts` — Context assembly hook (lazy fetch pattern)
4. `packages/web/lib/compositions/routines.ts` — Reference pattern for a composition function
5. `packages/web/components/layout/sidebar.tsx` — Nav item definitions
6. `packages/web/lib/composition-empty-states.ts` — Empty state patterns
7. `packages/web/lib/compositions/utils.ts` — Shared composition utilities

## Constraints

- Composition functions are pure and synchronous — no DB queries inside them
- Data must be assembled server-side and fetched into React Query cache
- Use ONLY existing block types: metric, status_card, text, record, data, checklist, suggestion, chart
- Review cards for GTM plans come through the existing `pendingReviews` field (feed assembler) — this brief doesn't change how they're built, just filters them into the growth view
- "Growth" intent is lazy — growth plan data only fetched when the intent is active (same as roadmap)
- Empty state must suggest creating a plan via conversation

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Composition intent pattern | `packages/web/lib/compositions/routines.ts` | adopt | Proven composition function pattern |
| Lazy data fetch | `packages/web/lib/composition-context.ts` roadmap pattern | adopt | Lazy fetch when intent active |
| Empty state pattern | `packages/web/lib/composition-empty-states.ts` | adopt | Existing empty state block functions |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/web/lib/compositions/types.ts` | Modify: Add `"growth"` to `CompositionIntent` union. Add `GrowthPlanSummary` interface and `growthPlans?: GrowthPlanSummary[]` field to `CompositionContext`. |
| `packages/web/lib/compositions/growth.ts` | Create: `composeGrowth(context)` composition function. Renders plan header (metric), cycle phase (status_card), experiments (data table), published content status (checklist with post links), asset recommendations (record), last brief (text). |
| `packages/web/lib/compositions/index.ts` | Modify: Import and register `composeGrowth` in `COMPOSITION_FUNCTIONS`. Export it. |
| `packages/web/lib/composition-context.ts` | Modify: Add `fetchGrowthPlans()` query (lazy, enabled when `intent === "growth"`). Add `growthPlans` to context. |
| `packages/web/lib/composition-empty-states.ts` | Modify: Add `emptyGrowth()` function returning suggestion block. |
| `packages/web/components/layout/sidebar.tsx` | Modify: Add `{ id: "growth", label: "Growth", Icon: IconTrendingUp }` to `MAIN_NAV`. Add `IconTrendingUp` SVG. Position after "projects", before "routines". |
| `packages/web/app/api/growth/route.ts` | Create: API route that queries active GTM pipeline runs with their inputs, current step, step outputs, and cycle metadata. Returns `GrowthPlanSummary[]`. |

## User Experience

- **Jobs affected:** Orient (what's my growth status?), Review (pending experiments at GATE)
- **Primitives involved:** Navigation (sidebar), Canvas (composition blocks)
- **Process-owner perspective:** User clicks "Growth" in sidebar. Sees all their growth plans as dashboard sections — each with a progress metric, current cycle phase, any pending reviews, and last cycle brief. If no plans exist, sees a suggestion to create one.
- **Interaction states:**
  - **Empty:** Suggestion block — "No growth plans yet. Tell me about an audience you want to reach."
  - **Loading:** Standard skeleton state (composition context returns empty arrays on cold cache)
  - **Active plans:** Metric + status_card + data table + published content checklist per plan
  - **Error:** Fallback composition (existing pattern in `compose()`)
- **Designer input:** Not invoked — follows existing composition patterns exactly

## Acceptance Criteria

1. [ ] `CompositionIntent` union includes `"growth"`
2. [ ] `GrowthPlanSummary` interface defined with: `planName`, `runId`, `processSlug`, `status`, `currentStep`, `cycleNumber`, `startedAt`, `gtmContext` (audience, channels, goals), `experiments` (from step outputs), `publishedContent` (posts with platform, postId, postUrl, publishedAt), `lastBrief` (most recent BRIEF step output)
3. [ ] `CompositionContext.growthPlans` field exists (optional, lazy-loaded)
4. [ ] `fetchGrowthPlans()` queries only when `intent === "growth"`
5. [ ] `/api/growth` endpoint returns `GrowthPlanSummary[]` from active GTM pipeline runs
6. [ ] `composeGrowth()` renders metric block per plan (plan name, follower count if available, cycle number)
7. [ ] `composeGrowth()` renders status_card per plan (current cycle step name)
8. [ ] `composeGrowth()` renders experiments as data table block (track, description, verdict)
9. [ ] `composeGrowth()` renders pending reviews from `context.pendingReviews` filtered to GTM pipeline runs
10. [ ] `composeGrowth()` returns empty state suggestion block when no GTM plans exist
11. [ ] "Growth" nav item appears in sidebar between "Projects" and "Routines"
12. [ ] Sidebar icon is a trending-up arrow (consistent with growth metaphor)
13. [ ] `pnpm run type-check` passes
14. [ ] All existing composition tests still pass

## Reference Docs

Reference docs checked: no drift found. ADR-024 (Composable Workspace Architecture) governs composition intents — this brief follows it exactly. No architecture.md update needed.

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Verify: no new block types in `packages/core/src/content-blocks.ts`
3. Verify: composition function is pure and synchronous
4. Verify: lazy fetch pattern matches roadmap implementation exactly
5. Verify: sidebar order makes sense (Today → Inbox → Work → Projects → Growth → Routines → Roadmap)

## Smoke Test

```bash
# Type-check
pnpm run type-check

# Verify composition function compiles
pnpm vitest run packages/web --passWithNoTests

# Start dev server and verify sidebar renders
pnpm dev
# Navigate to Growth — should show empty state with suggestion
```

## After Completion

1. Update `docs/state.md` with growth composition intent
2. Brief 141 (Structured GATE + Posting Queue) can now integrate its surface actions into the growth view
