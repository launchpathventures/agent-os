# Claude Managed Agents — Architectural & Strategic Review for Ditto

**Date:** 2026-04-09
**Status:** Complete
**Consumer:** Architect, PM, Builder
**Source:** https://platform.claude.com/docs/en/managed-agents/overview

---

## Executive Summary

Claude Managed Agents is Anthropic's hosted agent harness — a managed infrastructure service where Claude runs autonomously inside containers with built-in tools, memory, outcomes evaluation, and multi-agent coordination. It launched in beta (April 2026) and represents Anthropic's direct entry into the "agent harness" space that Ditto occupies.

**The verdict:** This is not a competitor to Ditto — it is a potential **runtime substrate** for Ditto. Managed Agents provides the container, agent loop, and tool execution that Ditto currently builds with local adapters. Ditto's differentiation — process governance, trust tiers, learning loops, organizational memory, and the human layer — sits entirely above what Managed Agents offers. The strategic question is not "does this replace Ditto?" but "should Ditto run ON this?"

---

## 1. What Managed Agents Is

### Core Concepts

| Concept | What it is | Ditto equivalent |
|---------|-----------|-----------------|
| **Agent** | Versioned config: model + system prompt + tools + MCP servers + skills | Agent harness (Layer 2) — but without trust, memory, or governance |
| **Environment** | Container template with packages, network rules, file mounts | No direct equivalent — Ditto runs locally or on user infrastructure |
| **Session** | Running agent instance with persistent filesystem and conversation history | `sessions` table + heartbeat execution model |
| **Events** | SSE-based message exchange (user events in, agent/session events out) | `harness-events.ts` typed event emitter |

### Capabilities Breakdown

| Capability | Managed Agents | Ditto |
|-----------|---------------|-------|
| Agent loop | Managed (Claude runs autonomously) | Self-managed (heartbeat model, adapter pattern) |
| Tool execution | 8 built-in tools (bash, file ops, web search/fetch) + custom tools + MCP | 5 codebase tools + integration tools (YAML registry) + MCP deferred |
| Streaming | SSE with typed events, interrupts, mid-stream steering | SSE via `/api/events` + Claude CLI `--include-partial-messages` |
| Memory | Managed memory stores (workspace-scoped, path-based, versioned, auditable) | 4 memory scopes (agent, process, self, person) in SQLite `memories` table |
| Multi-agent | Coordinator → callable agents, shared filesystem, isolated threads | Maker-checker review patterns, standalone delegation roles |
| Outcomes | Rubric-based grading with separate evaluator, iterative refinement | Quality criteria on processes, trust-gated review, metacognitive checks |
| Versioning | Agent configs versioned (integer, optimistic concurrency) | Process definitions in YAML, no formal versioning yet |
| Cost tracking | Token counts in `span.model_request_end` events | Per-step cost tracking, budget controls, model routing recommendations |
| Custom tools | Client-executed tools with JSON schema | Integration tools via YAML registry + REST/CLI handlers |
| Permission model | `always_allow` / `always_ask` per tool | Trust tiers + confidence override + session trust overrides |

---

## 2. Architectural Alignment — Layer by Layer

### Layer 1 (Process) — No overlap

Managed Agents has **no concept of process**. It has agents and sessions. A session is a conversation, not a governed workflow with steps, quality criteria, feedback loops, and trust levels. This is Ditto's core differentiator and it remains entirely untouched.

**Implication:** Ditto's process primitive is orthogonal to Managed Agents. Processes would orchestrate Managed Agents sessions, not compete with them.

### Layer 2 (Agent) — Significant overlap, different abstraction

Managed Agents provides agent configuration (model, system prompt, tools, MCP) and execution (container, tool execution, streaming). This maps to Ditto's adapter pattern + agent harness assembly.

**Key differences:**
- Managed Agents agents are **stateless configs**. Ditto's agent harness assembles identity + memory + tools + permissions + budget at invocation time.
- Managed Agents runs in **Anthropic's cloud containers**. Ditto runs wherever the user's infrastructure is.
- Managed Agents is **Claude-only**. Ditto's adapter pattern supports any LLM provider.

**Implication:** Managed Agents could be a new adapter type alongside `claude-api`, `cli`, and `script`. The agent harness assembly (memory injection, tool authorization, budget checks) would happen in Ditto before delegating execution to a Managed Agents session.

### Layer 3 (Harness) — Partial overlap in "Outcomes"

The Outcomes feature (rubric-based grading with a separate evaluator context) is architecturally similar to Ditto's review patterns — specifically **specification testing** (validation agent checks output against defined criteria). The grader runs in a separate context window, which mirrors Ditto's maker-checker separation principle.

**Key differences:**
- Managed Agents outcomes are **per-session, rubric-driven**. Ditto's review patterns are **per-process, per-step, trust-tier-gated**.
- Managed Agents iterates up to 20 times automatically. Ditto routes to human review based on trust tier and confidence.
- Managed Agents has no concept of trust earning or degradation.

**Implication:** The Outcomes grader pattern validates Ditto's review architecture. Consider whether Ditto's spec-testing review pattern could use Managed Agents' grader as an execution backend when running on Anthropic infrastructure.

### Layer 4 (Awareness) — No overlap

Managed Agents has no process dependency graph, no event propagation between agents (beyond multi-agent coordination within a single session), and no organizational data model.

### Layer 5 (Learning) — Managed Agents Memory is a building block

Managed Agents' memory stores are persistent, versioned, auditable collections of text documents. The agent automatically reads at session start and writes learnings at session end. This is a simpler, more opinionated version of Ditto's memory system.

**Key differences:**
- Managed Agents memory is **path-based** (filesystem metaphor). Ditto's is **scope-based** (agent/process/self/person) with salience sorting and token-budgeted assembly.
- Managed Agents memory is **per-workspace**. Ditto's spans workspace + network (person-scoped memories on the centralized Ditto Network).
- Managed Agents has no concept of correction patterns, feedback-to-memory bridge, or knowledge extraction.
- Managed Agents memory stores support **optimistic concurrency** (content_sha256 preconditions) and **version auditing with redaction** — features Ditto doesn't have yet.

**Implication:** Managed Agents memory stores could serve as the persistence layer for Ditto's memory system when running on Anthropic infrastructure. The version auditing and redaction capabilities are worth adopting as patterns for Ditto's own memory system (compliance, PII handling).

### Layer 6 (Human) — No overlap

Managed Agents is an API — it has no human-facing interface, no conversation-first workspace, no composition intents, no daily brief, no trust controls. The human interacts through code.

---

## 3. Strategic Opportunities

### 3.1 — Managed Agents as a New Adapter (HIGH VALUE)

**What:** Create a `managed-agents` adapter type alongside `claude-api`, `cli`, and `script`.

**How it would work:**
1. Ditto's harness pipeline runs as normal through Layer 1-5
2. When a step reaches the agent adapter, instead of calling the Claude API directly or spawning a CLI process, it:
   - Creates (or reuses) a Managed Agents session
   - Injects Ditto's assembled context (memory, process context, tools) via the system prompt + custom tools
   - Sends the step's work as a user message
   - Streams events back, mapping them to Ditto's `harness-events.ts` types
   - Captures the result for the harness pipeline to continue (trust gate, review, feedback)

**Why this matters:**
- **Cloud execution** — Ditto currently requires a local runtime. Managed Agents gives container-based execution with pre-installed packages, network access, and file persistence.
- **Long-running tasks** — Steps that take minutes or hours can run in Anthropic's infrastructure without keeping a local process alive.
- **Built-in optimizations** — Prompt caching, compaction, and other performance optimizations come free.

**What Ditto preserves:** Process governance, trust tiers, memory assembly, review patterns, learning loops, the entire human layer. The adapter is just a runtime — the harness is the product.

### 3.2 — Multi-Agent as Runtime for Review Patterns (MEDIUM VALUE)

**What:** Use Managed Agents' multi-agent orchestration to implement Ditto's maker-checker and adversarial review patterns.

**How:** Define a coordinator agent (the process step executor) and callable agents (the reviewer). The coordinator does the work; the reviewer checks it. Both run in the same container with shared filesystem access but isolated context windows — exactly the separation Ditto's architecture demands.

**Why:** This solves the "genuine separation" requirement for Builder/Reviewer more robustly than spawning separate Claude processes, since Managed Agents threads are truly context-isolated.

### 3.3 — Outcomes Grader as Review Backend (MEDIUM VALUE)

**What:** Use the Outcomes evaluation system as an implementation of Ditto's specification testing review pattern.

**How:** When a process step has `review_pattern: spec_testing`, translate the process's `quality_criteria` into a rubric and submit it as a `user.define_outcome` event. The grader evaluates the output against the rubric in a separate context window.

**Why:** The grader is purpose-built for this exact task, runs in a separate context (no bias from the agent's implementation), and handles iterative refinement automatically.

### 3.4 — Memory Store Patterns Worth Adopting (LOW-MEDIUM VALUE)

**What:** Adopt specific patterns from Managed Agents' memory stores into Ditto's memory system.

**Patterns to adopt:**
- **Optimistic concurrency via content hashing** — `content_sha256` preconditions prevent concurrent write conflicts. Ditto's memory system doesn't have this.
- **Version auditing** — Every memory mutation creates an immutable version. Ditto tracks memory but doesn't version it.
- **Redaction** — Hard-clear content while preserving audit trail. Essential for compliance (PII, leaked secrets). Ditto has no equivalent.
- **Path-based organization** — The filesystem metaphor is intuitive for structuring memory. Ditto's flat scope+type model could benefit from hierarchical organization within scopes.

### 3.5 — Custom Tools as Integration Bridge (LOW VALUE)

**What:** Ditto's integration tools (YAML registry, REST/CLI handlers) could be exposed as Managed Agents custom tools.

**How:** When running on the Managed Agents adapter, translate Ditto's `IntegrationTool` definitions into Managed Agents custom tool schemas. When the agent invokes them, the `agent.custom_tool_use` event routes back to Ditto's `executeIntegrationTool()`, and the result flows back via `user.custom_tool_result`.

**Why:** This preserves Ditto's integration registry as the source of truth while leveraging Managed Agents' execution infrastructure.

---

## 4. Strategic Risks

### 4.1 — Platform Lock-in (MODERATE)

If Ditto builds a Managed Agents adapter, it couples to Anthropic's infrastructure for that execution path. Mitigation: the adapter pattern already exists — Managed Agents is ONE adapter, not THE adapter. The `claude-api`, `cli`, and `script` adapters remain. The harness is provider-agnostic by design (architecture principle).

### 4.2 — Upward Feature Creep (HIGH — watch carefully)

Managed Agents is in beta. The research preview features (Outcomes, Multi-agent, Memory) signal where Anthropic is heading. If they add:
- **Process/workflow orchestration** — This would directly compete with Ditto's Layer 1
- **Trust/permission tiers** — Currently just `always_allow`/`always_ask`; if they add earned trust, it competes with Layer 3
- **Learning from feedback** — If memory stores gain automatic correction patterns, it competes with Layer 5
- **Human-facing UI** — If they ship a workspace experience, it competes with Layer 6

**Current assessment:** Anthropic is building infrastructure (runtime, tools, memory), not product (process governance, organizational learning, human experience). Their "harness" is a container harness; Ditto's is a governance harness. These are different things. But monitor quarterly.

### 4.3 — "Good Enough" Risk (MODERATE)

For simple, one-shot agent tasks, Managed Agents is dramatically easier than Ditto. Create agent, create session, send message, get result. No process definitions, no trust tiers, no memory assembly. If a user's needs are simple enough, Managed Agents is sufficient.

**Mitigation:** Ditto's value proposition is precisely for work that ISN'T one-shot — repetitive processes that need governance, learning, and trust. The personas (Rob, Sarah, Marcus) all have recurring workflows, not one-off tasks. Ditto should make simple things simple too (the onboarding flow already does this), but the moat is in compound value over time.

### 4.4 — Cost Model Uncertainty (LOW)

Managed Agents pricing isn't detailed in the docs. Container compute, storage, and API calls will have costs beyond token usage. Ditto's local-first model has predictable costs (just API tokens). For cost-sensitive users (SMBs — Ditto's primary persona), local execution may remain preferable.

---

## 5. Concept Mapping Reference

| Managed Agents Concept | Ditto Equivalent | Gap |
|----------------------|-----------------|-----|
| Agent (versioned config) | Process definition + agent harness | Ditto has richer per-step config; Managed Agents has formal versioning |
| Environment (container) | Local runtime / adapter | Ditto lacks cloud container execution |
| Session | Session + heartbeat run | Similar lifecycle, different execution model |
| Events (SSE) | Harness events + `/api/events` SSE | Similar architecture, different type systems |
| Memory stores | `memories` table (4 scopes) | Ditto has richer scoping; Managed Agents has versioning/redaction |
| Outcomes (rubric grader) | Review patterns (spec-testing) | Similar intent; different integration point |
| Multi-agent (threads) | Maker-checker review, delegation roles | Ditto's is process-governed; Managed Agents is ad-hoc |
| Custom tools | Integration tools (YAML registry) | Similar pattern; different definition format |
| Tool confirmation | Trust gate + confidence override | Ditto's is richer (earned trust, tiers, sampling) |
| `agent_toolset_20260401` | `readOnlyTools` / `readWriteTools` / `execTools` | Similar capability; different permission granularity |
| Skills | Cognitive framework (`core.md` + `self.md`) | Different abstraction level |
| Callable agents | System agent registry + delegation | Ditto's is process-scoped; Managed Agents is agent-scoped |

---

## 6. Tactical Recommendations

### Immediate (This Phase)

1. **No action required.** Managed Agents doesn't change Ditto's current build priorities. The engine core, trust system, and human layer are all orthogonal.

2. **Capture this as Insight.** The analysis should feed into architecture decisions when Ditto reaches cloud deployment (Phase 6+ / ADR-025 Track B).

### Near-term (Next 1-2 Phases)

3. **Design the adapter interface.** When planning the cloud deployment track (ADR-025 Track B), evaluate Managed Agents as the execution backend. The adapter pattern already supports this — the work is in mapping Ditto's harness context into Managed Agents' agent config + session events.

4. **Adopt memory versioning pattern.** Implement `content_sha256` optimistic concurrency and immutable version history on Ditto's `memories` table. This is good engineering regardless of Managed Agents — concurrent memory writes during parallel process runs need conflict resolution.

### Long-term (Strategic)

5. **Monitor feature trajectory.** Track Managed Agents quarterly for signals of upward feature creep into process orchestration, trust systems, or human-facing interfaces. If Anthropic ships workflow orchestration, re-evaluate the "runtime substrate" strategy — Ditto may need to position as a governance layer ON TOP of Anthropic's orchestration, rather than orchestrating directly.

6. **Evaluate Managed Agents for the Ditto Network.** The centralized network service (ADR-025) needs cloud infrastructure for Alex/Mira personas. Managed Agents could provide the execution environment for network agents (outreach, nurture, introduction) without Ditto building its own container orchestration.

---

## 7. Conclusion

Claude Managed Agents validates Ditto's architectural thesis: **the harness is the product**. Anthropic built a runtime harness (containers, tools, agent loops). Ditto builds a governance harness (processes, trust, learning, human oversight). These are complementary layers, not competitors.

The right mental model: Managed Agents is to Ditto what EC2 is to a SaaS application. It's infrastructure you might run on, not a product you compete with. Ditto's value — process governance, earned trust, organizational memory, the human experience of handoff — lives entirely above Managed Agents' abstraction layer.

The strategic risk is not today's Managed Agents. It's tomorrow's. Watch for workflow orchestration, trust systems, and human-facing features. If those appear, the complementary relationship shifts toward competitive overlap. For now, the opportunity is to use Managed Agents as a superior runtime substrate when Ditto reaches cloud deployment.
