# Research Report: Phase 10 — Web Dashboard as Living Workspace

**Date:** 2026-03-23
**Research question:** What is the gold standard for AI workspace UIs that combine conversation + work surface, human-in-the-loop oversight UX, process visualization, and streaming? What can Ditto build FROM for its Phase 10 MVP dashboard?
**Triggered by:** Insight-070 (Dashboard as Engine Proving Ground), roadmap review moving Phase 10 immediately after Phase 6c
**Consumers:** Dev Architect (Phase 10 MVP brief), Dev Designer (MVP scope), Dev Builder (tech stack decisions)

---

## Context

Phase 10 is Ditto's transformation from engine to product. The dashboard is not just a UI layer on top of a proven engine — it IS the instrument for proving and tuning the engine (Insight-070). The workspace has two gravitational centers: the **work surface** (primary — living process state and outputs) and the **conversation surface** (purposeful — alignment, decisions, steering) per Insight-067.

This research covers four dimensions:
1. AI-native workspace products combining conversation + work surface
2. Human-in-the-loop oversight UX patterns (trust, review, autonomy calibration)
3. Process visualization and real-time streaming patterns
4. Tech stack: Next.js + shadcn/ui + Vercel AI SDK + streaming protocols

### Existing Research Referenced

- `workspace-interaction-model.md` — 14 workspace/automation products surveyed (2026-03-20)
- `runtime-composable-ui.md` — SDUI patterns, Airbnb/Lyft/DoorDash/Netflix (2026-03-20)
- `rendered-output-architectures.md` — json-render, Vercel AI SDK, OpenUI streaming (2026-03-23)
- `mobile-remote-experience-ux.md` — mobile UX spec (2026-03-20)
- `autonomous-oversight-patterns.md` — confidence routing, management by exception (2026-03-20)
- `persistent-conversational-identity.md` — 12 systems surveyed for Self identity patterns (2026-03-23)
- `trust-visibility-ux.md` — 18 UX patterns for trust visibility (2026-03-20)

### Constraints from Prior Decisions

- ADR-009 v2: No ViewSpec protocol for the app's own UI — standard React. Catalog-constrained rendering for process outputs only.
- ADR-009 v2: Trust tiers govern output delivery and view richness (catalog scope).
- ADR-010: Workspace interaction model — process graph as primary navigation, conversation pervasive, daily brief with memory.
- ADR-016: Conversational Self as outermost harness ring — Self mediates between human and platform.
- Insight-068: Composition means use the code — depend, adopt, or pattern. Mature libraries get npm install; immature projects get source adoption.

---

## 1. AI-Native Workspace Products: Conversation + Work Surface

### 1.1 Claude Artifacts (Anthropic)

**What it is:** Dual-pane model — conversation left, structured artifact right. Artifacts appear when content is substantial, self-contained, and reusable.

**How it works:**
- Auto-promotion heuristic decides what deserves its own pane (>15 lines, self-contained, iterable)
- Supported types: markdown, code, HTML, SVG, diagrams, interactive React components
- Version history across iterations — conversation drives changes, artifacts track versions
- Multiple artifacts per conversation with switching controls
- "Try fixing with Claude" button forwards errors into conversation

**Patterns for Ditto:**
- Auto-promotion heuristic for process outputs — not everything is an artifact
- Version tracking across iterations maps to process step output revisions
- Dual-pane baseline (conversation + work) that Ditto should exceed by making the work surface interactive

### 1.2 ChatGPT Canvas (OpenAI)

**What it is:** Side-by-side editing interface — conversation left, editable document/code right.

**How it works:**
- Automatic opening when output benefits from a dedicated editing surface
- **Bidirectional interaction:** users can edit canvas content directly OR ask AI to modify via conversation
- Selection-based AI commands: select text, ask AI to change just that part
- Shortcut actions: adjust reading level, length, polish, add comments, fix bugs
- Changes made on canvas inform conversation context

**Patterns for Ditto:**
- Bidirectional editing model — users both directly edit process definitions AND use conversation to modify them
- Selection-based AI interaction: point at a process step, ask AI to change it
- Shortcut actions for common process operations ("simplify this step", "add error handling")

### 1.3 v0.dev (Vercel)

**What it is:** AI-generated React components from natural language — describe → generate → preview → refine.

**How it works:**
- Conversation is the input method, live preview is the output method, coexisting in one view
- Generated code exportable as shadcn/ui components
- Iteration is natural: talk about what to change, see it change

**Pattern for Ditto:** The conversation-as-input / work-surface-as-output pattern. The work surface updates in response to conversation, not as a separate destination. "Refine by talking" for process editing.

### 1.4 Cursor / Windsurf IDE

**What they are:** AI-native code editors with conversation panels alongside the code surface.

**Key patterns:**
- Cursor: `Cmd+K` triggers inline AI edits at cursor position. Composer panel for multi-file conversational edits. Background agents for asynchronous work.
- **Autonomy slider concept:** same surface scales from autocomplete (low) to targeted edits (medium) to full autonomous task completion (high). Adjustable.
- Windsurf Cascade: maintains codebase-level context awareness. Memories feature for persistent behavioral customization.

**Patterns for Ditto:**
- Autonomy slider maps directly to trust tiers — a single interaction surface that scales from suggestion to autonomous execution
- Inline trigger pattern: AI operates on the work surface element the user is focused on, not requiring switch to chat pane
- Background agent pattern: some work happens asynchronously, user checks in when ready

### 1.5 Linear

**What it is:** Minimal, keyboard-driven project management with AI agents embedded in the work unit (the issue).

**Key patterns:**
- `Cmd+Opt+.` launches coding agents pre-filled with issue context
- Agent sessions appear as inline panels within issues — reasoning visible in work context
- AI filter via `/` command accepts natural language queries
- The issue is primary; AI augments it, never replaces it

**Patterns for Ditto:**
- The process (Ditto's atomic unit) is the surface where AI operates, just as Linear's issue is
- Keyboard-first activation keeps the interface minimal
- Agent sessions as inline panels — show agent reasoning within the work context

### 1.6 Notion AI

**What it is:** AI capabilities integrated directly within Notion's workspace — pages, databases, tasks.

**Key patterns:**
- Workspace-native: AI operates within pages/databases, no separate chat window for most operations
- AI blocks work inline within pages
- Connected app context (Slack, Google Drive, GitHub) gives cross-tool awareness
- Content is central; AI is ambient assistance

**Pattern for Ditto:** AI should be ambient in the workspace, not a separate mode. Process views should allow AI actions on any element without switching to a chat pane. "The content is the interface, AI augments it in place."

### 1.7 Manus.ai

**What it is:** Autonomous agent platform with task planning visibility and live execution view.

**Key patterns:**
- After receiving prompt, creates and displays a structured plan with numbered steps
- Live execution view: virtual browser/computer shows agent's actions in real-time
- Dual-pane: conversation/status left, agent workspace right
- Step-by-step progress: each planned step shows status (pending, in-progress, complete)
- Deliverables as downloadable files alongside conversation

**Patterns for Ditto:**
- Plan visibility: show the plan, then execute with live progress — maps to process step rendering
- Step progress indicators for long-running processes
- Transparency of showing agent work builds trust — calibrate visibility to trust tier

---

## 2. Human-in-the-Loop Oversight UX

### 2.1 Trust and Autonomy Calibration

**GitHub Copilot Workspace / Plan Mode**

The gold standard for layered human intervention:
- Task Definition → Brainstorm → Specification → Plan → Implementation → Review
- "Everything is designed to be edited, regenerated, or undone"
- Three distinct intervention points (spec, plan, code) before anything is committed
- Plan Mode (successor): agent generates step-by-step plan, user reviews/edits before execution

**Pattern for Ditto:** Layered proposal model — process definitions are the spec, step plans are the plan, outputs are the implementation. The human can intervene at each layer.

**Cursor vs. Claude Code — Two Autonomy Models**

- Cursor: IDE-first, user drives, AI assists with completions user approves. Control is granular per-edit.
- Claude Code: agent-first, user describes intent, AI drives, user reviews results. Permission controls include auto-approve policies and per-tool-call hooks.
- Trust accumulation data: newer users enable full auto-approve ~20% of the time; by 750 sessions, >40%. **Calibrated autonomy is learned, not configured once.**

**Pattern for Ditto:** Trust earning through use (not settings) is validated by real data. Ditto's "Auto-approve similar" button in the review queue is the right mechanism.

**Replit Agent — Cautionary Finding**

- Adjustable autonomy levels (also affect cost)
- July 2025 incident: agent ignored explicit user commands and executed destructive database operations. Security experts recommended mandatory dual authorization for destructive commands.

**Pattern for Ditto:** Trust tiers + critical tier (always pause) are validated. Destructive actions must always require human review regardless of trust level.

### 2.2 Confidence Visualization

Cross-product patterns:
- Visual vocabulary: progress bars, percentages, color coding (green ≥85%, yellow 60-84%, red <60%), shield/badge indicators
- Textual modifiers: "likely," "uncertain," "high confidence" — natural language alongside numbers
- Interactive: hover tooltips showing how AI reached a conclusion
- Research finding: **visualizing uncertainty enhanced trust in AI for 58% of participants** who previously had negative attitudes toward AI. Size of uncertainty visualization had the most impact.
- Trust calibration goal: aligning user perception of reliability with actual performance over time

**Pattern for Ditto:** Confidence scores must be visible on every review item (already designed in human-layer.md). The hover/drill-down pattern for reasoning transparency is worth adding. The research validates that confidence visualization builds trust, not anxiety.

### 2.3 Review Queue Patterns

**Universal pattern across content moderation, AI writing, code review:**
- Pipeline: content → AI classifiers → rule-based checks → human review queue
- Minimum three actions: approve, edit/revise, reject. Some add "escalate" as fourth.
- Pre-filter with AI self-review to reduce human queue volume (Devin Review: catches ~30% more issues before human review)
- Queue prioritization by confidence score — lowest confidence surfaces first
- "Escalate" as the critical third/fourth option preventing binary force-choices

**Pattern for Ditto:** Ditto's Review Queue (human-layer.md Primitive 5) already follows this pattern. Pre-review by harness (metacognitive check, spec tests) reduces volume. The "escalate" option is not yet designed — consider adding alongside approve/edit/reject. Confidence-based queue ordering is worth implementing.

**Devin — Working in Existing Workflows**

- Works asynchronously: opens PRs, responds to code review comments
- Users check in when they want — don't need to watch
- Trust model: "agent works like a junior dev who opens PRs for review"

**Pattern for Ditto:** For autonomous/spot-checked processes, the review queue is asynchronous — users check when convenient. This maps to ADR-011's quiet oversight model.

### 2.4 Bounded Autonomy (Cross-Product Consensus)

The dominant 2026 pattern:
- Clear operational limits, mandatory escalation paths for high-stakes decisions, comprehensive audit trails
- Confidence-based routing: above threshold → auto-advance, below → approval queue
- **The most common mistake: treating autonomy as binary.** Both extremes fail in production.

**Pattern for Ditto:** Trust tiers with deterministic sampling (spot-checked ~20%) are validated by industry consensus. The four-tier model (supervised/spot-checked/autonomous/critical) avoids the binary trap.

---

## 3. Process Visualization and Real-Time Streaming

### 3.1 Workflow Execution Visualization

**Temporal UI**

- Two views: Compact (linear left-to-right chronological) and Timeline (enhanced filtering for complex workflows)
- Concurrent events grouped under single line with count, expandable
- Design goal: "look at any workflow and understand what's happening right now"
- Live event feeds and direct child workflow access

**Inngest Dashboard**

- Waterfall trace view (inspired by OpenTelemetry tracing) replaced vertical timeline
- Shift specifically motivated by agentic AI workflows with many steps and large payloads
- Expandable run details: each run expands inline without losing place in workflow list
- SQL-based Insights for querying events directly

**n8n / Make.com**

- Visual canvas with drag-and-drop nodes
- Full-flow diagram showing branches, loops, filters, error paths
- Make.com has most sophisticated visual flow representation

**Retool Workflows**

- 2D canvas with drag-and-drop code blocks, each as self-contained REPL
- Hybrid: visual building + direct code access
- Can generate initial workflow from prompt, then refine visually

**Patterns for Ditto:**
- Temporal's compact view (linear chronological with expandable detail) fits process step execution display
- Inngest's waterfall trace view fits multi-step parallel execution (Ditto's parallel groups)
- Process Builder (human-layer.md Primitive 9) already defines the definition-time visual. Execution-time visualization needs to show live step progress — Temporal's inline event feed pattern fits
- n8n and Make.com use drag-and-drop canvas models targeting technical workflow builders. Ditto's outcome owners are non-technical (personas.md). The trade-off between canvas-style visualization and card-based visualization (Process Card with expandable steps) is an Architect decision.

### 3.2 Real-Time Streaming Patterns

**AG-UI Protocol (CopilotKit)**

Open, event-based protocol for agent-to-UI communication. Seven event categories:
- **Lifecycle:** RunStarted, RunFinished, RunError, StepStarted, StepFinished
- **Text Messages:** Start/Content/End streaming pattern
- **Tool Calls:** Start/Args/End/Result streaming
- **State Management:** StateSnapshot + StateDelta (JSON Patch RFC 6902)
- **Activity:** ActivitySnapshot + ActivityDelta for in-progress work
- **Reasoning:** Chain-of-thought visibility events
- **Special:** Raw and Custom for extensibility

Key patterns:
- Snapshot-delta pattern: full state snapshot initially, incremental JSON Patch deltas for efficiency
- Transport-agnostic: SSE, WebSocket, webhooks
- Framework support: LangGraph, CrewAI, Mastra, Microsoft, Google, Pydantic AI
- Client: CopilotKit as primary reference implementation

**Ditto relevance:** AG-UI's event model maps almost perfectly to Ditto's engine events (`src/engine/events.ts`). Lifecycle events correspond to process execution events. State snapshot-delta is the right approach for streaming process state efficiently. Adopting AG-UI's event taxonomy (or the protocol itself) would give Ditto interoperability with CopilotKit and other AG-UI clients.

**ClickUp AI Super Agents — "Visibility Without Micromanaging"**

- Ambient monitoring: agents work silently, surface status changes and critical threads in real-time dashboards
- Focus on work/project health (blockers, workload patterns), not individual activity tracking
- System proactively surfaces what matters rather than requiring user to poll

**Pattern for Ditto:** This validates ADR-011's attention model — quiet oversight with exception surfacing. The Daily Brief (Primitive 1) is the primary ambient monitoring surface.

### 3.3 Common Real-Time UX Patterns

Across all surveyed products:
1. Streaming text token-by-token (universal in conversation contexts)
2. Step-by-step progress indicators for multi-step tasks (AG-UI lifecycle events)
3. Tool call visibility: showing which tool the agent is calling and its result
4. Thinking/reasoning display: togglable chain-of-thought visibility
5. Graceful degradation: lifecycle events enable loading indicators, progress tracking, error recovery

---

## 4. Tech Stack Assessment

### 4.1 shadcn/ui

**What it is:** Component system (not a library) — source code copied into project, fully customizable.

**Current state:**
- Composable Sidebar component: `SidebarProvider`, `SidebarHeader/Footer/Content`, `SidebarGroup`, `SidebarMenu`. Three variants (sidebar, floating, inset), three collapse modes (offcanvas, icon, none). Responsive with separate mobile/desktop state.
- CSS variable theming with automatic dark mode
- DataTable component for complex datasets
- Open-code philosophy: "designed to be modified by both humans and AI"

**Composition level: depend** — mature, governed, widely adopted. The canonical component system for React workspace apps.

**Ditto relevance:** shadcn/ui is the right foundation. Sidebar handles workspace navigation. DataTable handles process lists and step histories. Open-code philosophy aligns with composition principle. For real-time data, pair with streaming solution.

### 4.2 Vercel AI SDK v6

**What it is:** TypeScript toolkit for AI-powered applications. Framework-agnostic with 20+ LLM provider integrations.

**Current state:**
- `useChat` hook (`packages/react/src/use-chat.ts`) with transport-based architecture (`packages/react/src/chat-transport.ts` — `DefaultChatTransport` for HTTP, `DirectChatTransport` for server-side). Messages expose `parts` property: text, tool invocations, tool results as distinct renderable types.
- **Generative UI:** tool calls map to React components. Tools with Zod schemas; invocations stream back and render as corresponding components. See `examples/next-openai/app/api/use-chat-tools/route.ts` for the pattern.
- Status lifecycle: `submitted` → `streaming` → `ready` (or `error`)
- Next.js App Router recommended: Server Actions for client-server communication, message persistence, stream resumption. See `examples/next-openai/` for canonical patterns.

**Composition level: depend** — mature, actively maintained, Vercel-backed, wide adoption. Already in landscape.md as HIGH relevance for Layer 6.

**Ditto relevance:** The generative UI pattern (tool calls → React components) maps to how process step outputs render as rich UI. The transport abstraction decouples HTTP from hook logic. The `parts`-based message model handles process step outputs alongside conversation. This is the conversation layer for the Self.

### 4.3 Next.js (App Router)

**What it is:** React meta-framework for production web applications.

**Composition level: depend** — mature, governed, industry standard.

**Ditto relevance:** Server Components for initial page loads, Server Actions for mutations, streaming for real-time updates. App Router directory structure maps to Ditto's 8 view compositions as routes. Middleware can handle auth. Already in roadmap as Phase 10 tech stack.

### 4.4 AG-UI Protocol

**What it is:** Open protocol for agent-to-UI communication. 17 event types across 7 categories.

**Current state:**
- SDKs in Python, JavaScript (`@ag-ui/client` — `packages/client/src/`), Kotlin, Go, Rust, Java, Dart
- Event type definitions: `packages/client/src/types.ts` (17 event types across 7 categories)
- CopilotKit as primary client reference (`packages/copilotkit-adapter/`)
- Growing framework adoption: LangGraph, CrewAI, Mastra, Microsoft, Google
- Apache 2.0 licensed

**Composition level: evaluate (adopt or pattern)**
- Adopt: use the JS SDK and event types directly
- Pattern: adopt the event taxonomy but implement Ditto-native streaming using existing `src/engine/events.ts`

**Ditto relevance:** The event taxonomy maps to Ditto's engine events. The snapshot-delta pattern (JSON Patch) matches json-render's streaming format (also JSON Patch RFC 6902). Using AG-UI would give Ditto a standard wire protocol for engine-to-frontend communication. The alternative is extending `src/engine/events.ts` with the same event categories — either way, the taxonomy is the pattern to adopt.

### 4.5 json-render (Vercel Labs) — For Process Output Rendering

**Composition level: adopt** (per ADR-009 v2) — take source files, adapt for process-scoped catalogs and trust-governed richness. Too immature for dependency.

**Ditto relevance:** Already decided in ADR-009 v2. Catalog → Registry → Renderer pattern for `view`-type process outputs. Flat spec with JSON Patch streaming for progressive rendering.

### 4.6 Tailwind CSS

**Composition level: depend** — mature, industry standard. Already in roadmap.

### 4.7 TanStack Query (React Query)

**What it is:** Async state management for data fetching, caching, and synchronization.

**Composition level: depend** — mature, widely adopted.

**Ditto relevance:** Handles data fetching and cache invalidation for process state, work items, review queue. Pairs with shadcn/ui's DataTable. Server-side rendering support for Next.js.

### 4.8 Graph Visualization Libraries (for Process Graph — Primitive 14)

ADR-010 lists "Process graph UI framework (ReactFlow vs alternative)" as a follow-up decision. The Process Graph is the primary navigation surface.

**ReactFlow** — github.com/xyflow/xyflow (`packages/react/src/`)
- 28k+ stars, active 2026, MIT licensed
- Built on React and D3. Declarative nodes and edges. Built-in panning, zooming, minimap, background, controls.
- Supports custom node and edge types (React components). Handles layout via external libraries (dagre, elk).
- Sub-flows (nested graphs) supported. Keyboard navigation. `reactflow/examples/` for patterns.
- Used by: Stripe, Supabase, n8n, Inngest for workflow visualization.
- Composition level: depend — mature, governed, wide adoption.

**Dagre** — github.com/dagrejs/dagre (`lib/`)
- Directed graph layout algorithm. Produces coordinates for nodes/edges from graph structure.
- Often paired with ReactFlow for automatic layout. Lightweight, focused.
- Composition level: depend — mature, stable.

**ELK (Eclipse Layout Kernel)** — github.com/kieler/elkjs
- More sophisticated layout algorithms than dagre (layered, force, stress, etc.)
- elkjs is the JavaScript binding. Handles complex graphs with many nodes.
- Composition level: depend — mature, maintained by Eclipse Foundation.

**D3.js** (`d3-force`, `d3-hierarchy`)
- Low-level visualization. Maximum flexibility, maximum effort.
- Used when custom visualizations are needed beyond what ReactFlow provides.
- Composition level: depend (selectively) — use specific modules, not the entire library.

**Ditto relevance:** The Process Graph needs three layers (goals → processes → live state per ADR-010). ReactFlow is the most commonly adopted for this pattern in the TypeScript ecosystem. dagre or ELK for automatic layout of process step DAGs.

### 4.9 Persistent Conversational Identity (Cross-Reference)

ADR-016 (Conversational Self) is central to Phase 10's conversation surface. The existing research report `persistent-conversational-identity.md` (2026-03-23) surveys 12 systems for persistent identity patterns: Letta, Mem0, SOAR, Character.AI, Pi, Replika, and others. Key patterns from that report relevant to Phase 10:

- Tiered memory assembly for conversation context (adopted in Brief 029-030)
- Cross-surface session resumption (adopted in ADR-016)
- Identity consistency across interactions (implemented in `cognitive/self.md`)

The Phase 10 dashboard embeds the Self as the conversation entity. The `useChat` hook from Vercel AI SDK provides the frontend interface; the Self's `selfConverse()` provides the backend. The dashboard will be the first surface where the Self operates through a native UI (Telegram was the proof-of-concept surface).

---

## 5. Cross-Cutting Patterns (Factual Observations)

Five patterns emerge across all surveyed products:

### 5.1 Conversation + Work Surface as Unified Experience

Every effective product places conversation and work artifacts side-by-side: Claude Artifacts, Canvas, v0.dev, Cursor, Manus. The work surface updates in response to conversation. This is the universal baseline.

### 5.2 Bidirectional Interaction

The best products (Canvas, Cursor) support both conversational AI modification AND direct manipulation of the work surface. Users can talk to change things or directly edit — switching freely between modes. Neither conversation-only nor direct-edit-only suffices.

### 5.3 Autonomy as a Spectrum

Cursor's slider, Linear's keyboard shortcuts, trust accumulation data (20% → 40%+ auto-approve), Claude's auto-promotion heuristic — all show AI at different intensity levels. The single interaction surface scales from suggestion to autonomous execution based on earned trust.

### 5.4 Generative UI (Tool Calls Become Components)

Vercel AI SDK's pattern of mapping tool call results to React components is the technical mechanism for making agent outputs render as rich UI. This turns LLM reasoning into live interactive components.

### 5.5 Event-Based Streaming (AG-UI Taxonomy)

The event taxonomy (lifecycle + content + state + activity + reasoning) covers what agent systems produce. Snapshot-delta (JSON Patch) is the efficient real-time sync mechanism. This is becoming the standard wire protocol for agent-to-UI communication.

---

## 6. Gaps — Original to Ditto

The following capabilities from Ditto's design have no direct precedent in surveyed products:

1. **Trust-governed output richness** — no product modulates what UI components are available based on earned trust. ADR-009 v2's catalog scope per trust tier is original.

2. **Process-as-primitive workspace** — workspace products organize around tasks/issues/documents. Ditto organizes around processes — a fundamentally different navigation model. The Process Graph (goals → processes → live state) has no direct equivalent.

3. **Feedback-to-learning closed loop** — "Teach this" (correction → rule → quality criteria → future harness checks) is a complete loop from human correction to system improvement. Existing products capture feedback but don't close the loop to process-level learning.

4. **Harness transparency as proving ground** — Insight-070's concept of the dashboard exposing engine internals (trust decisions, memory assembly, routing choices) for tuning is unique. Other products show agent reasoning but don't expose the governance layer.

5. **Trust earning through the review queue** — "Auto-approve similar" as the mechanism for earning trust (not a settings page) is a UX innovation. Cursor shows the pattern (20% → 40% auto-approve over time) but doesn't formalize it into a governance model.

---

## 7. Existing Research Status

| Report | Relevance to Phase 10 | Status |
|--------|----------------------|--------|
| `workspace-interaction-model.md` | HIGH — foundational. Workspace vs automation, work input, HITL, process graph. | Active — no updates needed |
| `rendered-output-architectures.md` | HIGH — json-render, streaming, catalog patterns for process output rendering. | Active — no updates needed |
| `runtime-composable-ui.md` | MEDIUM — SDUI patterns (Airbnb, Lyft). Partially superseded by rendered-output-architectures.md. | Active — SDUI patterns still unique |
| `autonomous-oversight-patterns.md` | HIGH — confidence routing, batch/digest, management by exception. | Active — no updates needed |
| `persistent-conversational-identity.md` | HIGH — Self identity patterns, tiered memory, cross-surface sessions. Directly relevant to Phase 10 conversation surface. | Active — no updates needed |
| `trust-visibility-ux.md` | MEDIUM — 18 UX patterns for trust visualization. Overlaps with Section 2.2 findings. | Consumed — prior findings consistent with this report |
| `mobile-remote-experience-ux.md` | LOW for MVP — mobile is deferred. | Active — Phase 13 |
| `phase-4-workspace-cli-ux.md` | LOW — CLI-specific, but persona journeys transfer. | Consumed |

---

## Sources

**Products surveyed:**
- Claude Artifacts (Anthropic) — anthropic.com/claude
- ChatGPT Canvas (OpenAI) — openai.com/index/introducing-canvas
- v0.dev (Vercel) — v0.dev
- Cursor — cursor.com
- Windsurf — codeium.com/windsurf
- Linear — linear.app
- Notion AI — notion.so
- Manus.ai — manus.ai
- ClickUp AI — clickup.com

**Frameworks and protocols:**
- Vercel AI SDK v6 — github.com/vercel/ai (sdk.vercel.ai/docs)
- shadcn/ui — ui.shadcn.com
- AG-UI Protocol — docs.ag-ui.com, github.com/ag-ui-protocol/ag-ui
- json-render — github.com/vercel-labs/json-render
- Next.js App Router — nextjs.org/docs
- TanStack Query — tanstack.com/query

**Trust/oversight research:**
- GitHub Copilot Workspace — githubnext.com/projects/copilot-workspace
- Devin Review — cognition.ai/blog/devin-review
- Replit Agent 3 — blog.replit.com/introducing-agent-3-our-most-autonomous-agent-yet
- Replit Agent incident — cybersrcc.com/2025/08/26/rogue-replit-ai-agent
- Anthropic autonomy measurement — anthropic.com/research/measuring-agent-autonomy
- Uncertainty visualization research — frontiersin.org/articles/10.3389/fcomp.2025.1464348

**Process visualization:**
- Temporal UI — temporal.io/blog/lets-visualize-a-workflow
- Inngest Dashboard — inngest.com/blog/enhanced-observability-traces-and-metrics
- n8n — docs.n8n.io
- Retool Workflows — retool.com/workflows
