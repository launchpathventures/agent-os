# Agent OS — Roadmap

**Last updated:** 2026-03-18
**Current phase:** Phase 1 (Storage) — COMPLETE. Phase 2 next.

This is the complete capability map for Agent OS. Every item traces back to the architecture spec, human-layer design, or landscape analysis. Status is tracked per item. Nothing is silently omitted — deferred items have explicit re-entry conditions.

---

## How to Read This

- **Status:** not started | in progress | done | deferred
- **Source doc:** which design document defines this capability
- **Build from:** which open-source project provides the pattern (or "Original" if unique to Agent OS)
- **Re-entry:** for deferred items, what condition triggers re-entry

---

## Phase 0: Scaffolding (Current)

| Capability | Status | Deliverable |
|-----------|--------|-------------|
| Persistent agent context | done | `CLAUDE.md` |
| Vision document | done | `docs/vision.md` |
| Dictionary / glossary | done | `docs/dictionary.md` |
| Roadmap (this document) | done | `docs/roadmap.md` |
| Current state tracking | done | `docs/state.md` |
| Architecture review checklist | done | `docs/review-checklist.md` |
| ADR template | done | `docs/adrs/000-template.md` |
| Phase 1 task brief | done | `docs/briefs/phase-1-storage.md` |
| AGENTS.md update | done | `AGENTS.md` |

---

## Phase 1: Storage

**Objective:** Replace Postgres with SQLite. Zero-setup: `pnpm cli sync` works on fresh clone.

| Capability | Status | Source doc | Build from | Deliverable |
|-----------|--------|-----------|------------|-------------|
| SQLite via Drizzle ORM | done | architecture.md | antfarm `/src/db.ts` + Drizzle SQLite dialect | `src/db/schema.ts` rewrite |
| WAL mode, auto-create DB | done | landscape.md | antfarm, better-sqlite3 | `src/db/index.ts` rewrite |
| Agent identity fields in schema | done | architecture.md (Governance) | Original | `agents` table: ownerId, orgId, permissions, provenance |
| Process loader → SQLite | done | architecture.md L1 | Keep existing, update DB calls | `src/engine/process-loader.ts` |
| ADR-001 written | done | — | — | `docs/adrs/001-sqlite.md` |

---

## Phase 2: Harness + Feedback Capture

**Objective:** Build the core differentiator — review patterns, trust enforcement, parallel execution. Record every harness decision as feedback from day one.

| Capability | Status | Source doc | Build from | Deliverable |
|-----------|--------|-----------|------------|-------------|
| **Review patterns** | | | | |
| Maker-checker | not started | architecture.md L3 | antfarm `/src/installer/step-ops.ts` (verify_each) | `src/engine/harness.ts` |
| Adversarial review | not started | architecture.md L3 | antfarm verifier agent pattern | `src/engine/harness.ts` |
| Specification testing | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| Ensemble consensus | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| **Trust enforcement** | | | | |
| Supervised tier (always pause) | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| Spot-checked tier (~20% pause) | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| Autonomous tier (exception only) | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| Critical tier (always pause, never upgrades) | not started | architecture.md L3 | Original | `src/engine/harness.ts` |
| **Parallel execution** | | | | |
| parallel_group via Promise.all | not started | architecture.md L2 | Extends antfarm (sequential only) | `src/engine/heartbeat.ts` |
| depends_on resolution | not started | architecture.md L2 | Process YAML structure | `src/engine/heartbeat.ts` |
| **Feedback from day one** | | | | |
| Record every harness decision | not started | architecture.md L5 | Paperclip `/server/src/services/activity-log.ts` | `src/engine/harness.ts` |
| Agent permission checks | not started | architecture.md (Governance) | Original | `src/engine/harness.ts` |
| **Heartbeat rewrite** | | | | |
| Harness pipeline integration | not started | architecture.md L2-3 | Paperclip `/server/src/services/heartbeat.ts` | `src/engine/heartbeat.ts` |
| ADR-002, ADR-003 written | not started | — | — | `docs/adrs/` |

---

## Phase 3: Trust Earning

**Objective:** Human feedback path (approve/edit/reject) drives progressive trust accumulation. Upgrade suggestions when thresholds met. Never auto-upgrade.

| Capability | Status | Source doc | Build from | Deliverable |
|-----------|--------|-----------|------------|-------------|
| Record human feedback (approve/edit/reject) | not started | architecture.md L5 | Paperclip audit pattern | `src/engine/trust.ts` |
| Capture diffs for edits | not started | architecture.md L5 | Original (implicit feedback) | `src/engine/trust.ts` |
| Trust data accumulation | not started | architecture.md L3 | Paperclip `/server/src/services/costs.ts` (accumulation pattern) | `src/engine/trust.ts` |
| Upgrade eligibility check | not started | architecture.md L3 | Original | `src/engine/trust.ts` |
| Downgrade trigger check (2 of 4) | not started | architecture.md L3 | Original | `src/engine/trust.ts` |
| ADR-004 written | not started | — | — | `docs/adrs/004-trust.md` |

---

## Phase 4: CLI

**Objective:** CLI maps to the six human jobs. Architecture-aligned, not generic CRUD.

| Capability | Status | Source doc | Build from | Deliverable |
|-----------|--------|-----------|------------|-------------|
| Command routing (citty) | not started | landscape.md | citty `/src/command.ts` | `src/cli.ts` |
| Interactive UX (@clack/prompts) | not started | landscape.md | @clack/prompts | `src/cli.ts` |
| Orient: `status` | not started | human-layer.md (Daily Brief) | — | CLI command |
| Review: `review`, `approve`, `edit`, `reject` | not started | human-layer.md (Review Queue) | Paperclip approval flow | CLI commands |
| Define: `sync`, `start` | not started | architecture.md L1 | Keep existing patterns | CLI commands |
| Capture: `capture` | not started | human-layer.md (Quick Capture) | — | CLI command |
| Decide: `trust` | not started | architecture.md L3 | Original | CLI command |
| ADR-005 written | not started | — | — | `docs/adrs/005-cli.md` |

---

## Phase 5: End-to-End Verification

**Objective:** Run feature-implementation process end-to-end proving all layers work together.

| Capability | Status | Source doc | Build from | Deliverable |
|-----------|--------|-----------|------------|-------------|
| Full process run (sync → start → review → approve → trust) | not started | PROMPT.md | — | Successful run |
| All 6 layers proven working | not started | architecture.md | — | Verification report |

---

## Future Phases (sequenced but not scheduled)

### Phase 6: Layer 4 — Awareness

**Re-entry condition:** 2+ processes running and producing outputs

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Process dependency graph | architecture.md L4 | Schema exists (`processDependencies` table) |
| Event propagation on output | architecture.md L4 | Original |
| Impact propagation ("if I change X, these processes affected") | architecture.md L4 | Original |
| Remaining 2 trust downgrade triggers (downstream reports, input changes) | architecture.md L3 | Requires L4 |

### Phase 7: Layer 5 — Learning (Full)

**Re-entry condition:** 50+ feedback records exist

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Correction pattern extraction from diffs | architecture.md L5 | Original (implicit feedback) |
| Performance decay detection | architecture.md L5 | Original |
| Improvement proposal generation | architecture.md L5 | compound-product self-improvement cycle |
| Three feedback signals: output quality, process efficiency, outcome impact | architecture.md L5 | Original |
| "Teach this" button — bridge feedback to permanent learning | human-layer.md (Feedback Widget) | Original |

### Phase 8: Self-Improvement Meta-Process

**Re-entry condition:** Layer 5 (Learning) is live

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Weekly scan agent | architecture.md (Self-Improvement) | compound-product analyse → propose cycle |
| Improvement proposals in review queue | architecture.md L5 | compound-product |
| Approved improvements → feature-implementation handoff | architecture.md (Process 3) | Process YAML exists |

### Phase 9: Web Dashboard

**Re-entry condition:** CLI proves the model works (Phase 5 complete)

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| **16 UI Primitives** | | |
| Daily Brief | human-layer.md | Original design |
| Process Card (glance + expanded) | human-layer.md | Original design |
| Activity Feed | human-layer.md | Original design |
| Performance Sparkline | human-layer.md | Original design |
| Review Queue | human-layer.md | Original design |
| Output Viewer (6 output types) | human-layer.md | Original design |
| Feedback Widget (implicit capture) | human-layer.md | Original design |
| Conversation Thread | human-layer.md | Original design |
| Process Builder | human-layer.md | Original design |
| Agent Card | human-layer.md | Original design |
| Trust Control | human-layer.md | Original design |
| Quick Capture | human-layer.md | Original design |
| Improvement Card | human-layer.md | Original design |
| Process Graph | human-layer.md | Original design |
| Data View | human-layer.md | Original design |
| Evidence Trail | human-layer.md | Original design |
| **8 View Compositions** | | |
| Home (Daily Brief + Review Queue top 5 + Quick Capture) | human-layer.md | Original |
| Review (full queue + Output Viewer + Feedback Widget) | human-layer.md | Original |
| Processes (grid/list + Process Graph toggle) | human-layer.md | Original |
| Process Detail (expanded card + Activity Feed + Sparklines + Trust) | human-layer.md | Original |
| Setup (Conversation Thread + Process Builder dual pane) | human-layer.md | Original |
| Team (Agent Cards + Sparklines + cost) | human-layer.md | Original |
| Improvements (Improvement Cards + trends) | human-layer.md | Original |
| Capture (full screen Quick Capture) | human-layer.md | Original |
| **Interaction Patterns** | | |
| Approve / Edit / Reject / Escalate flow | human-layer.md | Original |
| "Auto-approve similar" (trust earning via review queue) | human-layer.md | Original |
| "Teach this" (bridge feedback to learning) | human-layer.md | Original |
| "Approve batch" / "Spot-check N" | human-layer.md | Original |
| Progressive disclosure (boiling frog) | human-layer.md | Original |
| **Tech stack** | | |
| Next.js + React + shadcn/ui + Tailwind | architecture.md | 2026 default stack |
| API layer (REST + WebSocket) | architecture.md | Standard patterns |
| Real-time dashboard updates | architecture.md | WebSocket |

### Phase 10: Explore → Operate Transition

**Re-entry condition:** Web dashboard exists (Phase 9)

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Conversation crystallises into process definition | architecture.md (Core Thesis) | Original |
| System Analyst AI (meta-agent for setup) | human-layer.md | Original |
| Capability Catalog (guided discovery, not app store) | human-layer.md | APQC/ITIL base knowledge |
| Progressive disclosure in setup flow | human-layer.md | Original |

### Phase 11: Governance at Scale

**Re-entry condition:** Multi-process orchestration working

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Governance agent/team | architecture.md (Governance) | Original |
| Cross-scope compliance (individual, team, organisation) | architecture.md (Governance) | Original |
| Agent authentication enforcement | architecture.md (Governance) | Schema fields from Phase 1 |
| Permission scoping per process/environment | architecture.md (Governance) | Original |
| Full audit trail with compliance reporting | architecture.md (Governance) | Paperclip activity-log pattern |

### Phase 12: Multi-Domain & Scale

**Re-entry condition:** Dogfood proven, ready for second domain

| Capability | Source doc | Build from |
|-----------|-----------|------------|
| Multi-tenancy | architecture.md (Open Questions) | Paperclip (built-in from day one) |
| Industry standard template library (APQC, ITIL) | architecture.md L1 | Original |
| Mobile (PWA → native) | architecture.md | Progressive enhancement |
| Session persistence across heartbeats | architecture.md L2 | Paperclip session codec |
| Budget enforcement (hard stops) | architecture.md L2 | Paperclip `/server/src/services/budgets.ts` |

---

## Deferred Infrastructure (re-evaluate as scale demands)

| Component | What it provides | When to re-evaluate | Source |
|-----------|-----------------|-------------------|--------|
| Inngest | Step-based durable execution, event-driven triggers | When process steps need retry/recovery at scale | landscape.md |
| Trigger.dev | AI agent workflows, waitpoint tokens for HITL | When durable execution beyond SQLite is needed | landscape.md |
| Mastra | Graph-based workflow DSL, suspend/resume | When workflow complexity exceeds our heartbeat model | landscape.md |
| Temporal | Industrial-grade durable execution | When enterprise reliability requirements emerge | landscape.md |
| Turso/libSQL | Local-first with cloud sync | When scaling beyond single machine | landscape.md |
| Rules engine executor | `rules` step executor type (in schema, no implementation) | When deterministic logic steps are needed beyond scripts | architecture.md |

---

## Adopted Patterns (in use or planned)

| Pattern | Source | Where used |
|---------|--------|-----------|
| YAML + SQLite + cron | antfarm | Phases 1-2: process definitions + state |
| Flat files for context, git for history | ralph | Phase 2: agent context model |
| Heartbeat execution (wake/execute/sleep) | Paperclip | Phase 2: heartbeat engine |
| Adapter interface (invoke/status/cancel) | Paperclip | Phase 2: agent adapters (already built) |
| Verification gates (verify_each + verify_step) | antfarm | Phase 2: harness maker-checker |
| Role-based system prompts | gstack | Phase 2: Claude adapter (already built, 10 roles) |
| Self-improvement cycle (analyse → propose → PR) | compound-product | Phase 8 |
| Drizzle ORM + better-sqlite3 | bun-elysia-drizzle-sqlite | Phase 1 |
| citty (CLI routing) | UnJS ecosystem | Phase 4 |
| @clack/prompts (CLI UX) | Astro/Svelte scaffolders | Phase 4 |
| Three-file agent briefing (AGENTS.md + SOUL.md + IDENTITY.md) | antfarm | Phase 0: briefing system |
| SKILL.md per capability | Paperclip | Phase 0: brief structure |
| Architecture review as agent skill | Paperclip pr-report | Phase 0: review loop |

---

## What's Original to Agent OS

These capabilities have no equivalent in existing frameworks:

1. **Progressive trust tiers** — supervised → spot-checked → autonomous, earned through track record
2. **Trust earning with data** — approval rates, correction rates, review cycles driving upgrade suggestions
3. **Process-first model** — every framework is agent-first or task-first
4. **Implicit feedback capture** — edits-as-feedback, correction pattern extraction
5. **Explore → Operate transition** — conversation crystallising into process definition
6. **Governance function** — agents providing cross-cutting compliance assurance
7. **Agent authentication** — identity, permissions, provenance for agents entering the harness
8. **16 universal UI primitives** — domain-agnostic composable interface
9. **The compound effect** — trust + learning + self-improvement compounding over time
