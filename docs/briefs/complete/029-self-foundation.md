# Brief 029: Self Foundation

**Date:** 2026-03-23
**Status:** ready
**Depends on:** Brief 027 (Telegram Bot Engine Bridge — complete), ADR-016 (accepted)
**Unlocks:** Brief 030 (Self Engine)

## Goal

- **Roadmap phase:** Conversational Self MVP (parallel with Phase 6, before Phase 10)
- **Capabilities:** LLM provider abstraction, `self` memory scope, sessions table, cognitive framework file, standalone role processes

## Context

This is sub-brief 1 of 2 for the Conversational Self MVP (parent: Brief 028). It creates the infrastructure that the Self Engine (Brief 030) consumes: the LLM abstraction layer, schema additions, cognitive framework content, and standalone process definitions for delegation.

See Brief 028 for full context, non-goals, constraints, and UX design.

## Non-Goals

Same as Brief 028. Additionally:
- This brief does NOT implement `selfConverse()`, context assembly, session lifecycle, delegation logic, or Telegram integration — those are Brief 030.

## Inputs

1. `docs/adrs/016-conversational-self.md` — sections 2-4 (context assembly, memory scope, sessions)
2. `docs/insights/060-llm-provider-abstraction.md` — LLM coupling concern
3. `src/adapters/claude.ts` — existing Anthropic SDK usage to migrate
4. `src/engine/system-agents/router.ts` — existing Anthropic SDK usage to migrate
5. `src/engine/harness-handlers/review-pattern.ts` — existing Anthropic SDK usage to migrate
6. `src/db/schema.ts` — current schema to extend
7. `docs/research/conversational-self-ux.md` — communication principles for `cognitive/self.md`
8. `docs/insights/049-consultative-not-configurative.md` — framing protocol for `cognitive/self.md`
9. `docs/insights/053-pm-consultative-framing.md` — consultative pattern for `cognitive/self.md`
10. `processes/dev-pipeline.yaml` — existing multi-step pipeline; standalone YAMLs mirror its roles

## Constraints

- `self` memory scope uses the same `memories` table (new `scope_type` value, no separate table).
- Session turns stored as JSON array (not separate rows).
- `cognitive/self.md` is a static file, not database-stored. Version-controlled, human-editable.
- LLM abstraction (`llm.ts`) is thin (~50 lines). Provider registry, not a framework. Initial provider: Anthropic only.
- The 3 existing `new Anthropic()` call sites must be migrated without changing their external behavior. All 88 existing tests must pass after migration.
- Standalone role YAMLs each have one step with `executor: cli-agent` and the appropriate `agent_role`. They are structurally identical except for the role name and description.

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| LLM provider abstraction | Insight-060, Vercel AI SDK pattern (unified interface) | Thin `createCompletion()` wrapper prevents 4th direct Anthropic coupling. Migrates 3 existing call sites. Provider-agnostic interface enables future model routing (ADR-012). |
| Self-scoped memory | Mem0 `mem0ai/mem0` scope filtering | Extraction-reconciliation already adopted in ADR-003. Extended to third scope. |
| Session persistence schema | LangGraph `langchain-ai/langgraph` checkpointing | State persistence across pauses. Adapted: conversation state, not execution state. |
| Cognitive framework as identity | Original to Ditto | Identity defined by reasoning approach and trade-off heuristics, not just memory + prompt. |
| Consultative framing protocol | Management consulting engagement models | Applied to AI interaction. Original to Ditto (Insight-053). |
| Standalone role processes | Option A from delegation model analysis | One single-step YAML per dev role. Each delegation is a proper process run through the full harness. Zero engine changes. |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/llm.ts` | Create: thin LLM provider abstraction. `createCompletion({ model, system, messages, tools? })` → `{ content, tokensUsed, costCents }`. Provider registry maps model identifiers to SDK clients. Initial provider: Anthropic (`@anthropic-ai/sdk`). ~50 lines. |
| `src/adapters/claude.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/engine/system-agents/router.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/engine/harness-handlers/review-pattern.ts` | Modify: replace direct `new Anthropic()` with `createCompletion()` from `llm.ts`. |
| `src/db/schema.ts` | Modify: add `"self"` to `memoryScopeTypeValues`. Add `sessions` table (id, userId, surface, startedAt, lastActiveAt, status, summary, turns). Add `sessionSurfaceValues` and `sessionStatusValues` enums. |
| `cognitive/self.md` | Create: the Self's cognitive framework file. Contains: consultative framing protocol (listen → assess clarity → ask → reflect → hand off), communication principles (competent/direct/warm/purposeful), trade-off heuristics (competence > personality, silence > noise, evidence > assumption), escalation sensitivity (when uncertain ask, when confident propose), dev pipeline domain context. ~800-1200 words. |
| `processes/dev-pm-standalone.yaml` | Create: single-step process for PM role. `executor: cli-agent`, `agent_role: pm`. |
| `processes/dev-researcher-standalone.yaml` | Create: single-step process for Researcher role. |
| `processes/dev-designer-standalone.yaml` | Create: single-step process for Designer role. |
| `processes/dev-architect-standalone.yaml` | Create: single-step process for Architect role. |
| `processes/dev-builder-standalone.yaml` | Create: single-step process for Builder role. |
| `processes/dev-reviewer-standalone.yaml` | Create: single-step process for Reviewer role. |
| `processes/dev-documenter-standalone.yaml` | Create: single-step process for Documenter role. |

## User Experience

- **Jobs affected:** None directly — this brief creates infrastructure consumed by Brief 030.
- **Primitives involved:** None directly.
- **Process-owner perspective:** No user-facing change. The LLM abstraction, schema additions, and YAML files are invisible to the creator until Brief 030 activates them.
- **Designer input:** `cognitive/self.md` content is informed by UX spec (`docs/research/conversational-self-ux.md`) communication principles and persona encounters. The file defines how the Self sounds and thinks — it is the most UX-sensitive artifact in this brief.

## Acceptance Criteria

1. [ ] `src/engine/llm.ts` exists with `createCompletion({ model, system, messages, tools? })` returning `{ content, tokensUsed, costCents }`. Anthropic is the initial provider. The 3 existing direct `new Anthropic()` call sites (`src/adapters/claude.ts`, `src/engine/system-agents/router.ts`, `src/engine/harness-handlers/review-pattern.ts`) are migrated to use it. All 88 existing tests still pass after migration.
2. [ ] `memoryScopeTypeValues` includes `"self"` alongside `"agent"` and `"process"` in `src/db/schema.ts`.
3. [ ] `sessions` table exists in schema with fields: `id`, `userId`, `surface`, `startedAt`, `lastActiveAt`, `status` (active/suspended/closed), `summary` (nullable), `turns` (JSON array).
4. [ ] `cognitive/self.md` exists with: consultative framing protocol, communication principles, trade-off heuristics, escalation sensitivity, dev pipeline domain context. Content is ~800-1200 words.
5. [ ] 7 standalone role process definitions exist in `processes/` (dev-pm-standalone.yaml through dev-documenter-standalone.yaml). Each has one step with `executor: cli-agent` and the appropriate `agent_role`. All load successfully via `pnpm cli sync`.

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md` + `docs/adrs/016-conversational-self.md`
2. Review agent checks:
   - Is `llm.ts` a thin abstraction (not a framework)?
   - Do all 88 existing tests pass after migration?
   - Is the `self` scope consistent with ADR-003/ADR-016?
   - Does the session schema match ADR-016 section 4?
   - Does `cognitive/self.md` implement the UX spec's communication principles?
   - Do standalone YAMLs load via `pnpm cli sync`?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Run existing tests — all 88 must pass after LLM abstraction migration
pnpm test

# 2. Verify type-check passes
pnpm run type-check

# 3. Sync schema — adds self scope + sessions table, loads standalone YAMLs
pnpm cli sync

# 4. Verify cognitive/self.md exists and contains expected sections
cat cognitive/self.md | head -20
# Expected: consultative framing protocol, communication principles visible

# 5. Verify standalone processes loaded
pnpm cli status
# Expected: 7 new processes listed (dev-pm-standalone through dev-documenter-standalone)

# 6. Verify self scope is recognized (insert + query)
sqlite3 data/ditto.db "INSERT INTO memories (id, scopeType, scopeId, type, content, source, reinforcementCount, confidence, active, createdAt, updatedAt) VALUES (lower(hex(randomblob(16))), 'self', 'creator', 'preference', 'Test memory', 'human', 1, 1.0, 1, unixepoch(), unixepoch())"
sqlite3 data/ditto.db "SELECT content FROM memories WHERE scopeType = 'self'"
# Expected: "Test memory"
```

## After Completion

1. Update `docs/state.md` with what changed
2. Mark Insight-060 as absorbed (implemented by `llm.ts`)
3. Proceed to Brief 030 (Self Engine)
