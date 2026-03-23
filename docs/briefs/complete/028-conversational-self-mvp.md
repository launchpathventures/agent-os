# Brief 028: Conversational Self MVP

**Date:** 2026-03-23
**Status:** ready (parent brief — see sub-briefs 029 and 030 for build instructions)
**Depends on:** Brief 027 (Telegram Bot Engine Bridge — complete), ADR-016 (accepted)
**Unlocks:** Cognitive Architecture A1 (cognitive toolkit enriches Self), multi-project dev pipeline, Goal Framing meta process formalization
**Sub-briefs:** 029 (Self Foundation) → 030 (Self Engine)

## Goal

- **Roadmap phase:** Conversational Self MVP (parallel with Phase 6, before Phase 10)
- **Capabilities:** Self context assembly, self memory scope, sessions table, cognitive/self.md, Telegram integration as first surface

## Context

Ditto has a working engine (6 layers, 88 tests, E2E verified) and a Telegram bot that routes through the engine harness (Brief 027). But there is no unified entity the user talks to. The creator invokes slash commands manually (`/dev-pm`, `/dev-builder`), reads docs to orient, and each conversation starts from scratch.

ADR-016 defines the Conversational Self as the outermost harness ring — Layer 6 given a voice. The research (12 systems surveyed) and UX spec (4 persona encounters, 10 design principles) are complete. This brief implements the MVP: the creator talks to Ditto-as-self on Telegram for the dev pipeline.

The MVP proves: persistent identity, consultative framing (Insight-053), delegation to dev pipeline roles, cross-session memory, and the cognitive framework as identity.

## Non-Goals

- Self-editing memory (post-conversation LLM reconciliation) — use manual `INSERT` or harness feedback-to-memory bridge for MVP. Session suspension generates the `summary` field only; memory reconciliation on suspend is deferred with self-editing memory. Follow-up brief.
- Full Daily Brief integration — the Self can summarize work state, but the brief-synthesizer system agent is Phase 10.
- Web surface — Telegram is the only Self surface in this brief.
- Multi-user / workspace scoping — single creator, single workspace.
- Response density adaptation per surface — start with Telegram-appropriate responses only. CLI and web density variants are deferred.
- Full Goal Framing meta process definition (ADR-015 section 3) — the Self implements the consultative *pattern* (listen → assess → ask → reflect → hand off) in its system prompt. The formal Goal Framing process YAML is a follow-up.
- Process creation — the Self can discuss processes but doesn't create them in this MVP. "Define" mode is deferred.
- Multi-project context switching (Insight-052) — one project (this repo) for MVP.
- Proactive initiation — the Self only responds to human messages in this MVP. Push notifications and proactive surfacing (UX principle 4: "silence is the default") are deferred. The reactive-only model satisfies the principle for MVP since the Self never speaks unprompted.
- Self-level feedback capture — the Self's own framing quality and delegation accuracy produce no feedback signal in this MVP. The Learning Layer (L5) tracks delegated process step outcomes but not the Self's performance. Follow-up concern for the self-editing memory brief.

## Inputs

1. `docs/adrs/016-conversational-self.md` — architectural authority for the Self. Sections 1-8 define everything.
2. `docs/research/persistent-conversational-identity.md` — 12 systems surveyed, composition patterns
3. `docs/research/conversational-self-ux.md` — UX interaction spec: persona encounters, communication principles, surface adaptations, error recovery, 10 design principles
4. `docs/insights/049-consultative-not-configurative.md` — interaction model principle
5. `docs/insights/052-creator-is-first-outcome-owner.md` — validation target
6. `docs/insights/053-pm-consultative-framing.md` — consultative framing pattern
7. `src/engine/harness-handlers/memory-assembly.ts` — existing memory assembly pattern to adapt
8. `src/db/schema.ts` — current schema (add `self` scope + `sessions` table)
9. `src/dev-bot.ts` — current Telegram bot to integrate with
10. `src/adapters/cli.ts` — CLI adapter interface for delegation
11. `docs/insights/060-llm-provider-abstraction.md` — LLM coupling concern; this brief introduces the abstraction

## Constraints

- The Self sits ABOVE the harness pipeline — it is a producer of pipeline inputs, not a handler in the pipeline. Process steps invoked by the Self go through the harness normally.
- `self` memory scope must use the same `memories` table structure (same schema, new `scope_type` value). No separate table.
- Session turns are stored as JSON array in the `sessions` table — not as separate rows. This keeps the schema simple for MVP.
- The Self calls the LLM via a new thin provider abstraction (`src/engine/llm.ts` — Insight-060) for its own reasoning — not `claude -p` subprocess. The Self needs multi-turn conversation, tool use for delegation, and fine-grained system prompt control that subprocess invocation cannot provide. Delegated process steps (dev roles) still use the CLI adapter (`claude -p`) through the harness. The Self does NOT go through the harness step-execution pipeline for its own thinking. The 3 existing direct `new Anthropic()` call sites (`src/adapters/claude.ts`, `src/engine/system-agents/router.ts`, `src/engine/harness-handlers/review-pattern.ts`) are migrated to the same abstraction in this brief.
- The `cognitive/self.md` file must be loadable as a static file, not from the database. It is the Self's "CLAUDE.md equivalent" — persistent, version-controlled, human-editable.
- Token budget for always-loaded Self context: ~4K tokens (core identity + user knowledge + work state). Session turns are managed separately.
- The Telegram bot's free-text message handler must route ALL messages through `selfConverse()`. No direct `runClaude()` calls for conversational messages.
- Security: self-scoped memories are injected into the system prompt. Content must be treated as untrusted data. Sanitization: memories are rendered inside a clearly delimited `<memories>` block (same structural separation used in existing `memory-assembly.ts`), preventing memory content from being interpreted as system instructions. The Self's delegation mechanism uses structured tool calls (Anthropic SDK tool_use), not free-text parsing — this prevents prompt injection from triggering unintended process runs.

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Tiered context assembly | Letta `letta-ai/letta` core memory blocks | Always-in-context identity + on-demand recall. Proven pattern for persistent entities. |
| Self-scoped memory | Mem0 `mem0ai/mem0` scope filtering | Extraction-reconciliation already adopted in ADR-003. Extended to third scope. |
| Session persistence | LangGraph `langchain-ai/langgraph` checkpointing | State persistence across pauses. Adapted: conversation state, not execution state. |
| Consultative framing | Management consulting engagement models (listen-assess-ask-reflect-handoff) | Applied to AI interaction. The specific AI application is Original to Ditto (Insight-053). |
| LLM provider abstraction | Insight-060, Vercel AI SDK pattern (unified interface) | Thin `createCompletion()` wrapper prevents 4th direct Anthropic coupling. Migrates 3 existing call sites. Provider-agnostic interface enables future model routing (ADR-012). |
| Standalone role processes | Option A from delegation model analysis | One single-step YAML per dev role. Each delegation is a proper process run through the full harness (trust, memory, feedback, audit). Zero engine changes. |
| Cross-surface turn tracking | Original to Ditto | Per-turn surface tagging for cross-surface continuity. No surveyed system does this. |
| Cognitive framework as identity | Original to Ditto | Identity defined by reasoning approach and trade-off heuristics, not just memory + prompt. |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/llm.ts` | Create: thin LLM provider abstraction. `createCompletion({ model, system, messages, tools? })` → `{ content, tokensUsed, costCents }`. Provider registry maps model identifiers to SDK clients. Initial provider: Anthropic (`@anthropic-ai/sdk`). ~50 lines. (Insight-060) |
| `src/adapters/claude.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/engine/system-agents/router.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/engine/harness-handlers/review-pattern.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/db/schema.ts` | Modify: add `"self"` to `memoryScopeTypeValues`. Add `sessions` table (id, userId, surface, startedAt, lastActiveAt, status, summary, turns). Add `sessionSurfaceValues` and `sessionStatusValues` enums. |
| `cognitive/self.md` | Create: the Self's cognitive framework file. Contains: consultative framing protocol, communication principles (competent/direct/warm/purposeful), trade-off heuristics, escalation sensitivity, domain context for dev pipeline. ~800-1200 words. |
| `processes/dev-pm-standalone.yaml` | Create: single-step process for PM role. Uses `cli-agent` executor with `agent_role: pm`. Same pattern for all 7 roles. |
| `processes/dev-researcher-standalone.yaml` | Create: single-step process for Researcher role. |
| `processes/dev-designer-standalone.yaml` | Create: single-step process for Designer role. |
| `processes/dev-architect-standalone.yaml` | Create: single-step process for Architect role. |
| `processes/dev-builder-standalone.yaml` | Create: single-step process for Builder role. |
| `processes/dev-reviewer-standalone.yaml` | Create: single-step process for Reviewer role. |
| `processes/dev-documenter-standalone.yaml` | Create: single-step process for Documenter role. |
| `src/engine/self.ts` | Create: `assembleSelfContext(userId, surface)` and `selfConverse(userId, message, surface)`. Context assembly loads cognitive/self.md + self-scoped memories + work state summary + session turns. `selfConverse` manages the turn lifecycle: load context → call LLM (via `llm.ts`) → append turns → detect delegation intent → execute delegation → synthesize response. |
| `src/engine/self-context.ts` | Create: helper functions for Self context assembly. `loadWorkStateSummary()` queries active runs, pending reviews, recent activity. `loadSelfMemories(userId)` loads self-scoped memories with token budgeting. `loadSessionTurns(sessionId)` loads recent turns within budget. |
| `src/engine/self-delegation.ts` | Create: delegation tools and execution. Defines tool schemas for the Self's LLM: `start_dev_role` (params: `{ role: string, task: string }` — role is one of pm/researcher/designer/architect/builder/reviewer/documenter, task is the natural language description), `approve_review` (params: `{ runId: string }`), `edit_review` (params: `{ runId: string, feedback: string }`), `reject_review` (params: `{ runId: string, reason: string }`). `start_dev_role` maps role name to process slug (`dev-{role}-standalone`) and calls `startProcessRun(slug, { task })` + `fullHeartbeat()`. Review tools call `approveRun()`, `editRun()`, `rejectRun()`. Returns structured results for the Self to synthesize. |
| `src/dev-bot.ts` | Modify: replace `runClaude()` calls in free-text message handler with `selfConverse()`. Add session lifecycle: create/resume session on conversation start, suspend on idle (30min timeout). Persist `chatSessionId` to DB instead of in-memory. Remove direct `claude -p` calls for conversational messages (keep for explicit `/start` engine runs). |
| `test/self.test.ts` | Create: integration tests for Self context assembly, session lifecycle, and LLM abstraction. |

## User Experience

- **Jobs affected:** Orient (Self summarizes work state), Review (Self mediates approve/edit/reject), Capture (messages to Self are captured and classified), Decide (Self presents options for human decision)
- **Primitives involved:** Conversation Thread (the Self IS the conversation), Review Queue (Self surfaces waiting items), Quick Capture (messages become work items when appropriate)
- **Process-owner perspective:** The creator opens Telegram and talks to Ditto. Instead of invoking `/dev-pm` then `/dev-architect` then `/dev-builder`, they describe what they want. Ditto frames the goal consultatively, confirms understanding, then delegates to the appropriate dev pipeline roles. Results come back through Ditto's voice. Corrections and approvals happen in conversation. Ditto remembers across sessions — no re-reading docs, no re-orienting.
- **Interaction states:**
  - **First message:** Self loads context, greets with work state awareness ("Hey. Since last time: [summary]. What are you working on?")
  - **Consultative framing:** Self assesses clarity, asks 1-3 targeted questions, reflects back, confirms before delegating
  - **Delegation in progress:** Self communicates what it's doing ("Working on this now — I'll research first, then design the approach. Back shortly.")
  - **Results returned:** Self synthesizes delegation results, presents key findings, asks for decisions
  - **Review items:** Self surfaces waiting review items naturally in conversation ("There's a quote ready for your review — want to see it?")
  - **Session resume:** Self loads prior context, orients the human without asking
  - **Error:** Self diagnoses and proposes, never hides (per UX spec section 4.4)
- **Designer input:** Full UX interaction spec at `docs/research/conversational-self-ux.md`. The brief addresses all 10 design principles. Key persona validated: the creator (Insight-052) maps to Rob/Jordan — describes goals, reviews on mobile, expects memory.

## Acceptance Criteria

1. [ ] `src/engine/llm.ts` exists with `createCompletion({ model, system, messages, tools? })` returning `{ content, tokensUsed, costCents }`. Anthropic is the initial provider. The 3 existing direct `new Anthropic()` call sites (`src/adapters/claude.ts`, `src/engine/system-agents/router.ts`, `src/engine/harness-handlers/review-pattern.ts`) are migrated to use it. All 88 existing tests still pass after migration.
2. [ ] `memoryScopeTypeValues` includes `"self"` alongside `"agent"` and `"process"` in `src/db/schema.ts`
3. [ ] `sessions` table exists in schema with fields: `id`, `userId`, `surface`, `startedAt`, `lastActiveAt`, `status` (active/suspended/closed), `summary` (nullable), `turns` (JSON array)
4. [ ] `cognitive/self.md` exists with: consultative framing protocol, communication principles, trade-off heuristics, escalation sensitivity, dev pipeline domain context. File is loaded by `assembleSelfContext()` as static content.
5. [ ] `assembleSelfContext(userId, surface)` returns a structured system prompt containing: cognitive framework (from `cognitive/self.md`), self-scoped memories, work state summary (active runs, pending reviews), and recent session turns. Total always-loaded content fits within ~4K tokens.
6. [ ] `selfConverse(userId, message, surface)` processes a human message through the Self: assembles context → calls LLM (via `llm.ts`) → appends turn to session → detects delegation intents → executes delegations → returns response.
7. [ ] Work state summary correctly queries: count of active process runs, count of pending review items (status = `waiting_review`), count of recent completions (last 24h).
8. [ ] 7 standalone role process definitions exist in `processes/` (dev-pm-standalone.yaml through dev-documenter-standalone.yaml). Each has one step with `executor: cli-agent` and the appropriate `agent_role`. All load successfully via `pnpm cli sync`.
9. [ ] Session lifecycle works: new session created on first message, turns appended on each exchange, session suspended after 30min idle (summary generated, no memory reconciliation — deferred), new session created after suspension. Active session is resumed if the user returns before timeout.
10. [ ] Sessions are persisted in the database (not in-memory). The Telegram bot's `chatSessionId` is replaced with a DB-backed session lookup.
11. [ ] Delegation via tool use: the Self's LLM has tools (`start_dev_role({ role, task })`, `approve_review({ runId })`, `edit_review({ runId, feedback })`, `reject_review({ runId, reason })`). `start_dev_role` maps role name to `dev-{role}-standalone` process slug, calls `startProcessRun()` + `fullHeartbeat()`, captures the result, and returns it for the Self to synthesize. Each delegation is a proper process run through the full harness (trust, memory, feedback, audit trail).
12. [ ] Review mediation: when a process run is `waiting_review`, the Self can present the output and accept approve/edit/reject decisions from the human within the conversation. These map to `approveRun()`, `editRun()`, `rejectRun()`.
13. [ ] Cross-session memory: self-scoped memories are loaded on every conversation. If a self-scoped memory is manually inserted (e.g., via DB), it appears in the Self's context on the next conversation turn.
14. [ ] The Self's LLM calls use `createCompletion()` from `llm.ts` with tool_use for delegation — not `claude -p` subprocess, not through the harness pipeline. Only delegated process steps go through the harness.
15. [ ] Telegram bot free-text messages route through `selfConverse()`. Explicit commands (`/start`, `/status`) continue to work as before.
16. [ ] Integration tests cover: LLM abstraction (provider dispatch), context assembly (with/without memories, with/without active session), session create/resume/suspend lifecycle, work state summary query, delegation tool mapping (role → slug → startProcessRun).

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md` + `docs/adrs/016-conversational-self.md`
2. Review agent checks:
   - Does the Self sit above the harness (not inside it)?
   - Is the `self` memory scope consistent with ADR-003/ADR-016?
   - Does the session schema match ADR-016 section 4?
   - Are the UX spec's 10 design principles addressable with this implementation?
   - Is delegation to the harness via existing engine functions (not new plumbing)?
   - Are security constraints addressed (memory sanitization, no prompt injection)?
   - Is the brief implementable in one focused session?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Sync schema (adds self scope + sessions table)
pnpm cli sync

# 2. Verify cognitive/self.md exists and is readable
cat cognitive/self.md | head -5

# 3. Start the Telegram bot
TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<id> pnpm dev-bot

# 4. Send a message to the bot: "What's the current state of the project?"
# Expected: Self loads context, responds with work state summary
# (active runs, pending reviews, recent completions)
# Response should feel like a competent teammate briefing you, not a status dump

# 5. Send: "I want to add error handling to the CLI commands"
# Expected: Self assesses clarity, may ask 1-2 questions,
# then delegates to dev pipeline roles

# 6. Close terminal, wait 30+ minutes, send another message
# Expected: new session created, Self loads self-scoped memories,
# orients based on prior conversation context

# 7. Manually insert a self-scoped memory:
# sqlite3 data/ditto.db "INSERT INTO memories (id, scopeType, scopeId, type, content, source, reinforcementCount, confidence, active, createdAt, updatedAt) VALUES (lower(hex(randomblob(16))), 'self', 'creator', 'preference', 'Prefers terse responses with no trailing summaries', 'human', 1, 1.0, 1, unixepoch(), unixepoch())"
# Then send a message — the memory should influence the Self's response style
```

## After Completion

1. Update `docs/state.md` with what changed
2. Update `docs/roadmap.md` — mark Conversational Self MVP capabilities as done
3. Move this brief to `docs/briefs/complete/`
4. Update ADR-003: add `self` scope type to the documented scope model
5. Update ADR-015: clarify that Goal Framing is implemented through the Self's consultative conversation
6. Update ADR-012: note `llm.ts` as the concrete implementation of the model routing concept
7. Mark Insight-060 as absorbed (implemented by `llm.ts`)
8. Phase retrospective: what worked, what surprised, what to change
9. Next brief candidates:
   - Self-editing memory (post-conversation LLM reconciliation + self-level feedback capture)
   - Cognitive Architecture A1 (cognitive toolkit content enriches `cognitive/self.md`)
   - Multi-project context switching (Insight-052)
   - Goal Framing meta process formalization (ADR-015 section 3)
