# Insight-059: Processes Need Context Bindings (Same Process, Different Targets)

**Date:** 2026-03-23
**Trigger:** Architect session — creator observed that the same process (e.g., invoicing) could apply to different targets with different configurations. "This invoicing uses this Gmail account and this accounting system, but another one uses different sources and targets."
**Layers affected:** L1 Process, L2 Agent, L3 Harness, L6 Human
**Status:** active

## The Insight

A process definition is a reusable skill. But applying that skill to real work requires **context bindings** — the specific targets, credentials, preferences, and configuration for a particular use case.

Example: "Invoice Follow-Up" is one process definition. But:
- **Client A's invoicing** uses Gmail account X, Xero org Y, 14-day payment terms, and Rob reviews
- **Client B's invoicing** uses Outlook account Z, MYOB org W, 30-day payment terms, and the bookkeeper reviews

The process steps are identical. The bindings differ. Today, this would require duplicating the process definition — which defeats the purpose of processes as reusable skills.

**Where do bindings live?** Not in the process definition (that's the reusable template). Not in a single process run (that's ephemeral). They live at the **goal/outcome level** — the persistent "I want invoicing handled for Client A" that spawns repeated process runs with the same bindings. This is the missing concept between "process definition" (the skill) and "process run" (a single execution).

This is architecturally similar to how a class has instances, or how a Docker image has containers with different env vars. The process definition is the image. The context binding is the configuration. The process run is the container.

## Implications

- A new concept is needed: **process binding** (or "process instance" or "project") — a persistent association of a process definition with specific target configuration.
- Work items (goals) may be the natural home for bindings: "Handle invoicing for Client A" is a goal with bindings attached, which spawns process runs that inherit those bindings.
- The orchestrator's decomposition already creates work items from goals. Bindings would flow from goal → spawned tasks → process runs → step inputs.
- Integration auth (Brief 026) already needs per-context credentials. Bindings are the concept that makes this coherent — "use this credential set for this binding."
- Trust earning should be per-binding, not just per-process. Client A's invoicing may earn autonomous trust while Client B's stays supervised (different data quality, different stakes).
- Templates (Brief 020) become more powerful: a template + bindings = a working process instance, no YAML editing required.
- This connects to the Conversational Self: the Self helps the user create bindings through consultative conversation ("Which Gmail account? Which accounting system?") rather than forms.

## Where It Should Land

- ADR or architecture.md update — process bindings as a first-class concept between definition and run
- Roadmap — likely Phase 8+ (process articulation tools, Insight-047)
- Brief for process binding schema when the concept matures
