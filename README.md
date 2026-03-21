# Ditto

**A process-governed harness for AI agents that earns trust, learns from corrections, and thinks about its work.**

Every agent framework solves execution. None solves what happens after — how agents earn trust over time, learn from human corrections without feedback forms, follow durable processes instead of reinventing their approach each run, or bring the right cognitive posture to different kinds of work.

Ditto is the governed layer that sits around your agents. Agents are pluggable. Processes are durable. The harness is the product.

## What Makes This Different

**Process is the primitive.** Not tasks, not agents — processes. A process is a governance declaration: what inputs are acceptable, what quality gates apply, what trust level governs execution, what feedback loops capture learning. Defined in YAML. Refined through use. Never reinvented.

**Trust is earned, not configured.** Four tiers — supervised → spot-checked → autonomous → critical — earned through tracked approval rates and correction patterns over a sliding window. The system suggests upgrades. Humans decide. Quality drops trigger automatic downgrade. Different processes earn trust independently.

**Corrections are learning.** Edits are diffed and stored. Approvals are confirmation. Rejections are signal. After 3+ similar corrections, the system surfaces the pattern. No feedback forms. The harness learns from natural human work.

**Agents have a cognitive architecture.** Not just tools and prompts — agents get mental models, reflection prompts, and adaptive scaffolding matched to the task. The orchestrator acts as executive function: monitoring convergence, sensing when to rethink, surfacing honest uncertainty. Honest "I'm not sure" earns more trust, not less. ([ADR-014](docs/adrs/014-agent-cognitive-architecture.md))

**The system runs on itself.** Intake classification, routing, trust evaluation, and orchestration are all processes running through the same governed harness. The infrastructure earns trust the same way user processes do.

## Who It's For

Ditto serves people responsible for real outcomes — not technology. A trades business owner who checks every quote because nothing else gets the pricing right. An ecommerce director who rewrites every product description because the AI can't learn her brand voice. A team manager who corrects the same report formatting every week. A technologist who can see 20 things that should be automated but can't build 20 solutions.

They know what "good" looks like. They don't write prompts, draw workflow diagrams, or configure triggers. Ditto's goal is to meet them where they are — conversational process setup, not configuration wizards. Describe your work the way you'd explain it to a smart new hire. The system builds the structure around your answers.

**30 concrete use cases** across trades, ecommerce, finance, HR, professional services, and team operations are catalogued in [docs/use-cases.yaml](docs/use-cases.yaml).

## What a Process Looks Like

```yaml
name: Invoice Follow-Up
status: draft
template: true

steps:
  - id: identify-overdue
    name: Identify Overdue Invoices
    executor: script

  - id: draft-reminders
    name: Draft Reminder Emails
    executor: ai-agent
    depends_on: [identify-overdue]

  - id: review-escalations
    name: Review High-Value Escalations
    executor: human              # process pauses here for human decision
    depends_on: [draft-reminders]

  - id: send-reminders
    name: Send Approved Reminders
    executor: script
    depends_on: [review-escalations]

quality_criteria:
  - All overdue invoices identified (none skipped)
  - Reminder tone matches overdue period (30/60/90+ days)
  - High-value invoices always go through human review

trust:
  initial_tier: supervised
  upgrade_path:
    - after: "10 runs at > 85% approval rate"
      upgrade_to: spot_checked
```

Three executor types (`ai-agent`, `script`, `human`), plus `integration` for external systems (CLI, MCP, REST). Human steps suspend execution and resume when the human provides input. Trust and quality criteria are declared per-process.

## Architecture

Six layers. Each builds on the one below.

```
L6  Human        CLI (12 commands) · web dashboard planned
L5  Learning     correction capture · pattern detection · improvement proposals (partial)
L4  Awareness    process dependencies · event propagation (planned)
L3  Harness      memory → execution → review → routing → trust gate → feedback
L2  Agent        Claude · CLI · script · integration adapters · tool use · memory assembly
L1  Process      YAML definitions · parallel groups · conditional routing · human steps
```

**Engine:** SQLite + Drizzle ORM. WAL mode. Zero-setup (`pnpm cli sync` creates everything).

**Harness pipeline:** 6 composable handlers. Every step — including external API calls — traverses the full pipeline. Review patterns: maker-checker, adversarial, spec-testing.

**System agents:** 4 running through the harness today: intake-classifier (keyword matching), router (LLM-based), orchestrator (goal-directed decomposition), trust-evaluator. All supervised, earning trust through the same mechanism as user processes.

**Integrations:** Multi-protocol (CLI today, MCP and REST in progress). Registry-based YAML declarations per service. Credential scrubbing. Retry with exponential backoff. All calls logged in the activity table.

## Current State

| Metric | Value |
|--------|-------|
| Build phases complete | 6 |
| Tests passing | 82 |
| Process definitions | 11 |
| Process templates | 3 (invoice follow-up, content review, incident response) |
| System agents | 4 |
| CLI commands | 12 |

**Working:** process engine, harness pipeline, trust earning (4 tiers), human steps with suspend/resume, goal-directed orchestrator, auto-classification capture, integration registry (CLI protocol), memory assembly (two-scope, salience-scored), implicit feedback capture, conditional routing, parallel execution.

**In progress:** MCP protocol + agent tool use (Brief 025), credential management (Brief 026), cognitive toolkit (ADR-014 Phase A1).

**Not yet built:** web dashboard, conversational process setup, mobile experience, full learning pipeline (pattern extraction, improvement proposals), process discovery from org data.

See [current state](docs/state.md) and [roadmap](docs/roadmap.md) for the full capability map through Phase 13.

## Key Design Decisions

Every pattern traces to a source project or is marked as original. Composition over invention.

| Decision | ADR | Source |
|----------|-----|--------|
| SQLite + Drizzle ORM | [ADR-001](docs/adrs/001-sqlite.md) | antfarm, better-sqlite3 |
| Two-scope memory with salience | [ADR-003](docs/adrs/003-memory-architecture.md) | Mem0, Letta, memU |
| Multi-protocol integrations | [ADR-005](docs/adrs/005-integration-architecture.md) | Google Workspace CLI, Nango, Composio |
| Trust earning algorithm | [ADR-007](docs/adrs/007-trust-earning.md) | Discourse TL3, eBay seller standards, ISO 2859 |
| Agent cognitive architecture | [ADR-014](docs/adrs/014-agent-cognitive-architecture.md) | MeMo, MAP, Reflexion, Farnam Street |

Full provenance in the [architecture spec](docs/architecture.md).

## For Agent Developers

If you're building on CrewAI, LangGraph, AutoGen, or similar — Ditto isn't a replacement. It's the governed harness that wraps your agents:

- **Progressive trust** — supervised → spot-checked → autonomous, earned through track record
- **Implicit learning** — corrections become permanent without feedback forms
- **Cognitive architecture** — right thinking approach per task, adaptive scaffolding, executive function
- **Durable process** — defined once, refined through use, governance built in
- **Composable review** — maker-checker, adversarial, spec-testing patterns

[Agent Integration Guide](docs/agent-integration-guide.md) — 8 patterns your agents can adopt today. Designed for machine reading — drop it into your agent's context.

## Learn More

- [Vision](docs/vision.md) — why this exists
- [Personas](docs/personas.md) — who we're building for
- [Technical Overview](docs/TECHNICAL.md) — five engines, composition strategy
- [Architecture](docs/architecture.md) — full spec with provenance
- [Roadmap](docs/roadmap.md) — what's built, what's next

## License

AGPL-3.0
