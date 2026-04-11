# Brief 115: Operating Cycle Archetype — Restructure Alex's Capabilities Around Coarse Judgment-Driven Cycles (Parent Brief)

**Date:** 2026-04-09
**Status:** draft
**Depends on:** Brief 114 (cognitive mode extensions)
**Unlocks:** All future Alex capabilities (hiring, project management, finance, etc.) can be stamped out as cycle instances

> **This is a parent brief (design reference).** It is too large for one build cycle (15 ACs, 5+ subsystems). It has been split into three sub-briefs along dependency seams. Build in order:
>
> 1. **Brief 116** — [Shared Infrastructure](116-operating-cycle-shared-infrastructure.md): 4 harness handlers, schema extensions, trust gate step-category overrides, HarnessContext enrichments
> 2. **Brief 117** — [Cycle Definitions + Process Reorganisation](117-operating-cycle-definitions-and-process-reorg.md): 3 cycle YAMLs, sub-process invocation, 25 templates reorganised
> 3. **Brief 118** — [Self-Tools & Front Door](118-operating-cycle-self-tools-and-front-door.md): 5 cycle tools, network tools rethink, scheduler dual triggers, front door continuous framing
>
> Each sub-brief is independently testable and shippable. This parent brief remains as the coherent design reference.

## Goal

- **Roadmap phase:** Phase 3: Network Agent & Continuous Operation
- **Capabilities:** Alex operating autonomously across sales, connecting, and nurture modes with earned trust, structural quality gates, and cycle-aware scheduling

## Context

Brainstorming Alex's connector and sales/marketing modes revealed a fundamental insight: every Alex capability follows the same structural pattern — an **Operating Cycle** with coarse, judgment-heavy steps, harness-enforced quality gates, and step-category trust graduation (Insight-168).

The current implementation has 25 granular process templates that over-specify individual tasks (e.g., 15-step YAML for drafting one introduction email). This removes the judgment that makes Alex valuable. But removing processes entirely breaks the architecture — trust has nothing to attach to, the harness can't enforce quality gates, and auditability disappears.

The resolution: **coarse processes with judgment-heavy steps.** Processes provide cadence, auditability, trust graduation, and quality gates. Alex's cognitive engine provides the judgment within each step. Neither is sufficient alone.

Stress-testing this approach against the existing six-layer architecture confirmed it works without structural changes — the harness pipeline, trust system, process loader, heartbeat, chaining, and memory system all support this model. The work is reorganization and extension, not rebuilding.

Three additional insights emerged during this design:
- **Insight-166:** Connection first, commerce follows — Alex always optimises for connection quality, even when commercial intent exists
- **Insight-167:** Broadcast is supervised, direct is autonomous — trust model splits by audience size, not uniformly
- **Insight-169:** Alex's full capability surface is concurrent operating cycles sharing infrastructure

## Objective

Restructure Alex's process architecture around three core Operating Cycles (Sales & Marketing, Network Connecting, Relationship Nurture), add the shared infrastructure handlers, and consolidate the 25 existing process templates into a two-tier model (cycles + sub-processes). The result: Alex can operate continuously on a user's business with earned trust, structural quality enforcement, and minimal configuration.

## Non-Goals

- Building all future cycles (hiring, finance, project management) — those are future briefs that instantiate this archetype
- Implementing specific channel integrations (LinkedIn API, email provider) — this brief handles the harness infrastructure, not the integration adapters
- Voice calibration training — the memory type and handler are created, but training the voice model from user data is a separate effort
- UI/dashboard for cycle management — cycles are activated and configured conversationally through Self
- Full implementation of the metacognitive check handler — placeholder upgraded with mode-specific checks, but deep implementation follows Brief 114

## Inputs

1. `docs/insights/168-operating-cycle-archetype.md` — the archetype definition (7 structural components)
2. `docs/insights/169-alex-capability-surface-as-concurrent-cycles.md` — capability map and cross-cycle interactions
3. `docs/insights/166-connection-first-commerce-follows.md` — three litmus tests, three sending identities
4. `docs/insights/167-broadcast-supervised-direct-autonomous.md` — trust model split by audience size
5. `docs/insights/165-cognitive-mode-extensions-not-persona-switching.md` — mode extensions are judgment calibration, not persona switching
6. `docs/architecture.md` — six-layer spec, process primitive, harness pipeline
7. `packages/core/src/harness/harness.ts` — current harness pipeline and context interface
8. `packages/core/src/harness/handlers/trust-gate.ts` — current trust gate implementation
9. `packages/core/src/db/schema.ts` — current database schema
10. `src/engine/heartbeat.ts` — current heartbeat/execution engine
11. `src/engine/self-tools/network-tools.ts` — current network tools (to be rethought)
12. `src/engine/network-chat-prompt.ts` — front door prompt (to be updated)
13. `processes/templates/` — all 25 existing process templates (to be reorganised)
14. `cognitive/modes/` — mode extensions (from Brief 114, dependency)

## Constraints

- **No architectural rebuilds.** The harness pipeline, trust system, process loader, heartbeat, and memory system are structurally sound. Extend, don't replace.
- **Existing process templates are not deleted.** They're reorganised into sub-processes callable by cycle steps. Nothing is lost.
- **House values are invariant.** The outbound quality gate handler enforces them structurally — they can never be softened by trust graduation or user configuration.
- **Core package rules apply.** New harness handlers go in `packages/core/`. No Ditto-specific opinions (Self, personas, network) in core. The handlers are generic; the cycle definitions are product-layer.
- **Token budget matters.** Cycle definitions loaded into context must be concise. The archetype phases (SENSE → ASSESS → ACT → GATE → LAND → LEARN → BRIEF) are structural labels, not verbose prompts.
- **Type-check must pass.** `pnpm run type-check` at root after all changes.
- **Sub-process invocation must use existing harness.** A cycle step that invokes a sub-process runs it through the same harness pipeline. No special-case execution paths.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Operating Cycle pattern | Ditto brainstorm session (Insights 166-169) | pattern | Original to Ditto — emerged from stress-testing judgment-driven operation against process-primitive architecture |
| Chain-of-responsibility pipeline | Sim Studio (simstudio) | adopt | Already adopted in harness.ts — extending with new handlers follows established pattern |
| Step-category trust | Ditto architecture | pattern | Extension of existing trust tier model — same mechanics, finer granularity |
| BDR/SDR operating model | Sales operations practice | pattern | Real-world analogy: BDR works pipeline, escalates qualified leads to senior. Alex does the same. |
| Broadcast/direct split | Ditto Insight-167 | pattern | Original — no competitor distinguishes trust model by audience size |

## What Changes (Work Products)

### Phase 1: Shared Infrastructure (harness handlers + schema)

| File | Action |
|------|--------|
| `packages/core/src/harness/handlers/outbound-quality-gate.ts` | Create: structural enforcement of house values, volume limits, opt-outs, cross-user rate limits, posture verification. Non-bypassable handler. |
| `packages/core/src/harness/handlers/broadcast-direct-classifier.ts` | Create: deterministic classification of outbound actions by audience size. Forces critical trust on broadcast. |
| `packages/core/src/harness/handlers/identity-router.ts` | Create: maps mode + channel + relationship context to sending identity (alex-as-alex, alex-as-user, user-agent). |
| `packages/core/src/harness/handlers/voice-calibration.ts` | Create: loads user voice model from memories for ghost mode steps. Extension of memory assembly pattern. |
| `packages/core/src/harness/handlers/trust-gate.ts` | Modify: add step-category trust override support. Check step definition for override before falling back to process-level tier. |
| `src/engine/harness-handlers/metacognitive-check.ts` | Modify: upgrade placeholder with mode-specific check hooks. Load checks from cognitive mode extension. (Product layer — not core.) |
| `packages/core/src/db/schema.ts` | Modify: add `cycleType`, `cycleConfig`, `parentCycleRunId` to processRuns. Add `voice_model` to MemoryType union. Add `stepCategory` to trustSuggestions. Create `outboundActions` table. |
| `packages/core/src/harness/harness.ts` | Modify: register new handlers in pipeline. Update HarnessContext with identity, voice model, broadcast/direct classification fields. |

### Phase 2: Core Operating Cycles (3 cycle definitions)

| File | Action |
|------|--------|
| `processes/cycles/sales-marketing.yaml` | Create: Sales & Marketing Operating Cycle — SENSE (pipeline review) → ASSESS (inbound processing) → ACT (outreach + conversations) → GATE (quality check) → LAND (send/publish) → LEARN (retrospective) → BRIEF (user digest). |
| `processes/cycles/network-connecting.yaml` | Create: Network Connection Cycle — SENSE (scan + match) → ASSESS (evaluate fit, three litmus tests) → ACT (draft introductions) → GATE (quality gate, critical) → LAND (send introductions) → LEARN (outcome tracking) → BRIEF (connection report). |
| `processes/cycles/relationship-nurture.yaml` | Create: Relationship Nurture Cycle — SENSE (relationship scan) → ASSESS (value-add opportunities) → ACT (nurture execution) → GATE (silence > noise check) → LAND (send touches) → LEARN (reciprocity check) → BRIEF (relationship health). |

### Phase 3: Process Reorganisation (existing templates → sub-processes)

| File | Action |
|------|--------|
| `processes/templates/*.yaml` (25 files) | Modify: add `callable_as: sub-process` metadata. Ensure inputs/outputs are compatible with parent cycle invocation. Adjust trust tiers to inherit from parent cycle's step-category trust. |
| `processes/cycles/README.md` | Create: documents the two-tier model (cycles + sub-processes), the archetype phases, and the mapping of which sub-processes belong to which cycle phases. |
| `src/engine/process-loader.ts` | Modify: support parent-child process invocation. A cycle step with `executor: sub-process` and `config.process_id` invokes a sub-process through the harness. |

### Phase 4: Self-Tools & Front Door Updates

| File | Action |
|------|--------|
| `src/engine/self-tools/cycle-tools.ts` | Create: `activate_cycle` (start cycle with config), `pause_cycle`, `resume_cycle`, `cycle_briefing` (standardised handoff format), `cycle_status` (per-cycle pipeline view). |
| `src/engine/self-tools/network-tools.ts` | Modify: rethink `create_sales_plan` and `create_connection_plan` to configure/activate cycles instead of triggering one-time processes. `network_status` becomes cycle-aware. |
| `src/engine/self-delegation.ts` | Modify: register new cycle tools in the delegation system. |
| `src/engine/network-chat-prompt.ts` | Modify: update conversation stages to frame cycle activation ("I'll set up a continuous sales operation") not one-time campaigns ("I'll research your targets"). |
| `src/engine/scheduler.ts` | Modify: support multiple triggers per process (cron + event). A cycle can have a daily scheduled run AND event-triggered partial runs. |
| `src/engine/heartbeat.ts` | Modify: support sub-process invocation within a step (step executor dispatches to child process run through harness). Minor routing extension for cycle phase skipping via existing `route_to` mechanism. |

## User Experience

- **Jobs affected:** Delegate, Orient, Review
- **Primitives involved:** Process run, work item, briefing, review queue
- **Process-owner perspective:** The user says "help me fill my pipeline" or "start working on my sales." Alex asks a few configuration questions (ICP, targets, goals, channels, boundaries), then starts operating. The user receives daily briefings, approves broadcast content, and gets pulled in for qualified conversations. They never see YAML, process runs, or cycle phases. They see outcomes: "3 conversations active, 1 meeting booked, 2 follow-ups pending."
- **Interaction states:** N/A — no new UI surfaces. Cycles are activated and managed conversationally through Self. Outputs appear in existing review queue and briefing formats.
- **Designer input:** Not invoked — lightweight UX section only. The cycle infrastructure is invisible. User-facing experience uses existing conversation + briefing + review queue patterns.

## Acceptance Criteria

1. [ ] Three operating cycle definitions exist in `processes/cycles/` and load via process-loader without errors
2. [ ] Outbound quality gate handler blocks a message that violates house values (test: message with pitch language sent as Alex-as-Alex is rejected)
3. [ ] Broadcast/direct classifier correctly identifies a LinkedIn post as broadcast (→ critical trust) and a LinkedIn DM as direct (→ step-category trust)
4. [ ] Identity router selects alex-as-alex for a connection introduction and alex-as-user for a follow-up email
5. [ ] Trust gate respects step-category overrides — an autonomous step in a supervised process executes without pausing
6. [ ] A cycle step can invoke a sub-process (e.g., sales cycle ACT phase invokes selling-outreach.yaml as sub-process) and the sub-process runs through the full harness pipeline
7. [ ] `activate_cycle` self-tool creates and starts a cycle with user-provided configuration
8. [ ] `cycle_briefing` self-tool produces a standardised handoff briefing with context, summary, recommendations, and options
9. [ ] Existing 25 process templates still load and execute as standalone processes (backward compatible)
10. [ ] Cross-user rate limiting works: outbound quality gate blocks a message to a person who has received 3+ Alex messages in the last 30 days across any user
11. [ ] `pnpm run type-check` passes at root
12. [ ] All existing tests pass (no regressions)
13. [ ] Scheduler supports dual triggers: a cycle with both a daily cron and an event trigger fires correctly for both
14. [ ] Voice calibration handler loads voice model memories and injects them into step context for ghost mode steps
15. [ ] `outbound_actions` table records every external action with channel, identity, and recipient for audit trail

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md` + `docs/insights/168-operating-cycle-archetype.md`
2. Review agent checks:
   - Do the three cycle definitions follow the SENSE → ASSESS → ACT → GATE → LAND → LEARN → BRIEF archetype?
   - Are new harness handlers in `packages/core/` (no Ditto opinions in core)?
   - Does the outbound quality gate structurally enforce house values (code, not prompt)?
   - Is the broadcast/direct split deterministic (not judgment-based)?
   - Do step-category trust overrides compose correctly with process-level trust?
   - Is sub-process invocation through the harness (not a special-case path)?
   - Are the three sending identities clearly routed by the identity handler?
   - Does the schema extension maintain backward compatibility?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Type-check passes
pnpm run type-check

# 2. Cycle definitions load
pnpm run test -- --grep "cycle.*load"

# 3. Outbound quality gate blocks bad message
pnpm run test -- --grep "outbound.*quality.*gate"

# 4. Broadcast/direct classification
pnpm run test -- --grep "broadcast.*direct.*classif"

# 5. Step-category trust override
pnpm run test -- --grep "step.*category.*trust"

# 6. Sub-process invocation
pnpm run test -- --grep "sub.*process.*invocation"

# 7. Full cycle execution (integration test)
# Start a sales cycle with test config
# Verify: SENSE phase runs autonomous, ACT phase pauses for review (supervised),
# content step pauses (critical/broadcast), briefing generated
pnpm run test -- --grep "cycle.*integration"
```

## After Completion

1. Update `docs/state.md` with: Operating Cycle Archetype implemented, three core cycles active, 25 templates reorganised as sub-processes
2. Update `docs/roadmap.md` status for Phase 3 cycle infrastructure
3. Update `docs/architecture.md` with: Operating Cycle Archetype section, three sending identities, broadcast/direct trust model, step-category trust, new harness handlers
4. Phase retrospective: did the archetype hold up during implementation? Any phases that didn't fit? Any handlers that need refinement?
5. Write ADR if the sub-process invocation pattern or step-category trust model required significant design decisions
6. Absorb Insights 166-169 into architecture.md (they're now implemented, not provisional)
7. Create follow-up briefs for: channel integration adapters (LinkedIn, email), voice calibration training, first user onboarding with cycle activation
