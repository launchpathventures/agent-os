# Insight-002: Review Is Compositional, Not Selective

**Date:** 2026-03-19
**Trigger:** Dev PM session — observing that real teams layer multiple review perspectives on the same work, not just one gate
**Layers affected:** L3 Harness, L6 Human
**Status:** active

## The Insight

The architecture currently frames review patterns as alternatives — maker-checker OR adversarial OR ensemble, selected per step. Real teams don't work this way. Review is layered, with each layer catching different classes of problems:

1. **Self-review** — the maker checks their own work against criteria (free — same context, no new agent)
2. **Receiving-role review** — the next consumer checks fitness for purpose: "can I actually use this?" (free — folded into role startup)
3. **Architecture review** — cross-cutting check against spec and checklist (expensive — separate agent)
4. **Peer review** — same-skill colleague spots craft issues (expensive — separate agent)
5. **Human review** — judgment, context, values that no agent has

The key insight is the **cost asymmetry**. Layers 1-2 are nearly free (same context, no extra invocations). Layers 3-4 are expensive (separate agents, fresh context loading). Layer 5 is the scarcest resource of all.

A token-efficient default: require the free layers always, use expensive layers selectively. Trust tier determines how many layers are required — supervised processes get more, autonomous processes rely on self-check plus exception-based human review.

## Implications

**For the harness (L3):** Review patterns should be composable, not mutually exclusive. A step's review configuration is a stack of layers, not a single choice. The harness should support adding/removing layers per step.

**For trust tiers (L3):** The number of review layers is a function of trust. Supervised = all layers. Autonomous = self-check + exception escalation. This gives a natural dial between thoroughness and cost.

**For our dev process (immediate):** Add self-review to producing roles and receiving-role checks to consuming roles. These are free. Keep the single Dev Reviewer agent for architecture review. Don't add more agent spawns.

## Where It Should Land

- **Architecture spec (L3 Harness):** Review patterns section — reframe as composable layers, not alternatives
- **Phase 2 brief:** Harness should support a review layer stack per step, with sensible defaults per trust tier
- **Dev role skills (immediate):** Add self-review and receiving-role checks to existing skills
