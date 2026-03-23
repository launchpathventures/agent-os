# Insight-066: Process Outputs Are Polymorphic

**Date:** 2026-03-23
**Trigger:** Research into vercel-labs/json-render; user correction that UI is one of many output types
**Layers affected:** L1 Process, L2 Agent, L6 Human
**Status:** absorbed into ADR-009 v2 (2026-03-23)

## The Insight

A process doesn't produce "UI" — it produces **typed, structured artifacts**. The process definition declares not just steps and governance, but **output schema** — what shapes its outputs can take. The runtime validates and routes outputs accordingly.

Output types form a spectrum based on where they live and Ditto's relationship to them:

| Output type | Where it lives | Ditto's role |
|---|---|---|
| Data | In Ditto (DB/store) | Owns it, passes to next process |
| Rendered view | In Ditto (work surface) | Renders it, static or dynamic |
| Document | Exported / attached | Produces it, stores reference |
| API call | External system | Fires it, logs result |
| External artifact | Out in the world | Tracks provenance + pointer |

Rendered views can be **static** (a PDF report, produced once) or **dynamic** (a live dashboard that updates as the process runs). Both are valid — the process definition determines which.

External artifacts are things processes create that leave Ditto entirely — a deployed app, a published website, a configured SaaS instance. Ditto tracks provenance and a pointer, not the artifact itself. The dev process producing a codebase is the clearest example.

For rendered views specifically, a catalog-constrained approach (like json-render) ensures agents produce structured specs against a pre-approved component vocabulary. The catalog is the contract between the process and its consumers. Trust tiers can govern catalog richness.

Process templates ship with their output schemas. Users fork the template and get both the process AND its output contract.

## Implications

- Process definitions need an output schema declaration alongside steps, governance, and trust
- Output type determines consumption: rendered (display), integrated (API call), stored (data), delivered (document), external (pointer)
- Outputs are the **public interface** between processes — process A's output schema is process B's input contract
- json-render (or similar) is a candidate for the rendered-view output type — not the whole output story
- Trust tiers extend to output delivery: can this output be published/shared without review?
- This makes the "not a project management tool" distinction visceral: Ditto shows the *thing the work produced*, not rows in a table

## Where It Should Land

**Landed:** ADR-009 v2 (2026-03-23) — reframed from "Runtime Composable UI" to "Process Output Architecture." Output schemas added to L1 process definition in architecture.md. Five destination types, two lifecycle types, trust-governed delivery and catalog richness all designed. json-render pattern adopted for view-type outputs.
