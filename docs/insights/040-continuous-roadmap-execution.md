# Insight-040: The Pipeline Should Execute the Roadmap Continuously, Not Task-by-Task

**Date:** 2026-03-20
**Trigger:** User pointed out that the dev pipeline still requires manual approval at every gate — forcing them to be a bottleneck pushing work forward rather than managing by exception. "I basically want the pipeline to work through the entire roadmap and only pause when I am absolutely needed."
**Layers affected:** L1 Process, L3 Harness, L4 Awareness, L6 Human
**Status:** active

## The Insight

The dev pipeline was built as a single-task executor: `/start Build Phase 4` runs 7 roles with a human gate after each. This requires the human to approve every step, decide what's next, and invoke the next task. The human becomes the orchestrator — the exact bottleneck Agent OS exists to eliminate.

The pipeline should instead be a **continuous roadmap executor**. It reads `docs/roadmap.md`, identifies the next incomplete milestone, runs the appropriate role sequence with intelligent routing, and chains phases together automatically. The human is notified by digest at natural milestones and only interrupted for genuine exceptions:

1. **Genuine decision needed** — multiple valid options requiring human judgment
2. **Unrecoverable failure** — something broke and auto-retry didn't fix it
3. **Direction conflict** — proposed work contradicts prior decisions or principles
4. **Low confidence** — role self-assesses uncertainty and escalates
5. **Cost/risk threshold** — work is large enough that getting it wrong wastes significant effort

Everything else flows. "Phase 4b complete. 12 AC pass. Reviewer found no issues. Moving to 4c." appears as a digest item, not an interruption.

This is ADR-011's autonomous trust tier applied to the dev process from the start. The trust model still applies — if the pipeline produces bad work, the human tightens oversight. But the default is: trust the process, interrupt by exception.

## Implications

- The pipeline needs a "continuous mode" that reads the roadmap and chains phases
- Review gates become confidence-based, not mandatory — roles must self-assess
- The routing step after each role must decide: continue automatically, or escalate
- Digests replace interruptions as the primary communication mode
- The human's role shifts from "approve each step" to "set direction, review exceptions, course-correct when needed"
- This is the strongest dogfood of Agent OS's own attention model (ADR-011)

## Where It Should Land

- Dev pipeline orchestrator implementation — continuous mode with exception-based interruption
- `docs/architecture.md` L3 (Harness) — confidence-based gate skipping as a first-class pattern
- ADR-011 validation — the dev pipeline becomes the test case for the attention model
- `docs/dev-process.md` — update to reflect that the human manages by exception, not by approval
