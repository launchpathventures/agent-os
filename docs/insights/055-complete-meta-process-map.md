# Insight-055: The Complete Meta Process Map

**Date:** 2026-03-22
**Trigger:** Creator completing the meta process picture: feedback/learning as a meta process, and the cognitive framework as the executive function that all thinking passes through.
**Layers affected:** L1 Process, L2 Agent, L3 Harness, L4 Awareness, L5 Learning, L6 Human
**Status:** active

## The Insight

The full set of meta processes that constitute the Ditto platform:

### 1. Goal Framing (Insight-053)
Consultative conversation that transforms vague human intent into confirmed, actionable briefs. Calibrates depth to goal complexity. Universal entry point.

### 2. Process Execution (e.g. Dev Pipeline)
Orchestrates roles/agents through a defined process to deliver outcomes from confirmed briefs. Knows when to interrupt the human for decisions.

### 3. Process/Agent/Skill Creation
When a framed goal doesn't map to an existing process or capability, this meta process creates what's missing. The platform extends itself.

### 4. Feedback, Learning & Evolution
Observes what's working and what isn't. Actively researches external sources — repos, papers, patterns, tools — that could inspire improvements. Proposes and implements platform evolution. This is not passive telemetry. It's an active research process that finds the gold standard externally and evolves what exists internally. The `landscape.md` pattern (scout before design) as a living, continuous meta process.

### 5. Cognitive Framework (Executive Function)
**This is not a configuration file.** The cognitive framework (evolution of soul.md/agent.md) is the executive function and filter that ALL thinking passes through. Every agent, every process step, every decision is shaped by it. It determines:
- How problems are approached
- What gets prioritized in ambiguous situations
- How trade-offs are evaluated
- What "good" looks like across all contexts
- How the platform reasons about itself

The cognitive framework is to Ditto what executive function is to a human brain — not a separate module but the pervasive operating context for all cognition. It's how the platform *thinks*, not just what it does.

## The Relationships

```
Cognitive Framework (executive function — pervasive, shapes everything)
    │
    ├── Goal Framing ──→ confirmed brief
    │                        │
    │                        ├──→ Process Execution ──→ outcome
    │                        │
    │                        └──→ Process/Agent Creation ──→ new capability
    │                                    │
    │                                    └──→ Process Execution ──→ outcome
    │
    └── Feedback & Evolution ──→ improvements to all of the above
                                  (including the cognitive framework itself)
```

The cognitive framework sits above and through everything — it's not a step in the pipeline, it's the operating context. Feedback & Evolution is the only meta process that can modify the cognitive framework itself (with human approval at the highest trust gate).

## Implications

- The cognitive framework must be loaded/active in every agent context, not just referenced
- It's not static — it evolves through the feedback/learning meta process
- Modifying the cognitive framework is the highest-trust operation in the system (it changes how everything thinks)
- External research (repos, papers, communities) is a first-class input to platform evolution, not ad hoc
- The five meta processes together ARE the platform — everything else is domain-specific processes created by them
- This is the complete picture the architect needs to design from

## Where It Should Land

- **architecture.md** — the meta process layer as the platform definition
- **ADR** — cognitive framework as executive function (significant architectural decision)
- **Brief for architect** — design all five meta processes and their relationships
- **roadmap.md** — this reframes the entire roadmap around meta process maturity
