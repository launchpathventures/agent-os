# ADR-016: The Conversational Self

**Date:** 2026-03-23
**Status:** accepted

## Context

### The Problem

Ditto has six architectural layers, four meta processes (ADR-015), a cognitive framework, ten system agents, and a multi-surface interaction model. But there is no unified entity the user talks to.

Today, users interact with:
- CLI commands (`aos capture`, `aos status`, `aos review`)
- Claude Code slash commands (`/dev-pm`, `/dev-builder`, `/dev-reviewer`)
- Telegram bot buttons and messages

Each surface starts from scratch. Each session re-reads documentation and re-orients. Nothing composes into a coherent "someone" with persistent identity, accumulated understanding, or cognitive continuity. The personas (Rob, Lisa, Jordan, Nadia) would never interact this way — they expect a competent teammate, not a command interface.

This is the gap Insight-056 identifies: **there is no front door.** The architecture describes "Conversation Is a Layer, Not a Mode" (architecture.md). ADR-015 defines four meta processes within a cognitive framework. ADR-014 defines a three-layer cognitive architecture. But nothing implements the **entity** that embodies these concepts — the someone the user actually talks to.

### Forces

1. **The architecture already implies a self.** "Conversation Is a Layer, Not a Mode" assumes someone is having the conversation. The Daily Brief "feels like a briefing from a chief of staff who knows everything" (architecture.md L6). The Conversation Thread is described as pervasive. But no entity holds these together.

2. **Meta processes need a face.** Goal Framing (ADR-015) is a consultative conversation — but with whom? Build creates processes — but who explains what was created? Feedback & Evolution proposes improvements — but who presents them? The Self is the entity through which all meta processes interact with the human.

3. **Cross-surface coherence requires a unified identity.** The same entity must feel consistent on CLI, Telegram, and web. This cannot be achieved by each surface independently implementing personality — identity must live in the engine.

4. **Memory without a self is data.** Ditto has a two-scope memory model (ADR-003) and a cognitive toolkit (ADR-014). But memory only becomes meaningful when an entity uses it — when "the system remembers" becomes "Ditto remembers." Memory needs a self to become personality.

5. **The dev pipeline is the first proof.** The creator is the first outcome owner (Insight-052). The dev pipeline is the first meta process. The Conversational Self should be proven here first — talking to Ditto-as-self vs. invoking slash commands manually.

### Research Inputs

- `docs/research/persistent-conversational-identity.md` — 12 systems surveyed. Key composition patterns: Letta (tiered memory, self-editing blocks), Anthropic (orchestrator-as-identity), SOAR (metacognitive monitoring), Claude (auto-memory with selectivity), Mem0 (extraction-reconciliation), Zep (temporal invalidation). Key finding: no system combines persistent identity + self-editing memory + delegation to governed processes + cross-surface coherence.
- `docs/research/conversational-self-ux.md` — UX interaction spec with persona first encounters, communication principles, surface adaptations, error recovery, 10 design principles.

### Design Inputs (from UX Spec)

Ten design principles constrain this ADR:
1. The Self is singular (one per user/workspace)
2. Identity lives in the engine, not the surface
3. Competence first, personality second
4. Silence is the default
5. The Self thinks, it doesn't just route
6. Memory is applied, not announced
7. Surface adaptation is density, not identity
8. Cross-surface continuity is invisible
9. Role delegation is internal machinery
10. The emotional journey accelerates with a persistent entity

## Decision

### 1. The Conversational Self is the outermost harness

The Self is not a new layer. It is the **outermost ring** of the existing nested harness architecture — the entity that mediates between the human and the platform harness:

```
┌─────────────────────────────────────────────────────────────┐
│  CONVERSATIONAL SELF                                         │
│  Persistent identity, consultative framing, memory,          │
│  cognitive framework, cross-surface coherence                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PLATFORM HARNESS (Ditto)                               │ │
│  │  Cross-process governance, trust, dependency graph       │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  PROCESS HARNESS (Layer 3)                           │ │ │
│  │  │  Review patterns, quality gates, escalation          │ │ │
│  │  │                                                       │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │ │ │
│  │  │  │  AGENT HARNESS (Layer 2)                         │ │ │ │
│  │  │  │  Identity, memory, tools, permissions            │ │ │ │
│  │  │  │                                                   │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  RUNTIME (Adapter)                           │ │ │ │ │
│  │  │  │  │  Claude, GPT, script, rules engine          │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────┘ │ │ │ │
│  │  │  └─────────────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Why outermost harness, not a new "Layer 0":** The six-layer architecture describes what the system IS. The babushka model describes how components nest. The Self is where the human touches the system — the membrane between inside and outside. It doesn't need a new layer because it IS the existing Layer 6 (Human Layer) given a voice. The primitives (Daily Brief, Review Queue, etc.) are the Self's tools for communicating. The Conversation Thread IS the Self.

### 2. Self context assembly

Before every conversation turn, the Self assembles its operating context. This is the Self-level equivalent of the agent harness assembly (architecture.md Layer 2), elevated to the entity level.

**Context loading model (tiered, inspired by Letta):**

| Tier | What | Always loaded? | Source |
|---|---|---|---|
| **Core identity** | Cognitive framework, communication principles, Self persona | Yes — always in context | `cognitive/self.md` + accumulated personality |
| **User knowledge** | Who this human is, preferences, corrections, communication style | Yes — always in context | `self` scope in memory table |
| **Work state** | Active processes, pending reviews, recent activity, blocked items | Yes — summarized snapshot | Query from DB at conversation start |
| **Session context** | Current conversation turns, in-progress delegation results | Yes — current session | `sessions` table |
| **Recall** | Prior conversation history, searchable | On demand via tool | `sessions` table + memory search |
| **Deep knowledge** | Process definitions, archival memory, domain details | On demand via tool | Existing DB tables |

**Implementation:** A new function `assembleSelfContext(userId, surface)` that:
1. Loads core identity (cognitive framework content — `cognitive/self.md`)
2. Loads user-scoped memories from the `memory` table (`scope_type: 'self'`, `scope_id: userId`)
3. Queries current work state (active runs, pending reviews, blocked items — lightweight summary)
4. Loads session context (current conversation turns if session exists)
5. Assembles into a structured system prompt with position-aware ordering (critical at start/end per ADR-014)
6. Injects surface identifier for density adaptation

**Token budget:** Core identity + user knowledge + work state must fit within ~4K tokens (the "always loaded" budget). Recall and deep knowledge are accessed via tools when needed — the just-in-time pattern from Claude Agent SDK / Anthropic's multi-agent system.

**Provenance:**
- **Letta** — tiered memory (core blocks always in context, recall/archival on demand). Adapted: Letta's blocks are agent-editable; the Self's core identity is system-managed but user knowledge is self-editing.
- **Claude Code** — auto-memory selectivity (system decides what to remember). Adapted: dedup via Mem0 reconciliation.
- **Anthropic multi-agent** — just-in-time context loading via tools. Adopted directly.
- **SOAR** — metacognitive monitoring (awareness of own cognitive state). Adapted: the cognitive framework content serves this role.

### 3. Self memory scope

The existing memory model has two scopes: `agent` and `process` (ADR-003). The Self introduces a third scope: `self`.

| Scope | What it stores | Persists across | Key |
|---|---|---|---|
| **agent** | Cross-cutting knowledge that travels with a specific agent | All process assignments for that agent | `scope_type: 'agent', scope_id: agentId` |
| **process** | Learning specific to a process | All runs of that process | `scope_type: 'process', scope_id: processId` |
| **self** | User knowledge that spans all processes and agents | All conversations, all processes | `scope_type: 'self', scope_id: userId` |

**What Self-scoped memory stores:**
- User preferences (communication style, review habits, correction patterns that span processes)
- Business context (org structure, domain vocabulary, cross-process relationships)
- Relationship history (trust trajectory, engagement patterns, emotional context cues)
- Accumulated cognitive calibration (when this human says "good enough" what do they mean?)

**Self-editing (Letta pattern, adapted):** After each conversation, the Self evaluates whether new knowledge was gained that should persist. This uses the existing Mem0 reconciliation pattern (ADD/UPDATE/DELETE/NONE) already adopted in ADR-003, extended to the `self` scope. The selectivity heuristic (Claude pattern): only persist information that would be useful in a future conversation. No form, no user action — the harness manages persistence.

**Provenance:**
- **Mem0** — extraction-reconciliation for memory management. Already adopted in ADR-003. Extended to `self` scope.
- **Letta** — self-editing memory. Adapted: Letta agents edit via explicit tool calls; Ditto's Self edits via post-conversation reconciliation.
- **Claude** — auto-memory selectivity. Adapted: selectivity heuristic applied to reconciliation step.

### 4. Session persistence

Conversations with the Self persist across sessions. This requires a new `sessions` table.

**Schema:**

```
sessions
├── id: text (UUID)
├── userId: text (FK → users or workspace ID)
├── surface: text ('cli' | 'telegram' | 'web')
├── startedAt: integer (timestamp)
├── lastActiveAt: integer (timestamp)
├── status: text ('active' | 'suspended' | 'closed')
├── summary: text (nullable — generated when session suspends)
└── turns: JSON (array of {role, content, timestamp, surface})
```

**Session lifecycle:**
1. **Start:** When a user begins a conversation on any surface, check for an active session. If one exists (on any surface), resume it. If not, create a new one.
2. **Turn:** Each message (human or Self) is appended to `turns`. The surface is recorded per turn (enabling cross-surface continuity tracking).
3. **Suspend:** When the conversation goes idle (configurable, default 30 minutes), the session is suspended. A summary is generated and stored. Self-scoped memories are reconciled from the session.
4. **Resume:** When the user returns, load the most recent session. If suspended, the Self loads the summary + recent turns and continues naturally. The UX spec's "resumption pattern" governs how the Self communicates this.
5. **Close:** Explicit close (user says "that's all" or session exceeds age limit). Full reconciliation of self-scoped memories.

**Cross-surface continuity:** Because the `turns` array records which surface each turn came from, the Self has full visibility into the cross-surface journey. It doesn't call attention to surface switches — it simply adapts density (UX principle 7).

**Provenance:**
- **LangGraph** — checkpointing for session continuity. Adapted: LangGraph checkpoints execution state; Ditto checkpoints conversation state.
- **Mastra** — suspend/resume with snapshot preservation. Adapted: session lifecycle model.
- Original — cross-surface turn tracking with surface-tagged turns.

### 5. The Self's relationship to meta processes and system agents

The Self is the **entity through which meta processes interact with the human.** It is not a meta process itself — it is the interface to all of them.

```
Human ←→ Conversational Self ←→ Meta Processes ←→ Domain Processes
                │
                ├── Goal Framing (the Self's consultative conversation IS Goal Framing)
                ├── Build (the Self delegates to Build and synthesizes results)
                ├── Execution (the Self monitors and surfaces review/action items)
                └── Feedback & Evolution (the Self presents improvement proposals)
```

**Key relationships:**

| Component | Relationship to Self |
|---|---|
| **Goal Framing** | The Self's consultative conversation IS Goal Framing — they are the same interaction. When the user says something vague, the Self frames it. The intake-classifier and router become internal tools the Self uses. |
| **Orchestrator** | The Self delegates decomposed goals to the orchestrator. The orchestrator manages execution; the Self manages the human relationship. They are distinct: the orchestrator tracks tasks, the Self tracks conversation and trust. |
| **Build** | When Goal Framing determines something needs to be created, the Self delegates to Build. Build creates; the Self synthesizes and presents the result. |
| **Feedback & Evolution** | The Self is the primary surface for improvement proposals. The improvement-scanner finds issues; the Self presents them in its voice. |
| **Brief-synthesizer** | The Daily Brief is assembled by the brief-synthesizer but delivered through the Self. The Self frames it, adds context, invites action. |

**What this means for existing system agents:** System agents remain unchanged. They continue to go through the harness pipeline. The Self sits above them — it's the entity that decides when to invoke them and how to present their results. The Self does not bypass the harness.

### 6. Cross-surface identity

The Self's identity lives in the engine. Surfaces render it with adapted density.

**What's constant across all surfaces:**
- Cognitive framework (same reasoning approach)
- Memory (same accumulated knowledge)
- Voice principles (competent, direct, warm, purposeful)
- Session state (same conversation continues)

**What adapts per surface:**

| Concern | CLI | Telegram | Web |
|---|---|---|---|
| Verbosity | Terse, tabular | Brief conversational | Rich, structured |
| Initiation | Reactive only | Push notifications | Daily Brief on load |
| Review | Inline approve/reject | Quick actions + drill link | Full Output Viewer |
| Process building | Conversation → YAML | Conversation → summary | Dual pane |
| Complex editing | Redirect to web | Redirect to web | Full editing |

**Implementation:** Each surface adapter calls the same Self engine function (`selfConverse(userId, message, surface)`) and receives a response tagged with density hints. The adapter renders appropriately. The Self does not know which surface it's on at the cognitive level — it receives a surface identifier for density hints only.

**Provenance:**
- **Copilot** — cross-surface ambient availability. Adopted: one entity across all surfaces. Avoided: Copilot's design inconsistency (different look-and-feel per surface).
- Original — density-based adaptation where identity is engine-level and surfaces only control rendering.

### 7. The cognitive framework as the Self's thinking substrate

The Self thinks through the Cognitive Framework (ADR-015). Concretely:

**`cognitive/self.md`** — a persistent file (like CLAUDE.md) that defines how the Self thinks. Contents:
- Consultative framing protocol (listen → assess clarity → ask → reflect → hand off)
- Trade-off evaluation heuristics (competence > personality, silence > noise, evidence > assumption)
- Escalation sensitivity (when uncertain, ask; when confident, propose)
- Communication principles (competent, direct, warm, purposeful)
- Domain mental models (loaded from process definitions and correction patterns)

This file is loaded as part of core identity (tier 1 in context assembly). It is the Self's "executive function" — the content that governs how it processes every interaction.

**Evolution:** The cognitive framework evolves through Feedback & Evolution (ADR-015 section 5). When the learning loop identifies better reasoning patterns, they are proposed as modifications to `cognitive/self.md`. This is a breaking change — always requires human approval.

### 8. MVP: The dev pipeline as first proof

The Conversational Self should be proven on the dev pipeline before building the full multi-process version.

**MVP scope:**
1. A `selfConverse()` function that assembles Self context, processes a message, and returns a response
2. `self` memory scope in the existing memory table (schema addition)
3. `sessions` table for conversation persistence
4. `cognitive/self.md` as the cognitive framework file
5. Integration with the existing Telegram bot as the first surface
6. Goal Framing behavior: a minimal consultative system prompt within `selfConverse()` that implements the listen → assess clarity → ask → reflect → hand off pattern. This is NOT the full Goal Framing process definition (ADR-015 section 3) — that is deferred to a follow-up brief. The MVP proves the conversational pattern; the full meta process formalization comes later.

**What the MVP proves:**
- The Self remembers across conversations (self-scoped memory)
- The Self frames goals consultatively (not just routing)
- The Self delegates to processes and synthesizes results
- The Self works across surfaces (Telegram → CLI, if the creator uses both)
- The cognitive framework shapes how the Self thinks

**What the MVP defers:**
- Self-editing memory (post-conversation reconciliation) — use manual memory initially
- Full Daily Brief integration
- Web surface
- Multi-user / workspace scoping
- Response density adaptation (start with Telegram-appropriate responses)

## Provenance

| Pattern | Source | What we took | What we changed |
|---|---|---|---|
| Tiered memory (core + recall + archival) | Letta (letta-ai/letta) | Always-in-context core blocks + on-demand recall | Letta agents self-edit via tools; Self uses post-conversation reconciliation |
| Orchestrator-as-identity | Anthropic multi-agent system | The orchestrator IS the identity — delegates to workers, maintains coherence | Anthropic's orchestrator is task-scoped; the Self is persistent across all tasks |
| Metacognitive monitoring | SOAR (background influence); ADR-014 Layer A (proximate) | Concept of self-model with awareness of own cognitive state | SOAR's impasse-driven substating is not adopted directly; Ditto's implementation follows ADR-014's metacognitive monitoring via the cognitive framework |
| Auto-memory selectivity | Claude Code (anthropic) | System decides what to remember based on future utility | Applied to Mem0 reconciliation step as a filter |
| Extraction-reconciliation | Mem0 (mem0ai/mem0) | ADD/UPDATE/DELETE/NONE operations for memory management | Already adopted in ADR-003; extended to `self` scope |
| Session checkpoint/resume | LangGraph (langchain-ai/langgraph) | State persistence across pauses | LangGraph checkpoints execution state; we checkpoint conversation state |
| Response density adaptation | Copilot / Alexa | Same entity, adapted verbosity per surface | Surface adapters render from density hints, not surface-specific logic |
| Consultative conversation as entry | Adapted — management consulting engagement models (listen-assess-ask-reflect-handoff); applied to AI interaction by Ditto | No surveyed AI system uses consultative framing as the primary entry mode | Consulting methodology applied to LLM conversation; the specific AI application is original |
| Delegation to governed processes | Original to Ditto | The Self delegates into a trust-gated, review-patterned harness — no surveyed system combines conversational identity with process governance |
| Cognitive framework as identity | Original to Ditto | Identity defined by how the entity thinks, not by memory + prompt. Letta's self-editing personality blocks come closest but define identity through accumulated facts, not through reasoning approach and trade-off heuristics |

## Consequences

### What becomes easier
- **User onboarding.** Rob opens Telegram and talks to someone. No commands to learn, no workflow to configure. The Self frames his needs consultatively.
- **Cross-surface experience.** One conversation, one entity, regardless of surface. No sync friction.
- **Memory utilization.** Accumulated knowledge is applied naturally through the Self's context, not through the user remembering what they told the system.
- **Meta process accessibility.** Users interact with meta processes without knowing they exist. Goal Framing, Build, Execution, Feedback — all mediated through the Self.

### What becomes harder
- **Context budget management.** The Self's always-loaded context (core identity + user knowledge + work state) consumes ~4K tokens per turn. This is overhead that doesn't exist in the current command-based model.
- **Testing.** The Self's behavior depends on accumulated state (memory, sessions, cognitive framework). Testing requires realistic stateful scenarios, not just unit tests.
- **Latency.** Context assembly adds latency before the first response. Must be fast enough that the user doesn't notice (~500ms target for assembly, excluding LLM response time).

### What new constraints this introduces
- Every surface adapter must call through `selfConverse()` — no surface can bypass the Self to access processes directly.
- The `self` memory scope must be reconciled carefully to avoid unbounded growth — the selectivity heuristic is critical.
- The cognitive framework file (`cognitive/self.md`) becomes a critical artifact — modifications are breaking changes.
- Session persistence means conversation data is stored — privacy implications for multi-user deployments. Sessions older than a configurable retention period are eligible for cleanup: turn data is summarized and raw turns purged; the summary persists. Exact retention policy is a deployment configuration decision.
- Self-scoped memories are injected into the system prompt on every turn. Memory reconciliation must sanitize content to prevent prompt injection via stored memories. This is the same risk that exists for agent-scoped and process-scoped memory (ADR-003) — the mitigation applies uniformly.

### Follow-up decisions needed
- **ADR-003 update:** Add `self` scope type to the memory architecture.
- **architecture.md update:** Add the Conversational Self to the babushka diagram and Layer 6 description.
- **ADR-015 update:** Clarify that Goal Framing is implemented through the Self's consultative conversation.
- **Roadmap resequencing:** The Conversational Self MVP should be scheduled before or alongside Phase 6b (MCP). See roadmap impact assessment below.
- **Brief sizing:** The MVP is approximately 12-15 AC. Determine if it needs sub-phasing.

### Roadmap impact

**The Conversational Self does not block Phase 6.** Phase 6 (external integrations) adds protocol handlers and tool use that the Self will eventually use — but the Self can be proven without external integrations. They are parallel tracks.

**The Self should come before Phase 10 (Web Dashboard).** Phase 10 assumes a conversational entity exists. Building the web dashboard without the Self is building UI for nobody.

**Recommended sequencing:**

```
Current:   Phase 6b (MCP) → Phase 6c (Credentials) → Phase 7 → ...
Proposed:  Phase 6b (MCP) ─────────────────────────────→ Phase 7 → ...
           Conversational Self MVP (parallel) ──→ Phase 10
           ADR-014 A1 (Cognitive Toolkit) ──────→ enriches Self
```

The Self MVP can run in parallel with Phase 6b because they touch different subsystems:
- Phase 6b: integration handlers, tool resolution, agent permissions
- Self MVP: context assembly, session persistence, self-scoped memory, Telegram integration

ADR-014 Phase A1 (Cognitive Toolkit) directly enriches the Self — the cognitive content library feeds into `cognitive/self.md`. They should be designed together but can be built incrementally.

### ADR updates required

| ADR | Update needed |
|---|---|
| ADR-003 (Memory) | Add `self` scope type. No structural change — same `memory` table, new `scope_type` value. |
| ADR-015 (Meta Processes) | Clarify: Goal Framing is implemented through the Self. The Self is the interface to all meta processes. |
| ADR-014 (Cognitive Architecture) | Note: the Self is where the cognitive framework materializes for the human. The cognitive content library (Phase A1) feeds `cognitive/self.md`. |

### Answers to Designer's open questions

1. **Where does context loading happen?** In `assembleSelfContext()` — a new function at the platform level, called before each LLM invocation. It is the Self-level equivalent of the agent harness assembly.

2. **How is session persistence implemented?** A `sessions` table with turns, cross-surface tracking, suspend/resume lifecycle, and summary generation on suspend.

3. **What's the Self's relationship to the orchestrator?** Distinct entities. The Self manages the human relationship (conversation, framing, presentation). The orchestrator manages task execution (decomposition, scheduling, progress tracking). The Self delegates to the orchestrator when goals need decomposition.

4. **How does the Self's memory scope differ?** `self` scope stores user knowledge that spans all processes — preferences, business context, relationship history. `agent` scope stores agent-specific knowledge. `process` scope stores process-specific learning. The Self loads `self`-scoped memory; agents load `agent` + `process`-scoped memory.

5. **How does the cognitive framework get loaded?** From `cognitive/self.md` — a persistent file loaded as core identity in context assembly. It evolves through Feedback & Evolution (ADR-015), with human approval for all modifications.

6. **What's the MVP?** The dev pipeline on this repo. The creator talks to Ditto-as-self on Telegram. The Self frames goals consultatively, delegates to the dev pipeline, and maintains conversation continuity. Proves: persistent identity, consultative framing, delegation with coherence, cross-session memory.
