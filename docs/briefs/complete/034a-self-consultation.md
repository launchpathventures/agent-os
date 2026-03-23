# Brief: Self Consultation + Decision Tracking

**Date:** 2026-03-23
**Status:** complete
**Depends on:** Brief 030 (Self Engine — complete), Insight-063 (Metacognitive Oversight — active)
**Unlocks:** Brief 034b (Harness-Level Metacognitive Check — can build in parallel), Self-level learning from decision patterns

## Goal

- **Roadmap phase:** Conversational Self MVP (extension)
- **Capabilities:** Teammate consultation tool for the Self, Self decision tracking, Self-correction memories

## Context

The Conversational Self (Brief 030) is the outermost harness ring — it interprets human intent, delegates to dev roles, synthesizes results, and mediates reviews. It currently has zero oversight on its own reasoning. Every inner layer has trust gates, review patterns, and feedback recording, but the Self has none (Insight-063).

Great human managers use two complementary loops: internal metacognition (self-checking before acting) and external teammate consultation (quick check with a colleague before committing). The cognitive framework update (`cognitive/self.md`) shipped the internal loop as cognitive scaffolding. This brief delivers the external loop as a tool + the decision tracking infrastructure to learn from Self-level patterns over time.

## Objective

The Self can consult dev roles for quick perspective checks without spawning full process runs. Self-level decisions (delegation, consultation, inline response) are tracked as activities. When the human corrects a Self-level decision, that correction feeds into self-scoped memory for future context.

## Non-Goals

- Multi-agent consultation (multiple roles discussing) — consultation is one role, one perspective
- Automatic self-correction (if consultation reveals issues, the Self decides what to do — no automatic retry)
- Confidence scores on Self responses — implicit in language per the cognitive framework, not structured metadata
- Harness-level metacognitive checking for all agents — that's Brief 034b
- Model routing for consultations — uses deployment default until Brief 033 lands

## Inputs

1. `src/engine/self-delegation.ts` — current 4 delegation tools and handler pattern
2. `src/engine/self.ts` — conversation loop, context assembly, `SelfConverseResult` interface
3. `src/engine/self-context.ts` — self-scoped memory loading, session lifecycle
4. `src/adapters/claude.ts` lines 160-174 — role contract loading pattern (reuse for consultation)
5. `src/engine/harness-handlers/feedback-recorder.ts` — feedback-to-memory bridge pattern (extend for Self)
6. `src/engine/llm.ts` — `createCompletion()` interface
7. `cognitive/self.md` — metacognitive checks section (just shipped, includes consultation guidance)
8. `docs/adrs/017-delegation-weight-classes.md` — Inline weight class definition
9. `docs/insights/063-self-oversight-two-loops.md` — design rationale

## Constraints

- MUST NOT create a process run for consultations — consultation is Inline weight (ADR-017), not Light
- MUST NOT bypass the existing tool_use pattern — `consult_role` is a tool like `start_dev_role`, handled in `executeDelegation()`
- MUST reuse the role contract loading pattern from `src/adapters/claude.ts` — composition over invention
- MUST keep consultations cheap — `maxTokens: 1024`, terse system prompt
- MUST NOT change the existing 4 delegation tools — additive only
- MUST use the existing `activities` table for decision tracking — no new tables
- MUST use existing `memories` table with `scopeType: 'self'` for correction memories — no new tables
- MUST use existing `createMemoryFromFeedback()` pattern or equivalent for correction memories

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Consultation as Inline weight | ADR-017 Section 2 (delegation weight classes) | The Self reasons directly — consultation is thinking with a teammate's lens, not spawning work |
| Role contract loading | `src/adapters/claude.ts` lines 160-174 | Existing pattern for loading `.claude/commands/dev-*.md` as system prompts |
| Tool_use delegation pattern | `src/engine/self-delegation.ts` (Brief 030) | Existing structured tool pattern prevents prompt injection |
| Feedback-to-memory bridge | `src/engine/harness-handlers/feedback-recorder.ts` | Existing pattern: human correction → correction memory with reinforcement |
| Activity logging | `src/engine/harness-handlers/feedback-recorder.ts` | Existing pattern: every decision recorded in activities table |
| Router confidence pattern | `src/engine/system-agents/router.ts` | LLM-based decision maker with structured confidence output — pattern for "reason then decide" |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/self-delegation.ts` | **Modify:** Add `consult_role` tool definition (5th tool). Add `handleConsultRole()` handler — loads role contract, calls `createCompletion()` with terse consultation prompt, returns perspective. Add consultation activity logging. |
| `src/engine/self.ts` | **Modify:** Add `consultationsExecuted: number` to `SelfConverseResult`. Count `consult_role` calls separately from delegations. Update `<delegation_guidance>` in `assembleSelfContext()` with consultation guidance. Add `recordSelfDecision()` calls after each tool call and after final response. |
| `src/engine/self-context.ts` | **Modify:** Add `recordSelfDecision()` function — records Self-level decisions (delegation, consultation, inline_response) as activities. Add `recordSelfCorrection()` function — creates self-scoped correction memory when human redirects Self's decision. |
| `src/engine/self.test.ts` | **Modify:** Add tests for consult_role tool, consultation tracking, decision recording, Self-correction memories. |

## User Experience

- **Jobs affected:** Delegate (the Self delegates more intelligently after consultation)
- **Primitives involved:** None directly — consultation is internal to the Self, not visible as a UI element
- **Process-owner perspective:** The human notices the Self making better delegation choices, surfacing uncertainty more often, and sometimes saying "I checked with the architect and..." before committing to a direction. The consultation is transparent (the human sees the Self consulted) but not noisy (no approval needed).
- **Interaction states:** N/A — no new UI surfaces
- **Designer input:** Not invoked — lightweight UX section only. Consultation surfaces through existing Telegram/CLI text responses.

## Acceptance Criteria

1. [ ] `selfTools` array contains 5 tools (existing 4 + `consult_role`)
2. [ ] `consult_role` tool definition accepts `role` (enum of 7 roles), `question` (string), and optional `context` (string)
3. [ ] `handleConsultRole()` loads role contract from `.claude/commands/dev-{role}.md` using the same pattern as `src/adapters/claude.ts`
4. [ ] `handleConsultRole()` calls `createCompletion()` with system prompt = role contract + consultation framing, `maxTokens: 1024`
5. [ ] `handleConsultRole()` returns `DelegationResult` with the role's perspective as output text
6. [ ] `consult_role` with an invalid role returns a graceful error (same pattern as `start_dev_role` validation)
7. [ ] `SelfConverseResult` has `consultationsExecuted: number` field, tracked separately from `delegationsExecuted`
8. [ ] `<delegation_guidance>` in `assembleSelfContext()` includes consultation guidance (when to use `consult_role` vs `start_dev_role`)
9. [ ] `recordSelfDecision()` creates an activity record with action `self.decision.{type}` for each Self decision (delegation, consultation, inline_response)
10. [ ] `recordSelfDecision()` is called after each tool call in the `selfConverse()` loop and after the final response
11. [ ] `recordSelfCorrection()` creates a self-scoped correction memory when the human's next message contradicts the Self's last delegation choice. Detection: if the Self delegated to role X and the human's next turn re-delegates to role Y (via a different `start_dev_role` call in the same session), OR if the human explicitly says "no" / "wrong role" / "I meant..." (substring match on negation + role keywords), record a correction memory: "Self delegated to {X} but human wanted {Y} for: {task summary}"
12. [ ] Self-correction memories use `scopeType: 'self'` and are loaded by existing `loadSelfMemories()` in context assembly
13. [ ] Consultation activity record includes: role consulted, question asked, response length, cost
14. [ ] All existing self.test.ts tests continue to pass
15. [ ] New tests: consult_role loads contract + returns response (mock createCompletion), invalid role error, consultationsExecuted tracking, decision recording creates activities, correction memory created on redirect

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: Is `consult_role` truly Inline weight (no harness, no process run)? Does decision tracking use existing tables (no schema migration)? Do correction memories follow the existing feedback-to-memory pattern? Is the consultation system prompt appropriately terse?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# Run tests
pnpm test

# Verify type-check passes
pnpm run type-check

# Live smoke test (requires configured LLM):
# 1. Start Telegram bot
# 2. Send an ambiguous message like "I'm not sure what to work on next"
# 3. Observe: Self may consult PM before responding
# 4. Send a correction: "No, I meant research, not triage"
# 5. Check activities table for self.decision.* records
# 6. Check memories table for self-scoped correction memory
```

## After Completion

1. Update `docs/state.md` with what changed
2. Update `docs/roadmap.md` — add Self Consultation row to Conversational Self MVP section
3. Phase retrospective: was consultation tool used naturally by the Self? Was the 512 token limit sufficient?
4. Insight-063 status → "partially absorbed" (034a shipped, 034b remaining)
