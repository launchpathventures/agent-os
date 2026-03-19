# Insight-003: Learning Overhead Is a Dial, Not a Switch

**Date:** 2026-03-19
**Trigger:** Human feedback on ecosystem awareness design — "an organisation won't pay an employee to learn all the time at the cost of volume of output"
**Layers affected:** L1 Process, L2 Agent, L3 Harness, L5 Learning
**Status:** active

## The Insight

Agent OS must be exceptional at leveraging best-in-class patterns from existing repos and emerging trends. But this creates a tension: learning takes time, and not every execution should bear that cost.

The resolution is that learning/scouting overhead is a **dial, not a switch**:

1. **At agent creation time** — always invest heavily. Scout best-in-class patterns as a first-class step. This is the "hiring" phase where you invest in finding the right approach. Non-negotiable.

2. **At runtime** — the learning loop is optional and tunable per process. Some processes are high-throughput with minimal reflection (routine bug fixes, standard deployments). Others are high-stakes with deep scouting (new capability buildout, architecture decisions). The process definition controls this, not a global setting.

3. **On degradation** — when performance drops (approval rates fall, correction patterns emerge), the system should automatically suggest increasing the learning dial. "This process is underperforming — should we scout for better approaches?"

This mirrors real organisations. A senior employee doing routine work doesn't stop to research the industry on every task. But when starting a new initiative, when performance degrades, or during periodic reviews — that's when you invest in learning. The cost of learning must be proportional to the value it can deliver.

## The Two Modes

**Creation mode (always maximal):**
- Scout best-in-class repos for the pattern this agent/process implements
- Research existing solutions before designing anything
- Document provenance — where patterns came from, what was adapted
- This cost is amortised over the lifetime of the agent/process

**Execution mode (tunable per process):**
- High-throughput processes: execute with minimal overhead, learn only on failure or periodic review
- High-stakes processes: scout before each significant decision, verify against current best practices
- Degrading processes: system suggests increasing learning investment
- The process definition controls this via step inclusion/exclusion and review layer configuration

## Implications

**For process definitions (L1):** Processes should have an explicit `learning_mode` or equivalent that controls how much scouting/reflection overhead each run incurs. This could be as simple as including or excluding the scan-ecosystem step, or as nuanced as a frequency parameter.

**For the harness (L3):** The harness should respect the learning dial. Trust tiers already modulate review overhead — learning overhead should follow the same pattern. Supervised processes might mandate scouting; autonomous processes skip it unless triggered by degradation.

**For the self-improvement process:** The periodic self-improvement scan (Phase 8) is the baseline — it runs regardless. But process-specific learning (mid-execution scouting) is opt-in and controlled by the process definition.

**For agent creation:** The Dev Researcher → Dev Architect flow (research before design) should be the template for how Agent OS helps users create new agents/processes. "What can we build FROM?" should be a guided step in process creation, not just a development principle.

## Where It Should Land

- **Architecture spec (L1 Process):** Process definitions should support a learning/scouting overhead parameter
- **Architecture spec (L3 Harness):** Learning overhead modulation alongside trust-based review modulation
- **Phase 2 brief:** Acknowledge this principle when designing the harness pipeline — it should be extensible to include optional scouting steps
- **Phase 8 brief:** Self-improvement is the periodic baseline; per-process learning is the runtime complement
