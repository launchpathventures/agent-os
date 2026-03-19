# Landscape Analysis — Agent Orchestration & Framework Components

**Date:** 2026-03-18
**Purpose:** Scout the gold standard for each Agent OS component before building. "What can we build FROM?"

---

## Multi-Agent Orchestration Frameworks

### Tier 1: Strong foundations (TypeScript, active, directly usable)

**Mastra** — github.com/mastra-ai/mastra
- 22.1k stars | Active March 2026 | TypeScript 99%
- Graph-based workflow engine with `.then()`, `.branch()`, `.parallel()` DSL
- First-class suspend/resume for human-in-the-loop
- Zod-validated step inputs/outputs. 40+ model providers. MCP server support.
- **Agent OS relevance:** HIGH — could be workflow/harness foundation (Layers 1-3). Suspend/resume maps to trust tier pausing. Parallel groups map to `.parallel()`.
- **Limitation:** Enterprise features are paid. Monolithic — you adopt its opinions. No built-in trust tiers or maker-checker.

**Paperclip** — github.com/paperclipai/paperclip
- 28.1k stars | Active March 2026 | TypeScript 96%
- Heartbeat cycle (wake, execute, sleep). Adapter interface (`invoke/status/cancel`). Atomic task checkout. Budget controls. Immutable audit log. Governance rollback.
- **Agent OS relevance:** HIGH — architecture spec already borrows from it heavily (Layer 2). Working reference implementation.
- **Limitation:** Uses PostgreSQL. Full platform, not a library. React UI tightly coupled.

**Claude Agent SDK** — `@anthropic-ai/claude-code` on npm
- 5.5k stars (Python SDK) | Active March 2026
- Programmatic Claude Code orchestration. Custom tools as MCP servers. Hooks for intercepting tool use. Subagents and session forking.
- **Agent OS relevance:** HIGH for Layer 2. This is how we'd invoke Claude Code as an adapter. Hooks map to harness interception.
- **Limitation:** Claude-specific. JS SDK is CLI wrapper, not full agent SDK.

### Tier 2: Right concepts, wrong ecosystem

**LangGraph** — 26.7k stars | Python only
- Durable execution, graph interrupts for HITL, memory systems. Good conceptual model but can't use directly.

**CrewAI** — 46.4k stars | Python only
- YAML-based config, role-based collaboration. Validates our YAML approach but opposite philosophy (autonomous crews vs trust-first).

**OpenAI Agents SDK** — 20.1k stars | Python only
- Guardrails concept loosely maps to harness. Conversation-oriented, not process-oriented.

**AG2 (formerly AutoGen)** — 4.3k stars | Python only
- UserProxyAgent for HITL. Reviewer-agent patterns validate maker-checker concept.

---

## Workflow / Process Engines

**Trigger.dev** — github.com/triggerdotdev/trigger.dev
- 14.1k stars | Active March 2026 | TypeScript 98%
- Purpose-built for AI agent workflows. Durable execution, no timeouts. Waitpoint tokens for HITL. Supports all 5 Anthropic agent patterns.
- **Agent OS relevance:** HIGH alternative for Layer 2. Waitpoint tokens = trust-tier pause mechanism.
- **Limitation:** Requires infrastructure (cloud or self-hosted). Heavier than SQLite + cron.

**Inngest** — github.com/inngest/inngest
- 5k+ stars | Active March 2026 | Go server, TypeScript SDK
- Step-based durable execution. Event-driven triggers. AgentKit for multi-agent networks. `step.ai.wrap()` for reliable LLM calls.
- **Agent OS relevance:** HIGH — step-based execution maps to process steps. TypeScript-first SDK.
- **Limitation:** Requires Inngest server. SSPL license.

**Temporal** — TypeScript SDK 789 stars
- Industrial-grade. Activity heartbeats. Conceptually perfect but requires Java server. Overkill for dogfood.

**BullMQ** — 8.6k stars
- Parent/child job dependencies. Requires Redis. Job-oriented, not workflow-oriented.

---

## Projects from Architecture Spec Borrowing Table

**antfarm** — github.com/snarktank/antfarm
- 2.2k stars | Active Feb 2026 | TypeScript 71%
- YAML workflow definitions + SQLite state + cron-based polling. Independent verification agents. 7-agent pipelines.
- **Agent OS relevance:** Core reference for Layers 1, 3. "Developer doesn't mark own homework" = maker-checker. Closest existing implementation to process + harness model.

**ralph** — github.com/snarktank/ralph
- 13.1k stars | Active Jan 2026 | TypeScript 63%
- Autonomous loop with fresh context per iteration. Three-tier state: git history + progress.txt + prd.json.
- **Agent OS relevance:** Core reference for Layer 2 execution model. Validates flat-file state and zero-setup approach.

**gstack** — github.com/garrytan/gstack
- 21k stars | Active March 2026 | TypeScript 75%
- 13 specialized agent roles via slash commands. 80-item design audits. Browser-based testing.
- **Agent OS relevance:** Reference for Layers 2, 3. Role diversity validates our role-based system prompts.

**compound-product** — github.com/snarktank/compound-product
- 499 stars | Active Jan 2026 | Shell + JSON
- Self-improving product system. Analyse → identify priority → create PRD → execute → deliver PR.
- **Agent OS relevance:** Reference for Layer 5 and Self-Improvement Meta-Process.

---

## Storage, CLI, and Infrastructure

### Storage
| Option | Stars | Fit | Notes |
|--------|-------|-----|-------|
| **better-sqlite3** | 4.6k dependents | Best | Synchronous, fast, mature. Drizzle supports it. Swap driver, keep schema. |
| **Turso/libSQL** | - | Future | Local-first with optional cloud sync. Consider when scaling beyond single machine. |
| **Node.js built-in sqlite** | - | Watch | Experimental in Node 22.5+. Not production-ready yet. |
| **lowdb** | 21k | Config only | No query engine. Good for simple key-value, not transactional data. |
| **conf** | - | Config | Platform-correct config dir. Good for API keys, preferences. |

**Recommendation:** Drizzle ORM + better-sqlite3 for structured data. conf for user config.

### CLI
| Option | Stars | Fit | Notes |
|--------|-------|-----|-------|
| **@clack/prompts** | 5.1k dependents | Best (UX) | Beautiful prompts. Used by Astro, Svelte scaffolders. Perfect for approve/edit/reject. |
| **citty** (UnJS) | - | Best (routing) | TypeScript-first, ESM, minimal. Great type inference. |
| **Commander.js** | 27k | Established | Most widely used. Less TypeScript-native than citty. |
| **Ink** | - | Overkill | React for terminals. Too heavy for our needs. |
| **oclif** | - | Overkill | Enterprise-grade. Significant boilerplate. |

**Recommendation:** citty (command routing) + @clack/prompts (interactive UX).

---

## Agent Harness Patterns (Landscape Insight)

Research across five additional sources (March 2026) revealed a consistent emerging pattern: **nested harnesses** — each layer wrapping the runtime with progressively broader scope.

### The Babushka Model

Every serious agent system in the landscape implements some version of this nesting, though none names it explicitly:

| Layer | Scope | What it provides | Example |
|-------|-------|-----------------|---------|
| **Platform harness** | Cross-process | Governance, trust, dependency graph, learning | Agent OS (our product) |
| **Process harness** | Per-process | Review patterns, quality gates, escalation, process memory | Sim Studio workflow, Open SWE thread |
| **Agent harness** | Per-agent | Identity, capabilities, agent memory, tool permissions, budget | agents.md + memory.md + skills/ |
| **Runtime** | Per-invocation | The actual LLM or script execution | Claude, GPT, script adapter |

**Architectural implication for Agent OS:** Our current Layer 2 treats agents as stateless adapters (`invoke()` / `status()` / `cancel()`). The landscape shows each agent needs a persistent operating context — identity, memory, tools, permissions — that travels with it across process assignments. This "agent harness" sits between the adapter pattern and the process harness. See architecture.md for the formalised model.

### Memory Tiers in the Landscape

| Tier | Pattern | Who uses it | Limitation |
|------|---------|-------------|------------|
| **File-based** | memory.md, CLAUDE.md | Claude Code, Cursor, "AI Agent OS" practitioner pattern | No query capability, no multi-agent coordination, no schema enforcement |
| **Thread-scoped** | Message history + metadata | Open SWE (LangGraph threads), Sim Studio (execution state) | Ephemeral — dies with the thread/run |
| **Database-per-agent** | Serverless Postgres with branching | Deeplake, db9.ai, Neon | Full SQL queryability, heavyweight infrastructure |

**Agent OS approach:** Hybrid — process memory for process-specific learning (correction patterns, quality criteria), agent memory for cross-cutting capabilities (coding style, tool preferences, domain expertise). The harness merges both at invocation time. Start with SQLite (`memory` table with `scope_type` + `scope_id`), scale to dedicated storage when needed.

### Patterns Worth Adopting

| Pattern | Source | How it applies to Agent OS |
|---------|--------|---------------------------|
| Handler registry | Sim Studio | Step executor should use registered handlers, not switch statements |
| Execution snapshot/resume | Sim Studio | Serialize full process run context for heartbeat pause/resume |
| Safety-net middleware | Open SWE | Post-agent middleware enforcing structural guarantees the LLM might miss |
| Deterministic thread IDs | Open SWE | Hash `process-id:trigger-event` into stable run IDs for continuity |
| Mid-run message injection | Open SWE | Queue human context for injection before next step, don't interrupt |
| Handoff template taxonomy | agency-agents | 7 handoff types (standard, QA pass/fail, escalation, phase gate, sprint, incident) |
| Skills as progressive disclosure | "AI Agent OS" practitioner pattern | Load agent capabilities on demand to keep context lean |

### Non-Technical User Approaches in the Landscape

| Approach | Example | Trade-off |
|----------|---------|-----------|
| **Visual DAG builder** | Sim Studio (27K stars) | Powerful but overwhelming — 100+ block types |
| **Markdown files** | "AI Agent OS" practitioner pattern | Low floor, low ceiling — works until it doesn't |
| **Conversational** | Agent OS (our architecture) | Highest accessibility, hardest to build |
| **Prompt library** | agency-agents (54K stars) | Technical users only despite non-technical marketing |

The "AI Agent OS" practitioner pattern's key insight: **frame agents as employees**. The onboarding metaphor (job description → training manual → tools → institutional knowledge) maps to familiar business processes. Non-technical users know how to hire and manage people — they don't know how to configure workflows. Agent OS's Explore mode conversational interface aligns with this, but our Process Builder should feel more like editing a document than configuring a workflow tool.

---

## Additional Sources (March 2026)

### agency-agents — github.com/msitarzewski/agency-agents
- 54k stars | Active March 2026 | Shell (conversion scripts) + Markdown
- ~130 agent persona definitions across 9 divisions. NEXUS coordination framework with handoff templates and quality gates.
- **Not a runtime or engine.** Prompt library with the human as orchestration bus — copy-paste between agents.
- **Agent OS relevance:** LOW for architecture, MEDIUM for patterns. Handoff template taxonomy (7 types) is a useful schema for inter-step messaging. Quality gate pattern (dev↔QA loop with max retries and escalation) maps to harness review patterns. The Workflow Architect agent's spec format (handoff contracts, cleanup inventories, observable states) is genuine process design methodology.
- **What NOT to adopt:** The fundamental approach. Human-as-bus is the exact problem Agent OS solves. 130+ persona definitions optimised for breadth, not depth.

### Sim Studio — github.com/simstudioai/sim
- 27k stars | Active March 2026 | TypeScript (monorepo: Next.js + Drizzle + PostgreSQL)
- Visual workflow builder: drag blocks on ReactFlow canvas, connect with edges, trigger via webhooks/cron/chat.
- **DAG executor** with 5-phase graph construction, queue-based concurrent execution, 14 block handlers via registry pattern.
- **Execution snapshot/resume** serialises full context to JSON for pause/resume — directly relevant to our heartbeat model.
- **Variable resolver chain** (Loop → Parallel → Workflow → Env → Block) for data flow between blocks.
- **Human-in-the-loop as first-class block type**, not bolted-on approval.
- **Agent OS relevance:** HIGH for execution patterns. Handler registry, snapshot/resume, and variable resolution are battle-tested solutions to problems we face in Phase 2. Not architecturally aligned (workflow-as-harness, not process-as-primitive; no trust tiers or graduated autonomy; ephemeral runs, not durable processes).
- **Composition opportunity:** Study executor patterns when building Phase 2 harness and heartbeat rewrite.

### Open SWE — github.com/langchain-ai/open-swe
- Active March 2026 | Python | Built on LangGraph + Deep Agents
- Async coding agent harness. Humans trigger from Slack/Linear/GitHub, agent clones repo into sandbox, works, opens PR.
- **Closest to "harness is the product" thesis.** The framework provides orchestration, context, sandboxing, safety nets — the agent itself is pluggable.
- **Key patterns:**
  - Single-function agent assembly (`get_agent()`) — the harness is explicit and inspectable
  - Deterministic thread IDs (hash source event → stable UUID) for process continuity
  - Message queue + before_model middleware for mid-run human input injection
  - Safety-net middleware (`open_pr_if_needed`) — structural guarantees over behavioural prompting
  - `AGENTS.md` as repo-level process configuration injected into system prompt
  - Sandbox-as-trust-boundary with 5 pluggable backends via protocol pattern
- **Agent OS relevance:** HIGH for harness patterns, MEDIUM for direct adoption (Python, single-purpose). The middleware patterns (safety nets, error normalisation, message queuing) map directly to our harness layer. The `get_agent()` assembly function is a clean reference for how our agent harness should compose identity + memory + tools + permissions before handing off to the runtime adapter.

### Deeplake / db9.ai — Agent-Native Databases
- **Core argument:** Databases were built for applications, not agents. Agents need sandboxed, branching-capable, multimodal storage — not memory.md files and not shared production databases.
- **Serverless Postgres per agent** with copy-on-write branching (experiment without risk), scale-to-zero economics, and multimodal storage (vectors, images, video, relational data in one system).
- **Challenges to memory.md pattern:** No query capability, no multi-agent coordination, no schema enforcement, no branching/versioning. Fine for single-agent scratchpads, breaks for production multi-agent systems.
- **Agent OS relevance:** MEDIUM — validates our need for structured memory beyond flat files. Our SQLite approach is a pragmatic middle ground: queryable, schema-enforced, lightweight. The branching concept is interesting for trust tiers (agent works on a "branch," human approves the "merge"). Deferred to scale phase — serverless Postgres per agent is infrastructure we don't need for dogfood.

### "AI Agent OS" Practitioner Pattern — (Greg Isenberg / Remy Gaskell, March 2026)
- Practitioner guide for building "digital employees" using Claude Code / Cursor / Codex.
- **Folder-structure-as-harness:** agents.md (brain/identity), memory.md (persistent learning), skills/ (SOPs as markdown), MCP (tool connections). The folder IS the agent's operating context.
- **Key patterns:**
  - `agents.md` as structured persona (role, mission, rules, deliverables, communication style, success metrics)
  - `memory.md` as agent-written persistent learning (corrections, preferences, domain knowledge) — self-improving loop
  - Skills as progressive disclosure — load on demand, not upfront, to keep context lean
  - "Choose your vehicle, the engine is the same" — harness wraps runtime at multiple levels
  - Hiring metaphor for non-technical users: job description → training manual → tools → institutional knowledge
- **Agent OS relevance:** HIGH for non-technical user framing, MEDIUM for architecture. Validates our Explore mode and conversational setup. The folder-structure-as-harness is what non-technical users are already doing manually — Agent OS should automate and formalise this pattern with governance, trust, and learning on top.

---

## What's Genuinely Ours to Build

No existing framework implements these — they are Agent OS's unique value:

1. **Progressive trust tiers** — supervised → spot-checked → autonomous, earned through track record. Every framework is binary (human checks everything, or nothing).
2. **Trust earning with data** — approval rates, correction rates, review cycles driving upgrade suggestions.
3. **Process-first model** — every framework is agent-first or task-first. Process as the primitive is original.
4. **Implicit feedback capture** — edits-as-feedback, correction pattern extraction from diffs.
5. **Explore → Operate transition** — conversation crystallising into process definition.
6. **Governance function** — agents providing cross-cutting compliance assurance across individuals, teams, organisations.
7. **Agent authentication** — identity, permissions, and provenance for agents entering the harness.

---

## Pragmatic Path for Dogfood

For the coding agent team (first implementation):

- **Adopt antfarm's pattern:** YAML + SQLite + sequential execution with verification gates
- **Adopt ralph's state model:** Flat files for context, git for history
- **Adopt Paperclip's adapter interface:** `invoke()` / `status()` / `cancel()`
- **Use Drizzle + better-sqlite3:** Swap driver, keep existing schema structure
- **Use citty + @clack/prompts:** Modern TypeScript CLI stack
- **Build our own:** Trust tier enforcement, maker-checker harness, feedback capture, governance
- **Defer infrastructure** (Inngest/Trigger.dev/Mastra) to when durable execution at scale is needed
