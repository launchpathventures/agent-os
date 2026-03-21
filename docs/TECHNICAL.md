# Ditto — Technical Overview

**For developers, architects, and technologists.**

Ditto is a harness creator for human-agent collaboration. Agents are commodities — Claude, GPT, scripts, whatever comes next. What matters is the harness: who checks whom, what trust level governs execution, what quality gates apply, how the system learns, and how agents think about the work they're doing. Agents are pluggable. Processes are durable. The harness is the product.

---

## Five Engines

### 1. Process Engine (Layer 1)

Processes are governance declarations in YAML — not workflows. A process declares: inputs, steps (with parallel groups, conditional routing, dependencies), outputs, quality criteria, feedback loops, and trust tier. Steps can be executed by AI agents, CLI agents, scripts, rules engines, or humans.

Processes are durable — defined once, refined through corrections, executed consistently. This is the antidote to AI reinvention: the same process, the same governance, the same quality criteria, every time. Three creation paths: conversation-guided (with meta-agent reasoning alongside the user), template adoption (industry-standard starting points via APQC), and data-driven discovery (from connected organizational data).

### 2. Harness Engine (Layer 3)

A middleware pipeline that every step execution passes through:

```
memory-assembly → step-execution → review-pattern → routing → trust-gate → feedback-recorder
```

Each handler is composable and independently configurable per process:

- **Memory assembly** — two-scope (agent + process), salience sorting, token-budgeted, position-aware context injection
- **Review patterns** — maker-checker, adversarial, spec-testing, ensemble consensus. Compose for high-stakes processes. Failed reviews trigger retry with reviewer feedback injected.
- **Trust gate** — 4 tiers (supervised, spot-checked ~20%, autonomous, critical). Deterministic SHA-256 sampling. Per-output confidence override: low confidence always pauses regardless of tier.
- **Feedback recorder** — every human decision (approve/edit/reject) and every harness decision (advance/pause/retry) captured. Edits diffed at word level.

### 3. Trust Engine (Layers 3 + 5)

Progressive trust, earned not configured:

- **Earning** — sliding window (20 runs), conjunctive upgrade conditions (approval rate + correction rate + consistency), disjunctive downgrade triggers (2 of 4: correction spike, rejection spike, downstream issues, input change)
- **Never auto-upgrades** — system suggests, human decides
- **Always auto-downgrades** — quality drops, oversight increases immediately
- **Cognitive quality signals** (ADR-014) — calibrated uncertainty (honest low confidence that proves justified increases trust), productive failure (quality of failure reflections), proactive concern flagging. Trust is built through vulnerability and authenticity, not just performance metrics.
- **Implicit feedback** — edits ARE feedback, rejections ARE feedback, approvals ARE feedback. No forms. Pattern detection: after 3+ corrections of the same type, the system proposes making it permanent.

### 4. Cognitive Engine (ADR-014, Layers 2 + 3)

Agents don't just execute — they think. Three-layer cognitive architecture:

**Layer A: Cognitive Infrastructure (always active)**
Executive function substrate operating regardless of cognitive posture:
- **Context assembly** — position-aware working memory (critical information at start/end of context)
- **Metacognitive monitoring** — between steps, the orchestrator evaluates: "Is this approach converging on the goal?" Stores verbal reflections for future retrieval
- **Friction detection** — tracks retry count, confidence trajectory, correction accumulation. Surfaces friction signals to the orchestrator
- **Inhibitory control** — recognizes unproductive patterns and stops execution (extends existing trust gate)
- **Calibrated uncertainty** — agents express honest uncertainty; well-calibrated confidence signals are rewarded in the trust model

**Layer B: Cognitive Toolkit (available, not mandated)**
Library of cognitive tools agents can draw on. Process definitions declare which tools are available per step. The agent decides whether and how to use them — the harness does not enforce. Follows the MeMo pattern (Guan et al., 2024): provide the toolkit, let the model choose.
- Mental models (first principles, inversion, second-order effects, circle of competence)
- Reasoning strategies (structured decomposition, multi-path evaluation, analogical reasoning)
- Reflection prompts ("Am I solving the right problem?", "What would I do differently?")
- Communication patterns (honest uncertainty expression, productive failure framing)

Content, not code. New mental models = new markdown files, not engine changes.

**Layer C: Cognitive Context (framing, not scripting)**
Per-step declarations that set the cognitive register without mandating reasoning:

```yaml
steps:
  - name: research_alternatives
    executor: cli-agent
    cognitive_context:
      framing: exploratory        # primes: "explore widely, notice unexpected patterns"
      toolkit: [first-principles, inversion, hypothesis-driven]
      reflection: goal-check      # at checkpoint: "am I still on track?"
      freedom: high               # minimal scaffolding — trust the model
```

Adaptive scaffolding: `freedom` field (high/medium/low) controls how much cognitive structure the harness provides. More capable models get less scaffolding (addressing the Prompting Inversion finding: constrained prompting hurts frontier models by 2.4%).

**The orchestrator as executive function:**
Evolves from task tracker to cognitive manager. At each heartbeat: assess progress toward intention → check friction → evaluate approach → decide (continue / adapt / escalate / stop). Includes space for intuitive observation: "What, if anything, surprises you about the current state?"

### 5. Orchestration Engine (Layers 2 + 4)

Goal-directed work evolution:
- **Intake classification** — auto-classifies work items by type (keyword + LLM), routes to best-matching process, falls back to interactive selection on low confidence
- **Goal decomposition** — breaks goals into tasks using process step list as blueprint
- **Progress tracking** — routes around trust gate pauses to continue independent work
- **Confidence-based stopping** — low confidence triggers structured escalation to human
- **Work evolution** — a question becomes a task, a task spawns research, research spawns a project. The system orchestrates this naturally.

The system runs ON itself: 4 system agents (intake-classifier, router, trust-evaluator, orchestrator) go through the same harness pipeline they govern. 10 system agent roles defined (ADR-008), 4 built.

---

## Architecture

Six layers, each composable and independently evolvable:

| Layer | Purpose | Key capabilities |
|-------|---------|-----------------|
| **L1 Process** | Governance declarations | YAML definitions, parallel groups, conditional routing (`route_to`/`default_next`), human steps, quality criteria, cognitive context |
| **L2 Agent** | Executor abstraction | Bring your own AI (Claude, GPT, scripts, local models). Adapter pattern: `invoke()`, `status()`, `cancel()`. Role-based system prompts, tool use. Cognitive toolkit injection. |
| **L3 Harness** | Quality assurance pipeline | 6 composable handlers. Review patterns, trust tiers, attention model (3 modes: item review, digest, alert), cognitive monitoring, feedback capture |
| **L4 Awareness** | Cross-process intelligence | Process dependency graph, event propagation, organizational data model, goal hierarchy, work item lifecycle tracking |
| **L5 Learning** | Self-improvement | Implicit feedback capture, trust earning algorithm, correction-to-memory bridge, approach-outcome correlation, "Teach this" pattern |
| **L6 Human** | Interaction surface | CLI (12 commands), web dashboard (planned). Unified task surface, Daily Brief, Process Graph, review queues, trust controls |

Cross-cutting concerns: Governance (agent authentication, permission scoping), External Integrations (3 protocols: CLI, MCP, REST — ADR-005), Attention Model (trust rate + attention form — ADR-011), Cognitive Model (human review framing — ADR-013), Cognitive Architecture (agent thinking — ADR-014).

Nested harness architecture: Platform Harness → Process Harness → Agent Harness → Runtime (adapter). Each layer independently swappable.

---

## Current Status

Engine functional through **Phase 5** (5 build phases complete):

- 11 process definitions (7 domain + 4 system) with parallel groups, conditional routing, human steps
- Goal-directed orchestrator with confidence-based stopping and escalation
- Trust system — 4 tiers, deterministic sampling, sliding-window earning, automatic downgrade
- Review patterns — maker-checker, adversarial, spec-testing with retry + feedback injection
- Two-scope memory (agent + process) with salience sorting and token-budgeted assembly
- Auto-classification capture with LLM routing and graceful fallback
- 4 system agents running through the same harness pipeline
- 3 non-coding process templates (invoice follow-up, content review, incident response)
- CLI with 12 commands (sync, start, heartbeat, status, review, approve, edit, reject, trust, capture, complete, debt)
- 66 integration tests (real SQLite per test, Anthropic SDK mocked at module level)
- Dogfooding: 7-role dev pipeline runs through the engine

**Next:** Phase 6 (External Integrations — 3 sub-phases approved) + Cognitive Architecture A1 (toolkit + schema) in parallel.

---

## Tech Stack

TypeScript (strict) on Node.js. SQLite via Drizzle ORM + better-sqlite3 (WAL mode). Anthropic SDK for AI. CLI via citty + @clack/prompts. Vitest for testing. YAML for process definitions. Zod for validation.

## Project Structure

```
src/
  adapters/          # Agent executors (Claude API, CLI subprocess, script)
  cli/commands/      # 12 CLI commands
  cli/format.ts      # Output formatting (TTY-aware)
  db/schema.ts       # Drizzle ORM schema
  engine/
    harness.ts           # Middleware pipeline
    heartbeat.ts         # Step execution + orchestrator heartbeat
    process-loader.ts    # YAML parser + validator
    events.ts            # Typed event emitter
    harness-handlers/    # 6 pipeline handlers
    system-agents/       # 4 system agent implementations
processes/           # Domain + system process definitions (YAML)
templates/           # Non-coding process templates
docs/
  architecture.md    # Full six-layer specification
  vision.md          # Why this exists
  personas.md        # Who we're building for
  state.md           # Current project state
  roadmap.md         # Capability map with status (13 phases + cognitive architecture)
  adrs/              # 14 architectural decision records
  briefs/            # Task briefs (active + complete)
  insights/          # 28 active design insights, 21 archived
  research/          # 31 research reports
```

## Key ADRs

| ADR | Decision |
|-----|----------|
| [001](docs/adrs/001-sqlite.md) | SQLite via Drizzle + better-sqlite3 |
| [003](docs/adrs/003-memory.md) | Two-scope memory (agent + process) |
| [007](docs/adrs/007-trust-earning.md) | Trust earning algorithm (sliding window, conjunctive/disjunctive) |
| [008](docs/adrs/008-system-agents-and-process-templates.md) | 10 system agents + template library + cold-start |
| [010](docs/adrs/010-workspace-interaction-model.md) | Workspace interaction model (work evolution, meta-processes) |
| [011](docs/adrs/011-attention-model.md) | Attention model (3 modes, confidence, silence-as-feature) |
| [013](docs/adrs/013-cognitive-model.md) | Cognitive model (human review: analytical vs creative framing) |
| [014](docs/adrs/014-agent-cognitive-architecture.md) | Agent cognitive architecture (toolkit, executive function, adaptive scaffolding) |

## Development

```bash
pnpm install
pnpm cli sync        # Initialize database
pnpm test            # Run integration tests (~560ms)
pnpm run type-check  # TypeScript strict mode
```

## Composition Strategy

Ditto composes proven patterns rather than inventing from scratch. Every component traces to a source project or is marked as Original. Key borrowings: Paperclip (heartbeat, adapter, audit), ralph/snarktank (CLI adapter, autonomous loop), antfarm (verification gates), Mastra (parallel execution, suspend/resume), Inngest AgentKit (routing modes), Open SWE (middleware chain), MeMo (cognitive toolkit pattern), Reflexion (metacognitive monitoring).

See [docs/architecture.md — Borrowing Strategy](docs/architecture.md) for the full provenance table.
