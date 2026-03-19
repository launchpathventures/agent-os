# Agent OS — Current State

**Last updated:** 2026-03-19
**Current phase:** Phase 1 (Storage) — COMPLETE. Phase 2 (Harness + Feedback Capture) — designed, split into 3 sub-briefs, ready for build.

---

## What's Working

- **Storage (SQLite)** — Postgres replaced with SQLite via better-sqlite3 + Drizzle ORM. Zero-setup: `pnpm install` → `pnpm cli sync` works on fresh clone. WAL mode enabled. DB auto-created at `data/agent-os.db`. ADR-001 written.
- **Process definitions** — 5 YAML processes in `processes/` (feature-implementation, code-review, bug-investigation, project-orchestration, self-improvement). Well-structured, faithful to architecture.
- **Claude adapter** — `src/adapters/claude.ts` with 10 role-based system prompts.
- **Script adapter** — `src/adapters/script.ts` handles deterministic steps with on_failure.
- **Process loader** — `src/engine/process-loader.ts` parses YAML and syncs to SQLite.
- **CLI** — `pnpm cli sync`, `pnpm cli status`, `pnpm cli start`, `pnpm cli review`, `pnpm cli approve`, `pnpm cli capture` all functional against SQLite.
- **Governance scaffolding** — All Phase 0 docs complete. Agent identity fields present in schema (nullable, governance readiness).
- **Review loop** — Tested 6 times (3x Phase 0 + 1x Phase 1 + 1x dev-process + 1x Phase 2 brief). Found real issues each time.
- **Development process** — 6 meta-roles formalised as Claude Code skills (`/dev-pm`, `/dev-researcher`, `/dev-architect`, `/dev-builder`, `/dev-reviewer`, `/dev-documenter`). Reference: `docs/dev-process.md`.
- **Insights system** — `docs/insights/` for design discoveries. Four insights captured: quality criteria are additive (001), nested agent harnesses (002), review is compositional (002), learning overhead is a dial (003), briefs should be one build cycle (004).
- **Research system** — `docs/research/` for persisting research findings across sessions (ADR-002). Two reports: Phase 2 harness patterns, memory systems.
- **Dev process improvements** — Skill commands now enforce mandatory review loop (researcher, architect, builder all spawn reviewer before presenting work). Skills also check ADRs and insights.

## What Needs Rework

- **Heartbeat** — `src/engine/heartbeat.ts` auto-approves everything (line 164). No harness, no trust enforcement, no parallel execution. Phase 2a.
- **Step executor** — `src/engine/step-executor.ts` is pure routing. Needs parallel group support. Phase 2c.
- **CLI** — `src/cli.ts` is generic CRUD. Needs to map to six human jobs. Phase 4.

## What's Blocked

Nothing. Phase 2a is ready for `/dev-builder`.

## Known Issues

- `ai-agent` is the standard (matches YAML and step executor). Schema uses text columns so the `ai_agent` vs `ai-agent` enum mismatch is resolved.
- `rules` executor type defined in TypeScript union but no implementation. Needs roadmap entry or removal.
- Architecture.md references ADR-001 which now exists.
- ADR-003 needs a "Phased Implementation" section (Phase 2 = schema + assembly; Phase 3 = LLM reconciliation). Builder adds this during Phase 2b.

## Decisions Made

| Decision | ADR | Status |
|----------|-----|--------|
| SQLite via Drizzle + better-sqlite3 | ADR-001 | **Done** |
| Research reports as durable artifacts | ADR-002 | **Proposed** — awaiting formal approval |
| Memory architecture (two-scope, no vectors, Mem0 reconciliation) | ADR-003 | **Proposed** — reviewed and approved by reviewer |
| Harness as middleware pipeline | Designed in Phase 2 briefs | **Designed** — awaiting build |
| Parallel execution via Promise.all | Designed in Phase 2c brief | **Designed** — awaiting build |
| Trust earning through human feedback | ADR-006 (to write) | Planned — Phase 3 |
| citty + @clack/prompts for CLI | ADR-007 (to write) | Planned — Phase 4 |

## Phase 2 Design Documents

| Document | Purpose |
|----------|---------|
| `docs/briefs/phase-2-harness.md` | Parent design — full Phase 2 architecture (7 subsystems, design reference) |
| `docs/briefs/phase-2a-pipeline-trust-heartbeat.md` | Sub-brief: harness pipeline skeleton + trust gate + heartbeat rewrite (17 AC) |
| `docs/briefs/phase-2b-review-memory.md` | Sub-brief: review patterns + memory table + assembly (15 AC) |
| `docs/briefs/phase-2c-parallel-feedback.md` | Sub-brief: parallel execution + depends_on + complete feedback data (15 AC) |

Build order: 2a → 2b → 2c (each unlocks the next).

## Next Step

Invoke `/dev-builder` for Phase 2a (`docs/briefs/phase-2a-pipeline-trust-heartbeat.md`).
