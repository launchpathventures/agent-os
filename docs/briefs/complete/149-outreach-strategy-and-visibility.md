# Brief 149: Outreach Strategy Layer — Plan Before Execute, Visibility During

**Date:** 2026-04-14
**Status:** draft
**Depends on:** Brief 118 (Operating Cycle Self-Tools), Brief 116 (Cycle Shared Infrastructure), Brief 144 (Email Voice + Quality Gate)
**Unlocks:** User trust in outreach at scale, outreach-to-conversion analytics, campaign-level pause/adjust

## Goal

- **Roadmap phase:** Phase 9: Network Agent Continuous Operation
- **Capabilities:** Outreach strategy planning, execution visibility, volume governance

## Context

Alex sends hundreds of outreach messages but the user has no visibility into:
- **WHO** was targeted and why
- **WHAT** was sent to each person
- **HOW EFFECTIVE** the outreach has been (response rates, positive vs ignored)
- **WHAT HAPPENS NEXT** — is Alex going to send 50 more? 500?

The current architecture jumps from "user says go" to "Alex is executing at scale" with nothing in between. The BRIEF phase at cycle end is the only touchpoint — by which point 200+ emails have already gone out. The user's first-run experience is an inbox full of "Your Ditto update — 186 outreach messages sent" incrementing every 5 minutes.

**The core UX failure:** Alex behaves like an autonomous BDR with no reporting obligation. A real EA would never send 200 emails without first saying "here's who I'm planning to contact, here's my approach, and here's the budget. Want me to go ahead?"

**What a great EA actually does:**
1. "I've researched 15 people who fit what you described. Here are the top 5 — want me to reach out?"
2. "I sent 5 introductions this week. 2 replied positively, 1 opted out. Here's what each said."
3. "Based on results, I think we should try a different angle with the financial advisors. The accounting firms are responding better."
4. "I'd like to expand to 10 per week. The current 5 are converting well. OK?"

This brief adds three capabilities: a **strategy sub-process** between ASSESS and ACT, **volume governance** that scales with results, and **dual-surface execution visibility** (HTML tables in email, InteractiveTableBlocks in workspace).

## Objective

Before Alex sends any outreach, the user sees a concrete plan: who, why, what angle, how many. During execution, the user gets visibility into results via both email and workspace. After each batch, Alex proposes adjustments based on what worked. Volume scales up with demonstrated results, not all at once. Strategy conversations work identically via email reply or workspace chat.

## Non-Goals

- Redesigning the operating cycle archetype (SENSE->ASSESS->ACT->GATE->LAND->LEARN->BRIEF stays)
- Building a full CRM dashboard (workspace UI is a separate concern)
- Changing how broadcast content (posts, articles) works (already supervised via Insight-167)
- Rebuilding the quality gate or trust tier system
- Email template redesign (Brief 144 handles voice quality)
- New DB tables or objects (Insight-179: plan is a process instance, not a new object)
- Changes to `packages/core/` (all changes are Ditto product layer — outreach tables, cycle config, status composition)

## Inputs

1. `processes/cycles/sales-marketing.yaml` — current sales cycle definition
2. `processes/cycles/network-connecting.yaml` — current connection cycle definition
3. `processes/templates/selling-outreach.yaml` — current outreach sub-process (has research-prospects step but no user approval before execution)
4. `processes/templates/connecting-research.yaml` — current connection research sub-process (already has human selection step — pattern to extend)
5. `src/engine/self-tools/cycle-tools.ts` — cycle activation and management
6. `src/engine/self-tools/network-tools.ts` — network status
7. `src/engine/status-composer.ts` — status email composition (Brief 144)
8. `src/engine/channel.ts` — `textToHtml()` for email rendering
9. `packages/core/src/content-blocks.ts` — `InteractiveTableBlock` type definition
10. `docs/insights/168-operating-cycle-archetype.md` — seven-phase cycle pattern
11. `docs/insights/167-broadcast-supervised-direct-autonomous.md` — trust split by audience size
12. `docs/insights/166-connection-first-commerce-follows.md` — three litmus tests
13. `docs/insights/179-plan-is-process-instance-not-object.md` — no new DB objects for plans
14. `docs/adrs/027-cognitive-orchestration.md` — thin processes, smart Self

## Constraints

- The operating cycle archetype stays. This brief adds a **strategy step** between ASSESS and ACT in the cycle YAMLs, and enriches the LEARN->BRIEF output. No new phases.
- Existing trust tier system stays. Strategy approval uses the existing GATE mechanism (human step with `trustOverride: supervised`), not a new approval flow.
- Connection cycles already have a human selection step (`connecting-research.yaml` `present-candidates`). This brief formalizes and extends that pattern to sales cycles.
- Must not break existing cycle activation, pause, resume flows.
- Volume governance is stored as `cycleConfig.volumeBudget` (Insight-179: process instance config, not a new table).
- All rendering uses existing ContentBlock types. No new block types. No new React components.
- Side-effecting functions (outreach sends) already have stepRunId guards via `sendAndRecord`. No new side effects introduced — this brief adds planning and visibility, not new send paths.
- The HTML table renderer must use inline styles only (no external CSS) for email client compatibility. Must degrade gracefully in plain-text-only email clients.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Strategy approval before execution | `connecting-research.yaml` `present-candidates` human step | pattern | Already proves the plan-then-execute pattern for connections. Extend to sales. |
| Volume ladder / graduated scaling | SaaS trial-to-paid conversion pattern | pattern | Start small, prove value, scale with results. Standard product-led growth. |
| HTML table in email | Stripe receipt emails, Linear digest emails | pattern | Inline-styled HTML tables that render across email clients. Well-proven pattern. |
| InteractiveTableBlock for workspace | `packages/core/src/content-blocks.ts` existing type | depend | Already built, already rendered, already has per-row actions and batch operations. |
| Dual-surface rendering from shared data | `composition-engine.ts` pattern (same data, different composition per intent) | pattern | Composition layer decides format based on surface. Proven in Briefs 073/140. |
| Conversational iteration via Self | ADR-027 (cognitive orchestration) + Brief 131 (Self as orchestrator) | pattern | Self handles multi-turn conversation, decides when strategy is approved, feeds result into process. |
| Cycle config for volume budget | Insight-179 (plan = process instance, not object) | pattern | volumeBudget is cycleConfig, not a new table. |

## Design Principles

### 1. Plan is a conversation, not a form

Alex presents the strategy conversationally: "I've found 12 people who match what you described. Here are the 5 strongest fits — Sarah Chen runs a practice that looks a lot like what you're targeting. Want me to start with these 5, or should I adjust?"

The user responds — via email reply OR workspace chat — and Alex iterates. Both surfaces route through `selfConverse()` with the same tools. The strategy step stays in `waiting_human` state during iteration. Each user reply triggers a Self response with the revised strategy. When the user approves ("go ahead", "looks good"), the step resumes with the approved target list and the cycle advances to ACT.

**Mechanism:** The strategy step is a `human` executor step in the cycle YAML. The step output is presented via `notifyUser()` (which routes to email or workspace SSE). User replies (inbound email or workspace chat) go through `selfConverse()`. Self uses `approve_review` to advance, or responds with a revision (keeping the step in `waiting_human`). This is the same mechanism as `connecting-research.yaml`'s `present-candidates` step.

### 2. Start small, prove it works, then scale

Volume scales with demonstrated effectiveness, not time. Stored as `cycleConfig.volumeBudget`.

**Volume ladder (defaults, user-overridable):**
- Cycle 1: max 5 outreach (prove targeting works)
- Cycle 2: max 10 (if previous cycle had >0 positive responses)
- Cycle 3+: max 20 (if cumulative response rate >10%)
- User can override at any time via conversation ("go faster" / "slow down")

**Mechanism:** The LEARN step computes response metrics from interaction records. The cycle's `learnOutputs` (auto-restart with learning, Brief 118) carry the metrics to the next cycle's ASSESS step. ASSESS reads previous metrics + volume ladder to determine the next batch size.

### 3. Results drive the next plan

After each batch, the BRIEF step includes a results table and Alex's recommendation for the next batch. The user can reply with adjustments. Same conversational iteration pattern as strategy approval.

### 4. Same data, two surfaces

The outreach results table renders from a single `OutreachBatchSummary` data structure:

**In email:** Inline-styled HTML table. Ditto theme: system font stack, 560px max-width, alternating #f9f9f9 rows, colour-coded status pills (green=Interested, grey=Sent/Pending, amber=Replied, red=Opted Out). Plain-text fallback for text-only clients.

**In workspace:** `InteractiveTableBlock` with per-row actions (view conversation thread, skip follow-up, mark as priority). Same data, richer interaction.

**Mechanism:** `src/engine/outreach-table.ts` exports `OutreachBatchSummary`, `renderOutreachTableHtml()`, and `buildOutreachTableBlock()`. Status-composer uses the HTML version. Self tools / compositions use the block version. `textToHtml()` detects pre-rendered `<table>` elements and passes them through without escaping.

## What Changes (Work Products)

| File | Action |
|------|--------|
| `processes/templates/outreach-strategy.yaml` | **Create**: Strategy sub-process. Thin template (ADR-027): 2 steps — (1) `research-and-propose` (ai-agent: research prospects, build target list with rationale) and (2) `user-approval` (human: present list, iterate until approved). Inputs: ICP, goals, volumeBudget, previousResults. Output: approvedTargets list. |
| `processes/cycles/sales-marketing.yaml` | **Modify**: Add `strategy` step (sub-process: outreach-strategy) between `assess` and `act`. `act` step receives `approvedTargets` from strategy output. LEARN step outputs response metrics for next cycle. |
| `processes/cycles/network-connecting.yaml` | **Modify**: Formalize existing connecting-research pattern — add explicit volume budget input, wire LEARN output metrics to next cycle. |
| `src/engine/outreach-table.ts` | **Create**: `OutreachBatchSummary` interface + two renderers. `renderOutreachTableHtml(summary)` → inline-styled HTML table. `buildOutreachTableBlock(summary)` → `InteractiveTableBlock`. `gatherOutreachBatchSummary(userId, since)` → queries interactions to build summary. |
| `src/engine/channel.ts` | **Modify**: No changes to `textToHtml()` (keeps it pure — always escapes). Instead, `formatEmailBody()` gains an optional `htmlBlocks` parameter for pre-rendered HTML (tables, charts) that gets spliced into the email template after the text body, outside the `textToHtml()` pipeline. |
| `src/engine/status-composer.ts` | **Modify**: `composeStatusEmail()` includes HTML outreach results table when outreach activity exists. Table is structured data from `gatherOutreachBatchSummary()`, not LLM-generated. LLM writes narrative around the table. |
| `src/engine/self-tools/cycle-tools.ts` | **Modify**: `activate_cycle` accepts `volumeBudget` in cycleConfig. `cycle_status` shows volume tier, batch size, and response metrics. Default volume ladder applied when `volumeBudget` not specified. |
| `src/engine/self-tools/network-tools.ts` | **Modify**: `network_status` enriched — returns `InteractiveTableBlock` with per-person outreach results when in workspace surface, structured data for email surface. |

## User Experience

- **Jobs affected:** Orient (understand what Alex is doing and why), Review (approve strategy before execution), Decide (volume and targeting adjustments)
- **Primitives involved:** InteractiveTableBlock (strategy proposal + results in workspace), HTML table (strategy proposal + results in email)
- **Process-owner perspective:** Before Alex sends anything, the user sees "here are the 5 people I'd contact and why" — as a table in the workspace or an HTML table in email. The user replies with adjustments ("drop person 3, focus on accountants"). Alex confirms understanding and re-presents the revised list. Only after "go ahead" does outreach begin. After each batch, the user sees a results table (who replied, who's interested) and Alex's recommendation for the next batch. Same iteration pattern. The user feels in control — Alex is competent but accountable.
- **Interaction states:** Strategy proposal (iterating via conversation), Strategy approved (outreach executing), Batch complete (results + adjustment proposal, iterating), Volume override (user adjusts pace), Cycle paused (user-initiated)
- **Surface parity:** Email users get inline HTML tables with status pills. Workspace users get InteractiveTableBlocks with per-row actions. Both adjust strategy conversationally — email replies and workspace chat both route through `selfConverse()` with the same tools. A user can start in workspace and switch to email mid-conversation.
- **Designer input:** Not invoked. Email table uses Ditto's existing `textToHtml()` theme (system font stack, 560px max-width, #1a1a1a text, 15px/1.6, #f9f9f9 alternating rows). Workspace uses existing InteractiveTableBlock renderer.

## Acceptance Criteria

### Sub-brief A: Strategy Sub-Process + Conversational Iteration

1. [ ] `outreach-strategy.yaml` exists as a callable sub-process with 2 steps (research-and-propose, user-approval)
2. [ ] Strategy takes ICP, goals, volumeBudget, and previousResults as inputs
3. [ ] Strategy outputs approvedTargets: array of { name, company, fitRationale, proposedAngle }
4. [ ] `user-approval` step uses `executor: human` — process pauses in `waiting_human`
5. [ ] Strategy presented to user via `notifyUser()` (routes to email HTML table or workspace InteractiveTableBlock)
6. [ ] User reply (email or workspace) triggers `selfConverse()` — Self can revise and re-present (step stays `waiting_human`) or approve (step resumes)
7. [ ] Zero outreach sent before user explicitly approves the strategy
8. [ ] `sales-marketing.yaml` has new `strategy` step between `assess` and `act` that spawns `outreach-strategy`

### Sub-brief B: Volume Governance + Results Feedback

9. [ ] `cycleConfig.volumeBudget` accepted by `activate_cycle` — stored on processRun, no new tables
10. [ ] Default volume ladder: cycle 1->5, cycle 2->10 (if previous had positive responses), cycle 3+->20 (if response rate >10%)
11. [ ] Volume does NOT scale when previous cycle had 0 positive responses
12. [ ] User can override volume via conversation ("go faster" / "slow down") on both surfaces
13. [ ] `cycle_status` shows: current volume tier, batch size, response rate, positive count
14. [ ] LEARN step computes response metrics from interactions and passes to next cycle via `learnOutputs`

### Sub-brief C: Outreach Table Renderers (Dual Surface)

15. [ ] `OutreachBatchSummary` interface: array of { personName, company, status, sentAt, replySnippet? }
16. [ ] `renderOutreachTableHtml()`: inline-styled HTML table — Ditto font stack, 560px max, alternating rows, status pills (green/grey/amber/red), plain-text fallback
17. [ ] `buildOutreachTableBlock()`: `InteractiveTableBlock` with columns (Name, Company, Status, Date) and per-row actions (view thread, skip follow-up)
18. [ ] `formatEmailBody()` accepts optional `htmlBlocks` parameter — pre-rendered HTML spliced after text body, outside `textToHtml()` pipeline (keeps textToHtml pure)
19. [ ] Status email includes HTML results table when outreach activity exists in the period
20. [ ] `network_status` returns InteractiveTableBlock with outreach results in workspace context

## Build Order

1. **Sub-brief C** (Outreach Table Renderers) — pure data + rendering, no process changes, independently testable
2. **Sub-brief A** (Strategy Sub-Process) — core mechanism, depends on C for presentation
3. **Sub-brief B** (Volume Governance) — layer on top of A's cycle changes
4. Wire into status-composer and network_status (AC19-20, part of C)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - Strategy sub-process follows existing sub-process patterns (Brief 117, ADR-027)
   - Volume governance stored as cycleConfig (Insight-179), no new tables
   - Cycle YAML changes don't break existing activation/pause/resume
   - Status email changes build on Brief 144 composition (not parallel path)
   - Trust tiers respected: strategy approval uses existing human step mechanism
   - HTML table uses inline styles only, degrades to plain text
   - InteractiveTableBlock uses existing type definition, no core changes
   - No new side-effecting functions (Insight-180 check)
   - Dual-surface parity: same data, different rendering
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Activate a sales cycle with default volume (workspace)
#    -> Strategy proposal appears as InteractiveTableBlock with 5 target people
#    -> No outreach sent before user approves
#    -> Reply "drop person 3, they're a competitor" -> Alex confirms and re-presents revised table
#    -> Reply "looks good" -> outreach begins, exactly 5 messages sent

# 2. Activate a sales cycle with default volume (email)
#    -> Strategy email contains HTML table with 5 target people, status pills render in Gmail
#    -> Reply "focus on accountants only" -> Alex reply includes revised HTML table
#    -> Reply "go ahead" -> outreach begins

# 3. After first batch completes
#    -> Status email includes HTML results table (name, company, status pill, date)
#    -> Workspace network_status shows InteractiveTableBlock with same data
#    -> Alex proposes next-batch adjustments conversationally
#    -> Reply with adjustment -> Alex iterates until approved

# 4. Volume governance
#    -> 0 positive responses in cycle 1: next strategy still proposes 5 people
#    -> 1+ positive responses: next strategy proposes 10
#    -> "slow down to 3 per batch" -> next batch sends exactly 3

# 5. Surface parity
#    -> Start in workspace, switch to email reply mid-strategy-conversation
#    -> Email reply adjusts the same strategy (Self has context)
```

## After Completion

1. Update `docs/state.md` — outreach strategy layer active, volume governance in place
2. Update `docs/roadmap.md` — mark outreach visibility as complete
3. Capture insight: "Outreach requires plan-approve-execute-learn, not execute-report"
4. Capture insight: "Volume scales with demonstrated results, not with time"
