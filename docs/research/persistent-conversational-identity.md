# Research Report: Persistent Conversational Identity in AI Systems

**Date:** 2026-03-23
**Researcher:** Dev Researcher
**Question:** How do existing systems build a unified "self" that maintains coherence, memory, and cognitive continuity across conversations?
**Context:** Insight-056 (The Conversational Self) identifies the foundational missing piece in Ditto — there is no unified entity users talk to. This report surveys the landscape for patterns Ditto can compose from.
**Consumers:** Dev Architect (ADR for Conversational Self), Dev Designer (UX interaction spec)

---

## 1. Persistent Conversational Identity

### 1.1 Letta (formerly MemGPT)

**Identity mechanism:** Letta implements the "LLM-as-Operating-System" paradigm — the model manages its own memory, context, and reasoning loops the way an OS manages RAM and disk. Identity persists through **core memory blocks**: labeled, editable context segments (persona, goals, preferences, user knowledge) that are always injected into the system prompt. The agent's "self" is literally defined by what's in its core memory — and the agent can edit it.

**Memory architecture:** Four tiers:
1. **Message buffer** — recent conversation history (analogous to CPU cache)
2. **Core memory** — editable, always-in-context blocks on specific topics (analogous to RAM). Agent and external APIs can modify these.
3. **Recall memory** — complete interaction history, searchable but not always loaded (analogous to page file)
4. **Archival memory** — explicitly formulated knowledge in external databases with specialized retrieval tools (analogous to disk)

**Self-editing memory:** The defining innovation. Agents actively manage their own memory using tools — they can edit core memory blocks based on new information, move data between in-context and external storage, search recall and archival memory on demand. This creates a mechanism for continuous context refinement: the agent's identity literally evolves through self-modification.

**Delegation pattern:** Letta v1 deprecates the MemGPT-specific heartbeat mechanism in favor of native tool calling. Limited inter-agent delegation documentation. The architecture assumes persistent agent instances rather than session-based reconstruction.

**Composition opportunity for Ditto:** The tiered memory model (always-in-context + searchable + archival) maps cleanly to what the Conversational Self needs. Core memory blocks could be the Self's persistent identity: who the user is, what processes exist, accumulated preferences. The self-editing pattern is directly relevant — the Self should be able to update its understanding of the user after each conversation. However, Letta is Python-first and requires its own infrastructure — the patterns are more valuable than the code.

**Source:** Letta docs (docs.letta.com), blog posts, Medium analysis by Piyush Jhamb (Feb 2026)

### 1.2 Claude Projects / Claude Code Memory

**Identity mechanism:** Claude implements three layers of persistent context:
1. **Project instructions** — developer-written CLAUDE.md files providing persistent context
2. **Auto memory** — Claude writes notes for itself based on corrections and preferences, saved across sessions
3. **Chat history search** — conversation history searchable across project scope

Each Claude Project is an isolated memory space. Conversations within a project contribute to that project's understanding. Projects automatically generate a synthesis of key insights across chat history, updated every 24 hours.

**Memory architecture:** Write-time deduplication via Jaccard similarity (>60% token overlap → supersede). Memory is scoped per-project. Auto memory includes a selectivity heuristic — Claude decides what's worth remembering based on whether the information would be useful in a future conversation.

**Cross-surface approach:** Memory is tied to the project scope, not the surface. The same memory is accessible from web, API, and Claude Code CLI. However, there's no unified "Claude personality" across projects — each project is a separate identity context.

**Composition opportunity for Ditto:** The auto-memory pattern (system decides what to remember, not the user) aligns with Ditto's principle that "the harness manages persistence, not the user" (from landscape.md OpenClaw critique). The project-scoping model validates Ditto's two-scope memory (agent + process). The selectivity heuristic is worth studying — the Self needs to decide what to remember without overwhelming storage. However, Claude has no concept of a unified entity across projects — each project starts fresh. This is exactly the gap Insight-056 identifies.

**Source:** Claude Code docs, Claude Help Center, ShareuHack guide (2026)

### 1.3 OpenAI Custom GPTs / ChatGPT Memory

**Identity mechanism:** Custom GPTs have a static identity defined by the builder (system prompt, name, avatar, instructions). ChatGPT's memory adds a dynamic layer: saved memories (facts ChatGPT remembers across conversations) and chat history reference. Since June 2025, ChatGPT references recent conversations for personalization.

**Memory architecture:** Saved memories are explicit key-value pairs (user name, preferences, goals). Chat history provides implicit context. Free users get lightweight short-term continuity; paid users get persistent memory across all conversations.

**Key limitation:** Custom GPTs and ChatGPT memory are separate systems. A Custom GPT has its own memory scope that doesn't share with ChatGPT's personal memory. Users in the OpenAI community have actively requested that Custom GPTs access long-term memory, but this remains unresolved as of March 2026.

**Composition opportunity for Ditto:** The split between "static identity" (builder-defined instructions) and "dynamic memory" (learned from interaction) is a useful decomposition. For the Conversational Self, static identity = cognitive framework + process definitions, dynamic memory = accumulated user preferences + correction patterns. The gap between Custom GPTs and ChatGPT memory is instructive — Ditto must not have this split. The Self's identity must span all processes and all conversations.

**Source:** OpenAI Help Center, community forums, Memory FAQ

### 1.4 Inflection Pi

**Identity mechanism:** Pi maintains a single consistent persona focused on emotional connection. Personality options (friendly, casual, witty, compassionate, devoted) are pre-defined by the team. The personality team "would turn the dial up on one trait or another" but found it was "like playing Whac-A-Mole" — tuning one dimension degraded others.

**Memory architecture:** Extended memory of up to 100 conversational turns. Tracks preferences, previous topics, and emotional states. Cloud-first, optimized for real-time conversation continuity.

**Key limitation:** Pi's personality consistency came at the cost of capability. The product was eventually sunset (acquired by Microsoft). The lesson: personality without competence creates a companion, not a useful agent. Pi excelled at emotional connection but lacked the ability to DO things.

**Composition opportunity for Ditto:** Pi's failure is as instructive as its design. The Conversational Self must be competent first, personable second. The "dial tuning" problem (adjusting one personality trait degrades another) suggests that voice/tone should emerge from the cognitive framework's priorities, not from a separate personality layer. The tracking of emotional states across turns is relevant — the Self should sense frustration, confusion, urgency.

**Source:** IEEE Spectrum, CMSwire, DataStudios analysis

### 1.5 Microsoft Copilot

**Identity mechanism:** Copilot functions as a "productivity layer" across Windows, Edge, Microsoft 365, Teams, and GitHub. A "Mico" avatar provides visual personality. The "Hey Copilot" wake word creates ambient availability.

**Cross-surface approach:** Copilot is threaded into multiple surfaces but with noted design inconsistency — "Copilot, MSN, and soon Edge will look like they were designed by a completely different company compared to Windows, Xbox, and Office." Despite the vision of a unified assistant, the reality is fragmented surfaces with different UX paradigms.

**Memory:** Can reference past conversations and remember user-specified facts. Memory is unified across chat, channels, and meetings within Microsoft 365.

**Composition opportunity for Ditto:** Copilot validates the ambition (one entity across all surfaces) and demonstrates the failure mode (inconsistent design language makes the "same entity" feel like different products). For Ditto, the lesson is: voice and cognitive consistency matter more than visual consistency. The Self should think the same way on CLI, Telegram, and web — even if the interaction surface differs.

**Source:** WindowsForum, Microsoft blogs, Windows Central

---

## 2. Memory-Backed Conversation Systems

### 2.1 Mem0

**Already in landscape.md.** Key addition from 2026 research: Mem0 positions as "the memory layer for AI apps" — a middleware that sits between the application and the LLM, providing persistent memory via extraction-reconciliation. The reconciliation model (ADD/UPDATE/DELETE/NONE operations) is already adopted in ADR-003.

**Relevant for the Self:** Mem0's scope filtering (user_id, agent_id, run_id) maps to the Self's need to scope memory: Self-level memory (who the user is, preferences) vs. process-level memory (correction patterns). The 90% token reduction with 26% accuracy gain validates memory as context engineering, not just storage.

### 2.2 Zep / Graphiti

**Identity mechanism:** Zep uses a temporal knowledge graph (Graphiti) that dynamically synthesizes conversational and business data while maintaining historical relationships. Unlike simple key-value memory, Zep maintains a bi-temporal model: timeline T (chronological events) and timeline T' (data ingestion order).

**Memory architecture:** When facts change, old ones are invalidated rather than deleted — the graph retains history. This enables reasoning about causality, tracking evolution of ideas, and understanding context of changes.

**Performance:** 90% faster response times vs. baseline, 18.5% improvement over baseline on LongMemEval benchmark.

**Composition opportunity for Ditto:** Zep's temporal invalidation is directly relevant for the Conversational Self. When a user changes a process definition or corrects a preference, the Self needs to know both the new state AND what changed (to understand why). The bi-temporal model maps to Ditto's audit trail needs. However, Zep requires Neo4j infrastructure — the pattern is more relevant than the implementation. Already noted in landscape.md as "deferred alternative" (ADR-003).

**Source:** Zep paper (arXiv 2501.13956), Zep blog, Medium benchmark comparisons

### 2.3 Memory System Comparison (2026)

A comprehensive 2026 benchmark comparison shows the landscape has consolidated around a few key patterns:

| System | Approach | Identity persistence | Self-editing | Cross-session |
|--------|----------|---------------------|-------------|--------------|
| Letta | Tiered blocks (RAM/disk analogy) | Yes — core memory blocks define identity | Yes — agents edit own memory | Yes — database-backed |
| Mem0 | Extraction + reconciliation | Implicit — accumulated facts | No — external reconciliation | Yes — scoped by user/agent |
| Zep | Temporal knowledge graph | Yes — entity nodes in graph | No — graph updated externally | Yes — bi-temporal persistence |
| Claude | Auto-memory + project scope | Per-project only | Partial — auto-memory is selective | Yes within project scope |
| OpenAI | Key-value saved memories | Across conversations | No — user or system adds | Yes — but limited scope |

**Key finding:** No system combines persistent identity + self-editing memory + delegation to specialized agents + cross-surface coherence. Each system does 1-2 of these well. Ditto's Conversational Self would be novel in combining all four.

---

## 3. Cognitive Architectures with "Self" Concepts

### 3.1 SOAR

SOAR (State, Operator, And Result) is the most established cognitive architecture with an explicit self-model. Key patterns:

- **Impasses and substates** support recursive metacognition — when an agent can't proceed, it drops into a substate to reason about why, which can itself create further substates. This is the architectural mechanism for "thinking about thinking."
- **Episodic memory** separated from semantic memory — SOAR distinguishes between "what happened" (episodes) and "what is known" (facts). This maps to the Self's need for both conversation history and accumulated knowledge.
- **Working memory buffers** expose the current processing state of each module — the agent has awareness of its own cognitive state.
- Recent 2025 extension: "A Proposal to Extend the Common Model of Cognition with Metacognition" (Laird et al.) formalizes metacognitive monitoring and control as first-class architectural elements.

**Composition opportunity for Ditto:** SOAR's impasse mechanism maps to the Conversational Self's need to detect when it's uncertain (escalate to human) vs. when it can proceed (delegate to a process). The episodic/semantic memory split maps to conversation history vs. accumulated knowledge. The metacognitive monitoring concept (awareness of own cognitive state) maps to the cognitive framework (Insight-055 meta process #5). SOAR validates that "self" in a cognitive architecture is not personality — it's metacognitive access to one's own state.

**Source:** Soar (soar.eecs.umich.edu), Wikipedia, Laird et al. 2025 proposal

### 3.2 BabyAGI / AutoGPT

These systems have **no persistent identity** — they are task loops with short-term memory. AutoGPT creates a named agent with goals but the "identity" is a static prompt, not a learning entity. BabyAGI decomposes tasks and tracks them but has no concept of self, metacognition, or cross-session continuity. Not relevant for the Conversational Self pattern.

### 3.3 LangGraph Persistent Agents

LangGraph's checkpointing system (v0.2+) enables pause/resume/branch of agent runs. State is persisted to storage (memory, SQLite, PostgreSQL). This creates a form of identity through state continuity — the agent can be resumed exactly where it left off.

**Key pattern:** Checkpointing creates identity through accumulated state, not through an explicit self-model. The agent doesn't "know" it's the same agent — it just has the same state.

**Composition opportunity for Ditto:** LangGraph validates that state persistence is necessary but not sufficient for identity. The Conversational Self needs checkpointed state (what's happening now) + persistent memory (what's been learned) + metacognitive access (awareness of own state). LangGraph provides the first but not the second or third.

---

## 4. Multi-Surface Coherence

### 4.1 Cross-Surface Identity Patterns

| System | Surfaces | Coherence mechanism | Limitation |
|--------|----------|-------------------|------------|
| Microsoft Copilot | Windows, Edge, Teams, M365 | Shared memory + "Hey Copilot" wake word + Mico avatar | Inconsistent design language across surfaces |
| Alexa | Echo, phone, Fire TV, Auto | Cloud-first personality, device-adaptive responses | Personality is pre-set, not learned |
| Siri | iPhone, Mac, Watch, HomePod, CarPlay | Shared Apple ID + cloud sync | Notoriously inconsistent quality across devices |
| Claude | Web, API, Claude Code | Project-scoped memory | No unified cross-project identity |

**Key finding:** No existing system achieves genuine cross-surface coherence where the entity feels like the same "someone" regardless of surface. The closest is Copilot, which achieves ambient availability but not personality consistency. Siri and Alexa maintain voice consistency but not cognitive consistency.

**The gap Ditto can fill:** The Conversational Self would be the first system where the entity's thinking (cognitive framework), memory (accumulated knowledge), and voice (communication style) are unified regardless of whether the user is on CLI, Telegram, or web. The identity lives in the engine, not the surface.

### 4.2 Surface Adaptation Patterns

From the landscape, three patterns emerge for how systems adapt to different surfaces while maintaining identity:

1. **Response density adaptation** — same content, different verbosity. Mobile gets summaries, desktop gets detail. (Copilot, Alexa)
2. **Modality adaptation** — same personality, different interaction mode. Voice on mobile, text on desktop, structured UI on web. (Siri, Alexa)
3. **Capability adaptation** — same entity, different available actions. Quick capture on mobile, full editing on desktop. (Microsoft 365)

All three patterns apply to Ditto's Conversational Self.

---

## 5. Delegation with Coherence

### 5.1 Anthropic's Multi-Agent Research System

**The most relevant pattern for Ditto.** Key findings:

**Orchestrator-worker delegation:** A lead agent (LeadResearcher) coordinates the process, analyzing queries, developing strategy, and spawning subagents. Effective delegation requires: "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries." Vague instructions cause duplication.

**Memory-persistence for continuity:** When approaching context limits, the lead agent saves its plan to external Memory. Subagents store work in external systems, then pass "lightweight references back to the coordinator." This artifact-based approach "prevents information loss during multi-stage processing and reduces token overhead."

**Coherence mechanism:** The lead agent maintains investigative coherence through persistent planning and systematic retrieval of stored context. A CitationAgent later processes findings to ensure unified attribution across distributed research.

**Key insight for Ditto:** The orchestrator IS the identity. The subagents are capability, the orchestrator is coherence. This maps directly to the Conversational Self: the Self is the lead agent that maintains context, delegates to role-specific processes (PM, Builder, Reviewer), and synthesizes results into a coherent response.

**Source:** Anthropic Engineering blog, 2026 Agentic Coding Trends Report

### 5.2 CrewAI Manager Agent

CrewAI supports a "hierarchical process" where a manager agent delegates based on role definitions and task requirements. The manager handles handoffs without explicit orchestration code. CrewAI natively supports short-term, long-term, and entity memory.

**Limitation for Ditto:** CrewAI's manager is a dispatcher, not a conversationalist. It routes tasks but doesn't maintain a relationship with the human. The Conversational Self needs both — it must be a capable delegator AND a trusted conversation partner.

### 5.3 Claude Agent SDK Orchestrator

The Agent SDK's orchestrator pattern maintains context through careful subagent spawning with task descriptions. Subagents run in fresh context but receive the orchestrator's instructions. Git worktrees provide isolation for parallel work.

**Key design:** "Just-in-time context, not pre-inference RAG — maintain lightweight identifiers, dynamically load data at runtime using tools." This aligns with Ditto's existing memory-assembly pattern.

---

## 6. Synthesis

### What's the Gold Standard?

**No single system is the gold standard.** The landscape is fragmented:
- **Letta** has the best memory architecture for persistent identity (tiered, self-editing)
- **Anthropic's multi-agent system** has the best delegation-with-coherence pattern (orchestrator as identity)
- **Zep** has the best temporal memory (bi-temporal knowledge graph)
- **SOAR** has the most rigorous self-model (metacognitive access to own state)
- **Claude** has the best auto-memory heuristics (selective, deduplicated)
- **Copilot** has the broadest cross-surface reach (but inconsistent execution)

### What Should Ditto Compose From?

| Pattern | Source | How it applies |
|---------|--------|---------------|
| Tiered memory (core + recall + archival) | Letta | Self's context loading: core memory always in context, recall searchable, archival for deep knowledge |
| Self-editing memory blocks | Letta | Self updates its understanding of the user, processes, and preferences after each conversation |
| Orchestrator-as-identity | Anthropic multi-agent | Self IS the orchestrator — delegates to processes/roles, maintains coherence, synthesizes results |
| Auto-memory with selectivity | Claude | Self decides what to remember, not the user. Dedup via similarity. Selectivity heuristic |
| Temporal invalidation | Zep | When facts change, the Self knows both the new state and what changed |
| Metacognitive monitoring | SOAR | Self has awareness of its own cognitive state — knows when it's uncertain, knows when to escalate |
| Extraction-reconciliation | Mem0 | Memory operations (ADD/UPDATE/DELETE/NONE) for the Self's accumulated knowledge |
| Response density adaptation | Copilot/Alexa | Same Self, adapted verbosity per surface (CLI=terse, Telegram=brief, web=rich) |

### What's Genuinely Novel About Insight-056?

Three things no surveyed system does:

1. **Identity through cognitive framework.** Every system defines identity through memory + prompt. None define identity through a cognitive framework that governs HOW the entity thinks. The Conversational Self's identity isn't "I am Ditto and I remember X" — it's "I think through these mental models, I evaluate trade-offs this way, I sense when something is off." This is SOAR's metacognition applied at the product level.

2. **Delegation to governed processes.** Other systems delegate to agents (tools, subagents). Ditto delegates to harness-governed processes with trust tiers, review patterns, and quality criteria. The Self doesn't just dispatch work — it sends work into a governance structure that ensures quality. No surveyed system combines conversational identity with process governance.

3. **Consultative framing as primary mode.** Every surveyed system waits for the user to state a clear intent. The Conversational Self's primary mode is helping the user clarify their intent through consultative conversation (Insight-053). This is the PM-as-consultant pattern applied to the entity layer — not "what do you want me to do?" but "let's figure out what you actually need."

---

## Reference Doc Status

- **landscape.md** — checked. Letta not present (Python ecosystem, previously excluded). Zep/Graphiti entry exists. Mem0 entry exists. Copilot not evaluated (product, not framework). No updates needed.
- **architecture.md** — checked. "Conversation Is a Layer, Not a Mode" section is consistent with findings. The babushka model (nested harnesses) provides the architectural seam where the Self would sit — above the platform harness, as the entity that mediates between human and system.

## Sources

- [Letta docs](https://docs.letta.com/concepts/letta/)
- [Letta agent memory blog](https://www.letta.com/blog/agent-memory)
- [Letta v1 agent loop blog](https://www.letta.com/blog/letta-v1-agent)
- [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Zep temporal knowledge graph paper](https://arxiv.org/abs/2501.13956)
- [Claude memory architecture](https://code.claude.com/docs/en/memory)
- [Claude memory 3-layer guide](https://www.shareuhack.com/en/posts/claude-memory-feature-guide-2026)
- [OpenAI memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq)
- [Inflection Pi analysis - IEEE Spectrum](https://spectrum.ieee.org/inflection-ai-pi)
- [Microsoft Copilot 2026](https://windowsforum.com/threads/copilot-2026-microsofts-productivity-layer-across-windows-and-microsoft-365.400155/)
- [SOAR cognitive architecture](https://soar.eecs.umich.edu/)
- [SOAR metacognition extension proposal](https://arxiv.org/html/2506.07807)
- [AI agent memory systems compared (2026)](https://dev.to/varun_pratapbhardwaj_b13/5-ai-agent-memory-systems-compared-mem0-zep-letta-supermemory-superlocalmemory-2026-benchmark-59p3)
- [2026 Agentic Coding Trends Report - Anthropic](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
