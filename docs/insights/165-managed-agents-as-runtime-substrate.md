# Insight-165: Managed Agents Is a Runtime Substrate, Not a Competitor

**Date:** 2026-04-09
**Trigger:** Architectural review of Claude Managed Agents (beta April 2026) against Ditto's six-layer architecture
**Layers affected:** L2 Agent (adapter pattern), L3 Harness (review pattern execution), L5 Learning (memory versioning)
**Status:** active

## The Insight

Anthropic's Managed Agents service provides a managed container-based agent execution harness: agent loop, tool execution, streaming, memory stores, multi-agent threads, and rubric-based outcome evaluation. This maps to the **runtime** inside Ditto's adapter pattern (Layer 2) — not to the governance, trust, learning, or human layers that constitute Ditto's product.

The correct mental model is **EC2-to-SaaS**: Managed Agents is infrastructure Ditto could run on, not a product Ditto competes with. Ditto's entire differentiation (process governance, earned trust, organizational memory, the human experience of handoff) sits above the Managed Agents abstraction layer.

The adapter seam (`StepAdapter` interface in `packages/core/src/interfaces.ts`) is the strategic hedge. As long as this interface stays clean — context assembly (memory-assembly handler) separated from step execution (adapter) — a `managed-agents` adapter can be added alongside `claude-api`, `cli`, and `script` without architectural disruption.

**Watchpoint:** Monitor Managed Agents quarterly for upward feature creep into process orchestration, trust systems, or human-facing interfaces. Their current trajectory is infrastructure (runtime, tools, memory), not product (governance, learning, experience). If they ship workflow orchestration or earned trust, the complementary relationship shifts toward competitive overlap.

## Implications

1. **No immediate code changes.** The adapter interface is already clean. No deployment target exists for a cloud adapter yet (Track B per ADR-025).
2. **Memory versioning is worth adopting now.** Managed Agents' `content_sha256` optimistic concurrency and immutable version history solve a real gap in Ditto's memory system — concurrent writes during parallel process runs have no conflict resolution today.
3. **Multi-agent threads are the most interesting runtime feature.** Shared filesystem + isolated context windows is exactly what maker-checker review patterns need. Better isolation than same-API-call prompting, cheaper than separate CLI subprocesses.
4. **Ditto Network (ADR-025) is the natural first consumer.** Alex/Mira personas are Claude-specific — no multi-provider requirement. Cloud execution for outreach/nurture agents maps cleanly to Managed Agents sessions.
5. **User workspace agents should stay on existing adapters.** Multi-provider support (Ollama, OpenAI) is a user-facing requirement. Managed Agents is Claude-only.

## Where It Should Land

- **Architecture spec** (Section: Layer 2, Adapter pattern): Add Managed Agents as a documented adapter option for Track B deployment
- **ADR-025** (Deployment Architecture): Reference as cloud execution option for Ditto Network
- **Landscape doc**: Evaluation entry under a new "Managed Agent Infrastructure" section
