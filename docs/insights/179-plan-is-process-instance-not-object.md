# Insight-179: Plan Is a Process Instance, Not a New Object

**Date:** 2026-04-14
**Trigger:** Brief 138 design session — user challenged making Social Growth Plans a first-class DB object
**Layers affected:** L1 Process, L6 Human
**Status:** active

## The Insight

When a new user-facing concept emerges (growth plan, campaign, project), the default instinct is to model it as a new database table with its own schema, lifecycle, and API. This is almost always wrong in Ditto. The process system already provides: instances (processRuns), configuration (inputs), scheduling (schedules table), memory (process-scoped memories), lifecycle (pause/resume via cycle-tools), progress tracking (feedback.metrics), and cross-cycle learning (auto-restart with learnOutputs).

A "Social Growth Plan" is just a configured instance of the `gtm-pipeline` process template where `processRuns.inputs.gtmContext` holds audience, channels, and goals. Multiple plans = multiple process instances. The UI difference is a composition intent that reads process data and renders it as a dashboard — not a new data model.

The test: before creating a new table, map every field of the proposed object to an existing primitive. If >80% maps cleanly, it's a process instance with a composition intent, not a new object.

## Implications

- New user-facing features should start with "which existing process template does this configure?" not "what schema do I need?"
- The composition engine is the UI abstraction layer — it presents process data as domain-specific dashboards without duplicating the data model
- The process library ("Alex" sidebar) is the catalog of what Alex CAN do. Active instances of those templates are what Alex IS doing.

## Where It Should Land

Absorbed into `docs/architecture.md` Section 1 (Core Thesis — Process Is the Internal Primitive) as a design guideline. Also referenced in the brief template as a constraint check.
