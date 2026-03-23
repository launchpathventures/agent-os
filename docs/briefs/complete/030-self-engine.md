# Brief 030: Self Engine

**Date:** 2026-03-23
**Status:** ready
**Depends on:** Brief 029 (Self Foundation)
**Unlocks:** Cognitive Architecture A1 (cognitive toolkit enriches Self), multi-project dev pipeline, Goal Framing meta process formalization, self-editing memory

## Goal

- **Roadmap phase:** Conversational Self MVP (parallel with Phase 6, before Phase 10)
- **Capabilities:** Self context assembly, `selfConverse()`, session lifecycle, delegation via tool_use, review mediation, Telegram integration

## Context

This is sub-brief 2 of 2 for the Conversational Self MVP (parent: Brief 028). Brief 029 created the infrastructure: LLM abstraction, schema, cognitive framework file, and standalone role processes. This brief builds the Self itself — the entity that assembles context, converses via the LLM, delegates to dev pipeline roles, mediates reviews, and persists sessions.

After this brief, the creator talks to Ditto-as-self on Telegram. The slash-command-driven workflow becomes a conversation.

See Brief 028 for full context, non-goals, constraints, and UX design.

## Non-Goals

Same as Brief 028. Additionally:
- This brief does NOT modify the LLM abstraction, schema, cognitive framework content, or standalone YAMLs — those are Brief 029.

## Inputs

1. `docs/adrs/016-conversational-self.md` — sections 2, 4-8 (context assembly, sessions, meta processes, cross-surface, cognitive framework, MVP)
2. `docs/research/conversational-self-ux.md` — interaction flows, persona encounters, error recovery
3. `docs/insights/053-pm-consultative-framing.md` — the listen → assess → ask → reflect → hand off pattern
4. `src/engine/llm.ts` — LLM provider abstraction (from Brief 029)
5. `src/db/schema.ts` — `self` scope + `sessions` table (from Brief 029)
6. `cognitive/self.md` — cognitive framework content (from Brief 029)
7. `processes/dev-*-standalone.yaml` — standalone role processes (from Brief 029)
8. `src/engine/harness-handlers/memory-assembly.ts` — existing memory assembly pattern to adapt
9. `src/engine/review-actions.ts` — shared approve/edit/reject functions
10. `src/engine/heartbeat.ts` — `startProcessRun()`, `fullHeartbeat()` for delegation
11. `src/dev-bot.ts` — current Telegram bot to modify

## Constraints

- The Self sits ABOVE the harness pipeline — it is a producer of pipeline inputs, not a handler in the pipeline. Process steps invoked by the Self go through the harness normally.
- The Self calls the LLM via `createCompletion()` from `llm.ts` with tool_use for delegation — not `claude -p` subprocess, not through the harness pipeline.
- Token budget for always-loaded Self context: ~4K tokens (core identity + user knowledge + work state). Session turns managed separately.
- The Telegram bot's free-text message handler must route ALL messages through `selfConverse()`. No direct `runClaude()` calls for conversational messages.
- Security: memories rendered inside `<memories>` block (structural separation). Delegation via structured tool_use (not free-text parsing) — prevents prompt injection from triggering process runs.
- Session suspension generates the `summary` field only; memory reconciliation on suspend is deferred (non-goal: self-editing memory).

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Tiered context assembly | Letta `letta-ai/letta` core memory blocks | Always-in-context identity + on-demand recall. Proven pattern for persistent entities. |
| Session lifecycle | LangGraph `langchain-ai/langgraph` checkpointing | State persistence across pauses. Adapted: conversation state, not execution state. |
| Consultative framing | Management consulting engagement models (listen-assess-ask-reflect-handoff) | Applied to AI interaction. Original to Ditto (Insight-053). |
| Cross-surface turn tracking | Original to Ditto | Per-turn surface tagging for cross-surface continuity. |
| Delegation via tool_use | Anthropic SDK tool use pattern | Structured delegation prevents prompt injection. Each tool maps to an existing engine function. |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/self.ts` | Create: `assembleSelfContext(userId, surface)` and `selfConverse(userId, message, surface)`. Context assembly loads `cognitive/self.md` + self-scoped memories + work state summary + session turns. `selfConverse` manages the turn lifecycle: load context → call LLM (via `llm.ts`) → append turns → handle tool_use calls → execute delegations → synthesize response. |
| `src/engine/self-context.ts` | Create: helper functions. `loadWorkStateSummary()` queries active runs, pending reviews, recent activity. `loadSelfMemories(userId)` loads self-scoped memories with token budgeting. `loadSessionTurns(sessionId)` loads recent turns within budget. |
| `src/engine/self-delegation.ts` | Create: delegation tool definitions and handlers. Tool schemas: `start_dev_role({ role, task })`, `approve_review({ runId })`, `edit_review({ runId, feedback })`, `reject_review({ runId, reason })`. `start_dev_role` maps role to `dev-{role}-standalone` process slug, calls `startProcessRun()` + `fullHeartbeat()`. Review tools call `approveRun()`, `editRun()`, `rejectRun()`. |
| `src/dev-bot.ts` | Modify: replace `runClaude()` calls in free-text handler with `selfConverse()`. Session lifecycle: create/resume on message, suspend on 30min idle (summary generated). `chatSessionId` persisted to DB. Explicit commands (`/start`, `/status`) unchanged. |
| `test/self.test.ts` | Create: integration tests for context assembly, session lifecycle, delegation tool mapping, work state summary. |

## User Experience

- **Jobs affected:** Orient (Self summarizes work state), Review (Self mediates approve/edit/reject), Capture (messages become classified work), Decide (Self presents options)
- **Primitives involved:** Conversation Thread (the Self IS the conversation), Review Queue (Self surfaces waiting items), Quick Capture (messages routed through Self)
- **Process-owner perspective:** The creator opens Telegram and talks to Ditto. Instead of invoking `/dev-pm` then `/dev-architect` then `/dev-builder`, they describe what they want. Ditto frames the goal consultatively, confirms understanding, then delegates to the appropriate dev pipeline roles. Results come back through Ditto's voice. Corrections and approvals happen in conversation. Ditto remembers across sessions — no re-reading docs, no re-orienting.
- **Interaction states:**
  - **First message:** Self loads context, greets with work state awareness ("Hey. Since last time: [summary]. What are you working on?")
  - **Consultative framing:** Self assesses clarity, asks 1-3 targeted questions, reflects back, confirms before delegating
  - **Delegation in progress:** Self communicates what it's doing ("Working on this now — I'll research first, then design the approach. Back shortly.")
  - **Results returned:** Self synthesizes delegation results, presents key findings, asks for decisions
  - **Review items:** Self surfaces waiting review items naturally in conversation
  - **Session resume:** Self loads prior context, orients the human without asking
  - **Error:** Self diagnoses and proposes, never hides (per UX spec section 4.4)
- **Designer input:** Full UX interaction spec at `docs/research/conversational-self-ux.md`. All 10 design principles addressed.

## Acceptance Criteria

1. [ ] `assembleSelfContext(userId, surface)` returns a structured system prompt containing: cognitive framework (from `cognitive/self.md`), self-scoped memories, work state summary (active runs, pending reviews), and recent session turns. Total always-loaded content fits within ~4K tokens.
2. [ ] `selfConverse(userId, message, surface)` processes a human message through the Self: assembles context → calls LLM (via `llm.ts`) → appends turn to session → handles tool_use calls → executes delegations → returns response.
3. [ ] Work state summary correctly queries: count of active process runs, count of pending review items (status = `waiting_review`), count of recent completions (last 24h).
4. [ ] Session lifecycle works: new session created on first message, turns appended on each exchange, session suspended after 30min idle (summary generated, no memory reconciliation — deferred), new session created after suspension. Active session is resumed if the user returns before timeout.
5. [ ] Sessions are persisted in the database (not in-memory). The Telegram bot's `chatSessionId` is replaced with a DB-backed session lookup.
6. [ ] Delegation via tool use: the Self's LLM has tools (`start_dev_role({ role, task })`, `approve_review({ runId })`, `edit_review({ runId, feedback })`, `reject_review({ runId, reason })`). `start_dev_role` maps role name to `dev-{role}-standalone` process slug, calls `startProcessRun()` + `fullHeartbeat()`, captures the result, and returns it for the Self to synthesize. Each delegation is a proper process run through the full harness (trust, memory, feedback, audit trail).
7. [ ] Review mediation: when a process run is `waiting_review`, the Self can present the output and accept approve/edit/reject decisions from the human within the conversation. These map to `approveRun()`, `editRun()`, `rejectRun()`.
8. [ ] Cross-session memory: self-scoped memories are loaded on every conversation. If a self-scoped memory is manually inserted (e.g., via DB), it appears in the Self's context on the next conversation turn.
9. [ ] The Self's LLM calls use `createCompletion()` from `llm.ts` with tool_use for delegation — not `claude -p` subprocess, not through the harness pipeline. Only delegated process steps go through the harness.
10. [ ] Telegram bot free-text messages route through `selfConverse()`. Explicit commands (`/start`, `/status`) continue to work as before.
11. [ ] Integration tests cover: context assembly (with/without memories, with/without active session), session create/resume/suspend lifecycle, work state summary query, delegation tool mapping (role → slug → startProcessRun).

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md` + `docs/adrs/016-conversational-self.md`
2. Review agent checks:
   - Does the Self sit above the harness (not inside it)?
   - Is delegation via structured tool_use (not free-text parsing)?
   - Does the session lifecycle match ADR-016 section 4?
   - Are the UX spec's 10 design principles addressable?
   - Is the brief implementable in one focused session?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Ensure Brief 029 artifacts exist
pnpm test  # All tests pass (including LLM abstraction tests from 029)
cat cognitive/self.md | head -5  # Cognitive framework file exists

# 2. Start the Telegram bot
TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<id> pnpm dev-bot

# 3. Send: "What's the current state of the project?"
# Expected: Self loads context, responds with work state summary
# Response should feel like a competent teammate briefing you, not a status dump

# 4. Send: "I want to add error handling to the CLI commands"
# Expected: Self assesses clarity, may ask 1-2 questions,
# then delegates to dev pipeline roles via tool_use

# 5. Check engine state after delegation
pnpm cli status
# Expected: a dev-*-standalone process run exists with the delegated task

# 6. Close terminal, wait 30+ minutes, send another message
# Expected: new session created, Self loads self-scoped memories,
# orients based on prior conversation context

# 7. Manually insert a self-scoped memory, then verify it appears in context:
sqlite3 data/ditto.db "INSERT INTO memories (id, scopeType, scopeId, type, content, source, reinforcementCount, confidence, active, createdAt, updatedAt) VALUES (lower(hex(randomblob(16))), 'self', 'creator', 'preference', 'Prefers terse responses with no trailing summaries', 'human', 1, 1.0, 1, unixepoch(), unixepoch())"
# Send a message — the memory should influence the Self's response style
```

## After Completion

1. Update `docs/state.md` with what changed
2. Update `docs/roadmap.md` — mark Conversational Self MVP capabilities as done
3. Move Briefs 028, 029, 030 to `docs/briefs/complete/`
4. Update ADR-003: add `self` scope type to the documented scope model
5. Update ADR-015: clarify that Goal Framing is implemented through the Self's consultative conversation
6. Update ADR-012: note `llm.ts` as the concrete implementation of the model routing concept
7. Phase retrospective: what worked, what surprised, what to change
8. Next brief candidates:
   - Self-editing memory (post-conversation LLM reconciliation + self-level feedback capture)
   - Cognitive Architecture A1 (cognitive toolkit content enriches `cognitive/self.md`)
   - Multi-project context switching (Insight-052)
   - Goal Framing meta process formalization (ADR-015 section 3)
