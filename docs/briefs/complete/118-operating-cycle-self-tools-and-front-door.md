# Brief 118: Operating Cycle — Self-Tools & Front Door

**Date:** 2026-04-09
**Status:** draft
**Depends on:** Brief 117 (cycle definitions + process reorganisation)
**Unlocks:** All future cycle implementations (hiring, finance, project management, etc.)

## Goal

- **Roadmap phase:** Phase 3: Network Agent & Continuous Operation
- **Capabilities:** Conversational cycle activation/management via Self-tools, cycle-aware network tools, scheduler dual triggers, and front door prompt framing for continuous operation

## Context

Briefs 116 (infrastructure) and 117 (cycle definitions) deliver the engine-level and process-level foundations. This brief connects cycles to the user experience: Self-tools for activating and managing cycles, rethought network tools, scheduler support for dual triggers, and updated front door framing.

The key UX principle: users never see cycles, phases, or YAML. They say "help me fill my pipeline" and Alex starts operating. They receive briefings, approve broadcast content, and get pulled in for qualified conversations.

## Objective

Add five cycle management self-tools, rethink existing network tools to be cycle-aware, support dual triggers in the scheduler, extend heartbeat for cycle phase navigation, and update the front door prompt to frame continuous operation.

## Non-Goals

- New harness handlers — Brief 116 (done)
- Cycle YAML definitions — Brief 117 (done)
- UI/dashboard for cycle management — cycles are conversational
- Channel integration adapters (LinkedIn, email API) — future briefs
- Cross-cycle coordination triggers — future brief
- Voice calibration training — future brief

## Inputs

1. `docs/briefs/115-operating-cycle-archetype.md` — parent brief
2. `docs/briefs/116-operating-cycle-shared-infrastructure.md` — infrastructure brief
3. `docs/briefs/117-operating-cycle-definitions-and-process-reorg.md` — cycle definitions brief
4. `docs/insights/168-operating-cycle-archetype.md` — archetype definition
5. `docs/insights/169-alex-capability-surface-as-concurrent-cycles.md` — capability surface model
6. `src/engine/self-tools/network-tools.ts` — current network tools (to rethink)
7. `src/engine/self-delegation.ts` — current delegation system (to extend)
8. `src/engine/network-chat-prompt.ts` — current front door prompt (to update)
9. `src/engine/scheduler.ts` — current scheduler (to extend)
10. `src/engine/heartbeat.ts` — current heartbeat (as extended by Brief 117)

## Constraints

- **Self-tools are product layer.** They live in `src/engine/self-tools/`, not `packages/core/`. They reference Ditto-specific concepts (Alex, personas, cycles by name).
- **Cycle activation is conversational.** No new UI surfaces. Alex asks configuration questions, starts the cycle, and reports via existing briefing + review queue patterns.
- **Existing network tools are not deleted.** `network_status` becomes cycle-aware. `create_sales_plan` and `create_connection_plan` become cycle activation wrappers.
- **Briefing format is standardised.** Every cycle produces briefings with the same structure: context, summary, recommendations, options. This is the handoff format from Insight-168.
- **Dual triggers don't replace existing scheduler.** The scheduler gains support for a second trigger on a process (the `also` field on ProcessDefinition.trigger is already in the type — this brief wires it through).
- **Type-check must pass.** `pnpm run type-check` at root.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Self-tool pattern | Existing Ditto Self tools | pattern | 19 existing tools — cycle tools follow the same registration and invocation pattern |
| Cycle briefing format | Ditto Insight-168 handoff triggers | pattern | Original — standardised briefing with context/summary/recommendations/options |
| BDR handoff pattern | Sales operations practice | pattern | Alex as BDR: operates pipeline autonomously, hands off warm conversations to user |
| Dual triggers | Existing ProcessDefinition.trigger.also | pattern | Type already exists in harness.ts — this brief wires execution support |

## What Changes (Work Products)

### New Files

| File | Action |
|------|--------|
| `src/engine/self-tools/cycle-tools.ts` | Create: 5 cycle management tools for Self delegation. (1) `activate_cycle` — takes cycle type + user configuration (ICP, goals, channels, boundaries), creates a process run with `cycleType` set, starts the cycle. Asks clarifying questions if config is incomplete. (2) `pause_cycle` — pauses a running cycle (sets run status to `waiting_human`). (3) `resume_cycle` — resumes a paused cycle. (4) `cycle_briefing` — generates a standardised handoff briefing for a cycle: context (what happened), summary (key metrics), recommendations (suggested next actions), options (user choices). Queries recent step runs, outbound actions, and cycle metrics. (5) `cycle_status` — returns per-cycle pipeline view: active cycles, current phase per cycle, pending reviews, upcoming scheduled runs. |

### Modified Files

| File | Action |
|------|--------|
| `src/engine/self-tools/network-tools.ts` | Modify: (1) `create_sales_plan` → becomes a wrapper that calls `activate_cycle` with type `sales-marketing` and the user's sales configuration. Preserves the conversational flow but the backend is now a cycle. (2) `create_connection_plan` → becomes a wrapper that calls `activate_cycle` with type `network-connecting`. (3) `network_status` → becomes cycle-aware: shows active cycles, their current phases, and aggregate metrics (conversations active, meetings booked, introductions made, follow-ups pending). |
| `src/engine/self-delegation.ts` | Modify: register 5 new cycle tools (`activate_cycle`, `pause_cycle`, `resume_cycle`, `cycle_briefing`, `cycle_status`) in the delegation system. These are available to Self alongside existing tools. |
| `src/engine/network-chat-prompt.ts` | Modify: update conversation stages to frame continuous operation. Instead of "I'll research your targets" (one-time campaign framing), use "I'll set up a continuous sales operation" (cycle framing). Update the configuration questions to gather cycle inputs: ICP, goals, channels, boundaries, preferred cadence. The prompt should convey that Alex operates continuously — not that Alex does a one-time task. |
| `src/engine/scheduler.ts` | Modify: support dual triggers per process. When a process has `trigger.also`, register a second trigger (cron or event). A cycle can have a daily scheduled run AND event-triggered partial runs. Both triggers create process runs through the same path. Idempotency: if a cycle is already mid-run when a trigger fires, skip (don't create overlapping runs). |
| `src/engine/heartbeat.ts` | Modify: (1) Support cycle phase navigation. When a cycle step has `route_to` conditions based on cycle state (e.g., "skip LAND if nothing to send"), use existing routing handler — no new routing logic needed, just ensure cycle steps can use `route_to` and `default_next`. (2) After cycle BRIEF phase completes, check if cycle should auto-restart (continuous operation): if `cycleConfig.continuous: true`, create a new run of the same cycle with updated inputs from the LEARN phase output. |

## User Experience

- **Jobs affected:** Delegate (activate cycles), Orient (cycle status + briefings), Review (approve broadcast content from cycle GATE steps)
- **Primitives involved:** Process run (cycles), work item (cycle-generated tasks), briefing (cycle briefings), review queue (broadcast approvals)
- **Process-owner perspective:** The user says "help me fill my pipeline" or "start working on my sales." Alex asks configuration questions (ICP, targets, goals, channels, boundaries). Once configured, Alex starts operating continuously. The user receives daily briefings ("3 conversations active, 1 meeting booked"), approves broadcast content when it reaches the review queue, and gets pulled in with full briefings when conversations need their presence. They never see YAML, cycle phases, or process runs. They see outcomes.
- **Interaction states:** N/A — no new UI surfaces. All interaction through existing conversation + briefing + review queue.
- **Designer input:** Not invoked — lightweight UX section. The cycle infrastructure is invisible to the user. User-facing experience uses existing Self conversation + briefing + review queue patterns established in prior briefs.

## Acceptance Criteria

1. [ ] `activate_cycle` self-tool creates and starts a sales-marketing cycle with user-provided configuration (test: tool call with ICP + goals → process run created with `cycleType: 'sales-marketing'`, `cycleConfig` populated)
2. [ ] `activate_cycle` returns a confirmation message framed as continuous operation ("I'll start working on your sales pipeline") not one-time ("I'll research your targets")
3. [ ] `pause_cycle` pauses a running cycle and `resume_cycle` resumes it (test: pause → status `waiting_human`, resume → status `running`)
4. [ ] `cycle_briefing` produces output with four sections: context, summary, recommendations, options
5. [ ] `cycle_status` returns active cycles with current phase, pending reviews, and next scheduled run
6. [ ] `create_sales_plan` in network-tools activates a sales-marketing cycle (not a one-time process)
7. [ ] `network_status` shows cycle-aware information when cycles are active
8. [ ] 5 new tools registered in self-delegation.ts and invocable by Self
9. [ ] Scheduler supports dual triggers: a cycle with both a daily cron and an event trigger fires correctly for both (test: cron fires → run created, event fires → second run created)
10. [ ] Scheduler skips trigger if cycle already has an active run (no overlapping runs)
11. [ ] Front door prompt frames continuous operation, not one-time campaigns
12. [ ] `pnpm run type-check` passes at root
13. [ ] All existing tests pass (no regressions)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md` + `docs/insights/168-operating-cycle-archetype.md`
2. Review agent checks:
   - Do self-tools follow the existing registration and invocation pattern?
   - Is cycle activation conversational (no new UI surfaces)?
   - Does the briefing format match the standardised handoff pattern from Insight-168?
   - Are existing network tools backward compatible (wrappers, not replacements)?
   - Does the scheduler handle dual triggers without race conditions?
   - Is the front door prompt change consistent with the continuous operation framing?
   - Does the heartbeat auto-restart respect continuous cycle configuration?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Type-check passes
pnpm run type-check

# 2. Cycle activation
pnpm run test -- --grep "activate.*cycle"

# 3. Cycle briefing format
pnpm run test -- --grep "cycle.*briefing"

# 4. Scheduler dual triggers
pnpm run test -- --grep "dual.*trigger\|scheduler.*also"

# 5. Network tools cycle-aware
pnpm run test -- --grep "network.*tools.*cycle\|create.*sales.*plan"

# 6. All existing tests still pass
pnpm run test
```

## After Completion

1. Update `docs/state.md` with: Brief 118 complete — 5 cycle self-tools, network tools cycle-aware, scheduler dual triggers, front door continuous framing
2. Update `docs/architecture.md` with: Operating Cycle Archetype section, three sending identities, broadcast/direct trust model, step-category trust, new harness handlers, cycle activation model
3. Absorb Insights 166-169 into architecture.md (they're now implemented)
4. Phase retrospective: did the archetype hold up across all three sub-briefs?
5. Create follow-up briefs: channel integration adapters, voice calibration training, cross-cycle coordination, first user onboarding with cycle activation
