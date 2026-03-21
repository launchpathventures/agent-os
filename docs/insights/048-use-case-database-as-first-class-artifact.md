# Insight-048: A Use Case Database Is a First-Class Artifact

**Date:** 2026-03-21
**Trigger:** PM triage — personas describe types of people but there's no concrete catalogue of what Ditto actually does. "Chase overdue invoices" is more compelling than "process automation for outcome owners."
**Layers affected:** L6 Human (onboarding, discovery), L1 Process (template library)
**Status:** active

## The Insight

Ditto needs a structured database of real-world use cases — specific, concrete outcomes someone would use Ditto for. Not persona stories, not architecture descriptions, but a searchable catalogue: "generate quotes from job specs," "monitor competitor pricing daily," "format analyst reports to company template," "draft follow-up emails after no response."

This serves three purposes:

1. **Recognition.** When someone reads the list, they find their problem. "Oh, that's exactly what I spend 3 hours on every Monday." This is more powerful than persona descriptions because it's specific enough to match their reality.

2. **Grounding for process templates.** Each use case is a candidate for the template library (ADR-008). The catalogue becomes the intake funnel for template creation — which use cases appear most often? Which cut across personas?

3. **Discovery fuel.** The process-analyst system agent (Phase 11) needs a knowledge base of "things Ditto can do." The use case database IS that knowledge base. When a user describes their pain, the system matches against known use cases.

## Structure

Each use case should capture:
- **What it is** (one line: "Chase overdue invoices with escalating follow-ups")
- **Who it's for** (which persona archetype — can be multiple)
- **What the process looks like** (3-5 steps, plain language)
- **What "good" looks like** (the quality standard the human would check)
- **What triggers it** (new email, time-based, data change, manual capture)

## Where it lives

`docs/use-cases.yaml` — YAML catalogue. 30 entries across 9 domains. Each entry has: id, name, one_liner, domain, personas, trigger, steps, good_looks_like, integrations, template status, complexity rating.

YAML chosen because it's machine-readable (process-analyst agent consumes it), human-readable (PMs and designers scan it), and consistent with how Ditto already defines processes.

## Implications

- The template library (`templates/`) has 3 templates. The use case database identifies 30 candidates, prioritised by persona overlap. 3 already have templates (invoice-follow-up, content-review, incident-response).
- The README draws from this catalogue — use case section references specific entries rather than generic domain lists.
- Process-analyst agent (Phase 11) uses this as its knowledge base for guided discovery.
- Landing page content can be generated directly from the one_liners and persona mappings.
- New use cases should be added here first, then promoted to templates when demand justifies the effort.
