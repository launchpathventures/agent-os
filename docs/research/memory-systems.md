# Research: Memory Systems for AI Agents

**Date:** 2026-03-19 (revised)
**Researcher:** Dev Researcher (Claude Code)
**Phase:** Phase 2 (Harness + Feedback Capture), informing memory ADR
**Status:** active

---

## The Human Mental Model

Before examining technical systems, consider how a real human persists memory between process runs.

A manager who reviews invoices every Tuesday doesn't re-read a manual each week. Over time, they've built **layered knowledge** that they carry between sessions:

| What they remember | How they learned it | How it persists | How it's retrieved |
|--------------------|--------------------|-----------------|--------------------|
| **Who they are** — their role, what they're responsible for | Told once | Identity — stable, rarely changes | Always active, never searched for |
| **Rules of thumb** — "always check the date format first" | Corrected by a colleague after making mistakes | Internalised through repetition | Triggered by encountering the relevant situation |
| **Institutional knowledge** — "vendor X always sends late invoices" | Accumulated through experience | Strengthens with reinforcement, fades without it | Recalled when the vendor's name appears |
| **What happened last time** — "I flagged that invoice, haven't heard back" | Recent memory of the last run | Session continuity — degrades quickly | Active recall at start of next session |
| **Standards** — "amounts over $10K need manager sign-off" | Initially told, later reinforced by policy | Codified in process docs, internalised over time | Checked against every item |

Notice what they **don't** carry:
- Raw transcripts of every past session
- Every invoice they've ever processed
- Information about processes they don't work on

And notice **how learning actually works:**
1. **Mistakes create memories.** The 47th routine approval creates no memory. The one time they missed a date format error creates a rule that lasts years.
2. **Reinforcement strengthens.** The first correction is tentative. The third time they catch the same issue, the rule is internalised.
3. **Consolidation is automatic.** They don't remember the specific incidents — they remember the pattern that emerged from them.
4. **Context triggers recall.** They don't load all their knowledge at the start of each session. Seeing a vendor name, an unusual amount, or a specific format triggers relevant memories.
5. **Trust earns autonomy.** A new hire gets every invoice checked. After six months of clean work, they're spot-checked. The manager doesn't re-check their entire history each week — the *absence* of corrections is itself a signal.

This is the model Agent OS should follow. The harness is the manager. The agent is the employee. Memory is how the employee improves between sessions without the manager having to re-teach every lesson.

---

## Sources Examined

Seven systems across the memory landscape, plus four projects from the Phase 2 research:

| Source | Type | Why included |
|--------|------|-------------|
| memU (NevaMind-AI/memU) | Memory framework | Three-layer hierarchy, salience scoring, 13K stars |
| Mem0 (mem0ai/mem0) | Memory framework | LLM-driven extraction/reconciliation, scope filtering |
| Letta (letta-ai/letta) | Agent framework with memory | OS-inspired tiered memory, agent-managed, context budget |
| Graphiti (getzep/graphiti) | Knowledge graph | Temporal edges, bi-temporal schemas |
| Claude Code | Dev tool with memory | File-based, pragmatic, what Agent OS uses today |
| ralph (snarktank/ralph) | Phase 2 source | Three-tier state persistence across sessions |
| antfarm (snarktank/antfarm) | Phase 2 source | SQLite state persistence across pipeline runs |
| compound-product (snarktank/compound-product) | Phase 2 source | Performance tracking for self-improvement |
| Open SWE (langchain-ai/open-swe) | Phase 2 source | AGENTS.md injection into system prompt |

The landscape doc (`docs/landscape.md` lines 137-145) identifies three memory tiers in the landscape: file-based, thread-scoped, and database-per-agent. This research extends that analysis with code-level findings from the five dedicated memory systems, and cross-references the Phase 2 source projects.

---

## 1. Memory Architectures

### memU: Three-Layer Hierarchy (Resource → Item → Category)

| Layer | Contains | Analogy |
|-------|----------|---------|
| Resource | Original data (conversations, documents, images) | Mount points |
| Item | Extracted facts, preferences, skills | Files |
| Category | Auto-organised topic summaries | Folders |

Cross-references between items act as symlinks. New memories self-organise into categories without manual tagging. Six memory types: `profile`, `event`, `knowledge`, `behavior`, `skill`, `tool`.

**Source:** `github.com/NevaMind-AI/memU`, `src/memu/database/models.py` (Resource, MemoryItem, MemoryCategory, CategoryItem), `src/memu/app/settings.py` (MemoryType literal)

### Mem0: Flat Extraction + Reconciliation

No explicit tiers. Memories are flat facts scoped by session identifiers (user_id, agent_id, run_id). The LLM extracts facts from conversations, then reconciles against existing memories via four operations: ADD, UPDATE, DELETE, NONE.

The "tiers" are scope filters:
- **User-scoped:** Personal preferences, patterns (extracted from user messages only)
- **Agent-scoped:** Agent behaviour and capabilities (extracted from assistant messages only)
- **Session-scoped (run_id):** Ephemeral session context

**Source:** `mem0/memory/main.py` (Memory class, add/search methods), `mem0/configs/prompts.py` (extraction and reconciliation prompts)

### Letta (MemGPT): OS-Inspired Tiered Memory

Inspired by operating system virtual memory with paging between fast (in-context) and slow (external) storage.

| Tier | Analogy | Persistence | Access |
|------|---------|-------------|--------|
| Core Memory (Blocks) | RAM | In-context, always loaded | Agent reads/writes via tools |
| Recall Memory | Recent files | Message history, searchable | Agent searches via tools |
| Archival Memory | Disk | Long-term persistent store | Agent searches via tools |

Agents actively manage their own memory using tools (`core_memory_append`, `core_memory_replace`, `archival_memory_insert`, `archival_memory_search`, `conversation_search`). The agent decides what to keep in "RAM" and what to page to "disk."

Memory blocks are strings with labels, values, descriptions, and character limits. A `compile()` method renders blocks into the system prompt.

**Source:** `letta/schemas/memory.py` (Memory, BasicBlockMemory, ChatMemory classes), `letta/agent.py` (context window management, `summarise_messages_inplace`)

### Graphiti: Temporal Knowledge Graph

Not layers but a graph with three node types:

| Node Type | Purpose |
|-----------|---------|
| Entity | People, products, policies with evolving summaries |
| Episode | Raw ingested data (provenance trail) |
| Community | Clusters of related entities with summaries |

Relationships (edges) are typed and bi-temporal: each fact has a validity window (when it became true, when superseded). Old facts are invalidated, not deleted.

**Source:** `graphiti_core/graphiti.py` (Graphiti class, add_episode workflow), `graphiti_core/search/search.py` (hybrid retrieval)

### Claude Code: File-Based Hierarchical

Two complementary systems:

| System | Who writes | Loaded when | Scope |
|--------|-----------|-------------|-------|
| CLAUDE.md files | Human | Every session (full) | Project, user, or org |
| Auto memory | Claude | Every session (first 200 lines of MEMORY.md) | Per working tree / git repo |

Auto memory uses plain markdown files: a `MEMORY.md` index plus topic files. Topic files are NOT loaded at startup — Claude reads them on demand when relevant. Hard cap: 200 lines of MEMORY.md in context.

**Source:** `code.claude.com/docs/en/memory`, live system at `~/.claude/projects/`

### Phase 2 Source Projects — Memory-Relevant Patterns

| Project | Memory pattern | Source file | How it works |
|---------|---------------|------------|-------------|
| **ralph** | Three-tier state | `progress.txt`, `prd.json`, git history | Raw conversation in git, structured progress in flat files, PRD as the durable process definition. Fresh context per iteration — memory is the file state, not the conversation. |
| **antfarm** | SQLite context dict | `src/installer/step-ops.ts` (context on `runs` table) | Shared mutable JSON context per run. Steps communicate via `KEY: value` parsing. Context persists across heartbeats within a run. |
| **compound-product** | Performance tracking | Shell scripts + JSON | Analyse performance → identify patterns → propose improvements. The self-improvement cycle IS the memory consolidation mechanism — it turns raw observations into proposals. |
| **Open SWE** | AGENTS.md injection | `agent/server.py` (`get_agent()`) | Repo-level `AGENTS.md` injected into system prompt at invocation. The repo IS the persistent memory — project-specific rules travel with the codebase, not with the agent. |

### Comparison Table

| System | Tier count | Metaphor | Agent manages own memory? | Human mental model analogy |
|--------|-----------|----------|--------------------------|---------------------------|
| memU | 3 (resource/item/category) | File system | No (system manages) | Filing cabinet maintained by an assistant |
| Mem0 | 1 (flat facts, scoped) | Database rows | No (LLM extracts) | Notebook that auto-updates itself |
| Letta | 3 (core/recall/archival) | OS virtual memory | Yes (via tools) | Employee managing their own desk |
| Graphiti | 3 (entity/episode/community) | Knowledge graph | No (system manages) | Institutional knowledge base |
| Claude Code | 2 (instructions + auto memory) | File system | Partially | Personal notes + company handbook |
| ralph | 3 (git/progress/PRD) | File system | Yes (writes files) | Worker's notebook + job description |
| antfarm | 1 (JSON context per run) | Shared clipboard | No (system manages) | Handover notes between shifts |

---

## 2. Storage Backends

| System | Primary storage | Small-scale option | When vectors needed |
|--------|----------------|-------------------|-------------------|
| memU | PostgreSQL + pgvector | In-memory dicts (brute-force cosine) | From the start (embedding-based retrieval) |
| Mem0 | Vector DB (22 backends) | FAISS (in-memory) or Chroma (embedded) | From the start |
| Letta | PostgreSQL | PostgreSQL (single instance) | For archival memory search |
| Graphiti | Neo4j (+ FalkorDB, Kuzu, Neptune) | Neo4j Community Edition | From the start (graph + embeddings) |
| Claude Code | File system (markdown) | File system | Never (keyword matching only) |

memU's SQLite backend (`src/memu/database/sqlite/`) stores embeddings as JSON text columns with brute-force cosine search via numpy. At <10K vectors this is sub-millisecond. The `sqlite-vec` extension adds native vector search to SQLite.

Mem0's audit trail pattern: it uses `SQLiteManager` alongside the vector store to track all memory mutations (add, update, delete) with timestamps.

---

## 3. Retrieval Strategies

### Approaches Found

| Strategy | Used by | How it works |
|----------|---------|-------------|
| Semantic (vector) | memU, Mem0, Letta, Graphiti | Embed query, find nearest vectors |
| Keyword (BM25) | Graphiti | Full-text index search |
| Hybrid (semantic + keyword) | Graphiti | Run both, merge with Reciprocal Rank Fusion |
| Graph traversal | Graphiti | BFS from known entities, distance-based reranking |
| LLM-as-judge | memU (LLM mode), Mem0 | LLM selects/ranks relevant memories |
| Scope filtering | Mem0 | Filter by user_id, agent_id, run_id before search |
| On-demand file read | Claude Code | Agent reads topic files when it determines they're relevant |
| Cross-encoder reranking | Graphiti, Mem0 | Neural reranker scores top-N candidates |
| Prompt injection | Open SWE | `AGENTS.md` injected into system prompt — always present, no search needed |

### How Systems Decide What to Inject

- **memU:** Two modes — RAG (fast, embedding-based) for continuous monitoring; LLM (slow, reasoning-based) for complex anticipation. Proactive: system injects memories without being asked. Salience scoring: `similarity × log(reinforcement+1) × recency_decay`.
- **Mem0:** Scope filtering first (user/agent/run), then vector search, then optional reranking. Returns top-K results.
- **Letta:** Agent decides. Core memory is always in context. Agent explicitly searches archival/recall when it needs information.
- **Graphiti:** Hybrid search (BM25 + cosine + graph traversal), then RRF/MMR/cross-encoder reranking.
- **Claude Code:** MEMORY.md index (200 lines) always loaded. Topic files read on demand. CLAUDE.md files fully loaded.
- **Open SWE:** AGENTS.md always injected. No search — the project context is always present.

### Partial Trust-Gating of Memory Access

No system implements trust-aware memory in Agent OS's sense (graduated access based on earned trust). However, partial analogues exist:

| System | Mechanism | How it gates | Difference from Agent OS |
|--------|-----------|-------------|--------------------------|
| Letta | Read-only blocks | Some core memory blocks cannot be modified by the agent | Gates write access, not read access. Binary, not graduated. |
| Mem0 | Scope filtering | Agent memories are separate from user memories | Scope separation, not trust-based access |
| antfarm | Role-based permissions | `verification` role strips write access | Tool permissions, not memory permissions |

None gate memory *retrieval* by trust level. An autonomous agent and a supervised agent see the same memories. The concept of injecting *more* or *less* memory based on earned trust is **Original to Agent OS.**

---

## 4. Consolidation / Compaction

| System | Strategy | Mechanism | Human analogy |
|--------|----------|-----------|---------------|
| memU | Category summaries | Items auto-organise; categories get LLM-generated summaries as compression. Reinforcement counting for repeated patterns. | Building rules of thumb from repeated experience |
| Mem0 | LLM reconciliation | Each new fact compared against existing; LLM decides ADD/UPDATE/DELETE/NONE | Updating your mental model when new info arrives |
| Letta | Message summarisation | When context exceeds threshold, `summarize_messages_inplace()` compresses older messages | Forgetting details but keeping the gist |
| Graphiti | Temporal invalidation | Contradictory facts invalidate old edges (preserved for history); entity summaries updated incrementally | "That policy changed last quarter" |
| Claude Code | Manual + index cap | Claude keeps MEMORY.md under 200 lines; details go in topic files | Organising notes into folders |

### Mem0's Reconciliation in Detail

The flow:
1. Extract facts from conversation via LLM
2. Embed each fact
3. Search existing memories for similar entries
4. Map memory UUIDs to integers (prevents LLM hallucination during reconciliation)
5. Send old memories + new facts to LLM with reconciliation prompt
6. LLM returns operations: ADD (new), UPDATE (more detail), DELETE (contradicted), NONE (duplicate)

This handles dedup, contradiction resolution, and information enrichment in one pass. Hash-based dedup (`MD5(content)`) pre-filters before the LLM call.

### Graphiti's Temporal Approach

Old facts are never deleted. When new information contradicts old, the old edge is invalidated (end timestamp) and the new edge created. This preserves complete history — "what was true at time T." Entity summaries updated incrementally.

### memU's Reinforcement

Items have `reinforcement_count` and `last_reinforced_at`. Repeated similar memories increment the count rather than creating duplicates. Salience scoring uses: `similarity × log(reinforcement+1) × recency_decay(half_life=30d)`. This mirrors human memory: repeated corrections strengthen the rule.

---

## 5. Context Window Management

| System | Strategy | Detail |
|--------|----------|--------|
| memU | Proactive injection + tiered retrieval | Category summaries first (compressed), items only if needed. Early stopping via sufficiency checks. |
| Mem0 | Top-K retrieval | Search returns ranked results, caller controls count. |
| Letta | Agent-managed paging | Agent controls "RAM" vs "disk." Context budget monitored; automatic summarisation at threshold. |
| Graphiti | Configurable limit + reranking | Fetch 2x limit, rerank, truncate. |
| Claude Code | 200-line cap + on-demand | MEMORY.md capped; topic files lazy-loaded. |

### Letta's Context Budget

Most explicit implementation:
1. `get_context_window()` breaks down token usage: system prompt, core memory blocks, messages, function definitions
2. Memory warning threshold triggers `summarize_messages_inplace()`
3. Older messages compressed, recent preserved
4. Retries up to `max_summarizer_retries`
5. Read-only blocks protected from modification
6. After compaction, evicted messages remain retrievable via API

**Source:** `letta/agent.py`

---

## 6. Memory Type Taxonomies

### Taxonomies Found

**memU** (by content): `profile`, `event`, `knowledge`, `behavior`, `skill`, `tool`
**Source:** `src/memu/app/settings.py` (MemoryType literal)

**Mem0** (by scope): user memories, agent memories, session memories
**Source:** `mem0/memory/main.py` (scope parameters on add/search)

**Letta** (by access pattern): core blocks (always loaded), recall (searchable history), archival (persistent searchable)
**Source:** `letta/schemas/memory.py`

**Graphiti** (by structure): entities, facts/relationships, episodes, communities
**Source:** `graphiti_core/graphiti.py`

**Claude Code** (by authorship and scope): CLAUDE.md (human), auto memory (Claude), rules (human, path-scoped)
**Source:** `code.claude.com/docs/en/memory`

### Observed Patterns Across Taxonomies

The taxonomies cluster along different axes — no two systems use the same categorisation. Three axes recur:

**Axis 1 — Durability:** How long does it last?
- Ephemeral (single run) vs session (across heartbeats) vs persistent (indefinite)
- Found in: Mem0 (session vs persistent), Letta (recall vs archival), Graphiti (episode vs entity)

**Axis 2 — Content:** What kind of knowledge?
- Identity, preferences, skills, corrections, context, provenance
- Found in: memU (six content types), Claude Code (instructions vs learnings vs rules)

**Axis 3 — Access:** Who can read/write it?
- System-managed vs agent-managed vs human-managed
- Found in: Letta (agent-managed), Claude Code (human writes CLAUDE.md, Claude writes auto memory)

Agent OS's architecture defines a fourth axis not found in any system: **scope** (agent-scoped vs process-scoped). This is the process-first distinction — knowledge belongs to the process or the agent, not just the user or session.

---

## 7. Session Persistence and Identity as Memory Concerns

The architecture spec (lines 153-167, 208) defines session persistence and identity as part of the agent harness. These are memory problems.

### Identity Persistence

| System | How identity persists | Where stored |
|--------|----------------------|-------------|
| memU | Not addressed — memU is a memory layer, not an agent framework | N/A |
| Mem0 | Agent-scoped memories extracted from assistant messages | Vector store |
| Letta | Core Memory "persona" block — always in context, agent-modifiable | PostgreSQL |
| Claude Code | CLAUDE.md + auto memory user type | File system |
| Open SWE | `AGENTS.md` injected via `get_agent()` | Repository file |

Letta's approach — a labelled block always present in context — maps most directly to the architecture's "Identity: role, capabilities, system prompt, personality."

### Session Persistence Across Heartbeats

| System | How session state persists | Source |
|--------|--------------------------|--------|
| Letta | Message history in recall memory; agent can search it | `letta/agent.py` |
| antfarm | JSON context on `runs` table; template variables carry state | `src/installer/step-ops.ts` |
| ralph | `progress.txt` + git state | File system |
| Sim Studio | Execution snapshot serialised to JSON | `apps/sim/executor/execution/snapshot.ts` |
| Paperclip | `agentTaskSessions` + `agentRuntimeState` tables | `server/src/services/heartbeat.ts` |

The architecture spec describes "Resumable sessions across heartbeats for context continuity" and "Execution state serialised to a snapshot." No memory system handles this — it's an execution concern handled by the orchestration layer (Sim Studio, Paperclip) rather than the memory layer.

---

## 8. Correction Pattern Persistence

This is the area with the **least existing solution**. None of the systems have a dedicated mechanism for learning from human edits/corrections as Agent OS envisions it.

| System | Approach | Gap |
|--------|----------|-----|
| Mem0 | UPDATE replaces old memory with enriched version | No concept of "correction" vs "new info" |
| Letta | Agent can update core memory after receiving feedback | No automatic extraction from edits |
| Graphiti | Temporal invalidation tracks what changed and when | Tracks factual changes, not behavioural corrections |
| Claude Code | Human edits CLAUDE.md or asks Claude to remember | Manual, not extracted from diffs |
| memU | Reinforcement counting for recurring themes | Statistical patterns, not correction intent |

### What Exists in Agent OS's Schema (Implemented)

The `feedback` table in `src/db/schema.ts` (lines 298-322) has fields designed for this:
- `type`: approve/edit/reject/escalate/auto_approve
- `diff`: JSON diff of what changed
- `correctionPattern`: extracted pattern (text)
- `patternConfidence`: confidence score

These fields exist in the schema but have no extraction mechanism — no code populates `correctionPattern` from `diff`. The schema is **ahead of the landscape.**

**Note:** The architecture spec (line 204) also describes a `memory` table with `scope_type` and `scope_id` for the two-scope memory model. This table does **not exist in the current schema** — it is a planned design, not an implementation. The current schema has no general-purpose memory table.

### Extraction Approaches Found in the Landscape

1. **Mem0 style:** Send original + edited + context to LLM → extract correction rule
2. **Graphiti style:** Track as temporal edges — "Before: formal tone" invalidated by "After: conversational tone"
3. **Statistical (memU):** Count similar corrections. 3+ of the same type → surface as candidate pattern
4. **compound-product style:** Performance analysis identifies recurring issues → proposes process changes

Correction pattern persistence is **Original to Agent OS**. The extraction mechanism is the genuine design gap.

---

## 9. Gaps — What's Original to Agent OS

| Capability | Closest analogue | Why it's still original |
|-----------|-----------------|----------------------|
| **Correction pattern extraction** from edit diffs | Mem0 reconciliation (closest mechanism) | No system distinguishes "correction" from "new information" |
| **Trust-aware memory injection** | Letta read-only blocks (partial) | No system gates retrieval by earned trust level |
| **Process-scoped learning** that persists across agent assignments | Mem0 run_id scoping (closest) | No system models memory belonging to a process rather than an agent or user |
| **Harness-level memory merging** combining agent + process scopes | Letta compile() (closest mechanism) | No system merges two scope types with budget awareness |
| **Reinforcement → trust pathway** | memU reinforcement counting (closest) | No system connects "memory was reinforced N times" to "trust tier upgrade eligible" |

---

## 10. Open Questions for the Architect

1. **Should agents manage their own memory (Letta) or should the harness manage it (Mem0/memU)?** Letta gives agents autonomy; Mem0/memU keeps the system in control. The human mental model suggests the answer may be graduated: new employees have their onboarding managed for them; experienced employees manage their own notes.

2. **When should memory consolidation run?** After every feedback event (Mem0 style), on a schedule (memU pattern detection), or as part of the self-improvement meta-process (architecture spec). The human analogy: learning happens in the moment (noticing the correction) AND in reflection (weekly retrospective).

3. **Should process-scoped memories transfer when a new agent is assigned?** The architecture implies yes (memories belong to the process). This is like a new hire inheriting the team's playbook — they get the institutional knowledge, not the personal preferences of their predecessor.

4. **Is temporal invalidation (Graphiti) worth the complexity?** Agent OS already has an `activities` table for audit. The human analogy: you remember current rules, not the history of every rule change. But you can look it up in the policy log if needed.

5. **How does memory bridge to the learning layer (L5)?** The `feedback` table captures raw corrections. Memory stores learned patterns. The bridge — extraction, validation, reinforcement — is undesigned. In human terms: feedback is the correction, memory is the internalised rule, and the bridge is reflection.

6. **Does Agent OS need a `memory` table?** The architecture spec describes one (scope_type + scope_id), but the current schema doesn't have it. The feedback table captures corrections. The activities table captures events. What additional memory artifact needs its own table?

---

## Sources

| Source | Key files examined |
|--------|-------------------|
| memU | `src/memu/database/models.py`, `src/memu/app/memorize.py`, `src/memu/app/retrieve.py`, `src/memu/app/patch.py`, `src/memu/app/settings.py`, `src/memu/database/sqlite/` |
| Mem0 | `mem0/memory/main.py`, `mem0/configs/prompts.py`, `mem0/vector_stores/configs.py` |
| Letta | `letta/schemas/memory.py`, `letta/agent.py`, docs.letta.com/memory |
| Graphiti | `graphiti_core/graphiti.py`, `graphiti_core/search/search.py` |
| Claude Code | code.claude.com/docs/en/memory |
| ralph | README, `progress.txt` convention |
| antfarm | `src/installer/step-ops.ts` (context on runs table) |
| compound-product | README, analyse → propose cycle |
| Open SWE | `agent/server.py` (AGENTS.md injection) |
| Landscape doc | `docs/landscape.md` lines 137-145 (Memory Tiers section) |
