# Insight-069: Skills Packages as Agent Capabilities

**Date:** 2026-03-23
**Trigger:** Reassessment of impeccable.style during ADR-009 v2 discussion — initially dismissed as peripheral, then recognised as an instance of a broader pattern
**Layers affected:** L2 Agent (toolkit layer), L3 Harness (quality gates), L5 Learning (domain expertise)
**Status:** active

## The Insight

Impeccable packages professional design expertise as invocable skills that AI assistants can use. This is not just a dev tool — it's an instance of a broader pattern: **external domain expertise packaged as agent capabilities.**

Ditto agents execute process steps and produce outputs. The quality of those outputs depends on the agent's capabilities. A skills package like Impeccable gives agents design literacy they wouldn't otherwise have. The same pattern applies to writing quality, data visualization, financial formatting, accessibility compliance, legal review, and any other domain where packaged expertise exists.

This works at three levels:

**Agent toolkit extension.** ADR-014 defines a three-layer cognitive architecture (infrastructure → toolkit → context). Skills packages are toolkit-layer extensions — external domain expertise that agents draw on during execution. A process definition could declare which skills packages are relevant for its output quality, and the agent harness assembles them into the agent's context.

**Harness-level quality gates.** For processes that produce rendered views (ADR-009 v2), design quality is a harness concern. A meta-agent running design audit/polish on rendered outputs before delivery is the same pattern as the metacognitive check (Brief 034b) — a post-execution quality gate. Design quality, writing quality, accessibility compliance become composable harness handlers for specific output types.

**Ditto's own dev process.** Builder and Reviewer roles can use Impeccable's design skills when producing or reviewing UI code for the Ditto app. Design expertise becomes a capability of the dev roles, not a separate manual step.

## Implications

- Process definitions could declare `quality_skills` — skills packages relevant to their output quality
- The harness could run domain-specific quality checks as post-execution handlers (like metacognitive check but for domain quality)
- Skills packages are an ingestion pattern: Ditto consumes external expertise the same way it consumes external integrations
- Impeccable specifically is useful NOW for our dev agents AND later for users producing rendered outputs
- This extends the "structure is the product" principle — Ditto doesn't just structure work, it brings domain expertise to bear on output quality

## Where It Should Land

ADR-014 (Agent Cognitive Architecture) — toolkit layer should acknowledge external skills packages as capability extensions. Future brief for harness quality handlers could include domain-specific quality gates. Landscape entry for Impeccable should reflect this broader relevance.
