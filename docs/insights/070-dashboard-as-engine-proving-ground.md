# Insight-070: Dashboard as Engine Proving Ground

**Date:** 2026-03-23
**Trigger:** PM roadmap review — user challenged the assumption that the engine must be fully proven before building the dashboard
**Layers affected:** L6 Human, L2 Agent, L3 Harness, L5 Learning
**Status:** active

## The Insight

The conventional sequencing — prove the engine, then build the UI — is backwards for Ditto. The dashboard should be built early and used as the instrument to prove and tune the engine. Every rough edge in the engine shows up immediately when you're looking at the actual workspace.

Telegram is a supporting surface that hides engine behavior behind a chat interface. The dashboard surfaces what Telegram never could: trust gate pauses that feel wrong in a real review queue, memory assembly that's too sparse when rendered in conversation, output delivery that looks correct in logs but feels broken in a viewer, process state that's technically accurate but unintuitive to navigate.

This reframes Phase 10 from "build UI after engine is proven" to "build UI to prove the engine." The dashboard becomes the harness for the harness — the testing instrument that tells us what the engine needs next.

## Implications

- **Sequencing changes fundamentally.** Phase 10 MVP moves immediately after Phase 6c, not after Phases 7-9. Future engine work (Awareness, Learning, Cognitive Architecture) is prioritized by what the dashboard reveals is missing, not by a pre-set phase order.
- **The UI prioritizes engine work.** If trust feels opaque in the dashboard, that pulls Learning (Phase 8) forward. If process relationships are confusing, that pulls Awareness (Phase 7) forward. If agent output quality varies, that pulls Cognitive A1 forward. The dashboard is the backlog.
- **MVP scope must be tight.** The dashboard's purpose is proving and tuning, not completeness. Start with the minimum views that exercise the engine's core loop: orient (Daily Brief), decide (Review), observe (Process Detail), converse (Conversation).
- **Briefs 035+036 still come first.** The dashboard needs real processes with real integrations to display. But "engine complete" is no longer a prerequisite — "engine exercisable" is.
- **Under-the-cover details become visible.** The dashboard should expose engine internals (trust decisions, memory assembly, routing choices, cost tracking) in ways that help tune behavior — not just hide them behind polished UX.

## Where It Should Land

Phase 10 MVP brief — as a core design constraint. Roadmap sequencing — Phase 10 moves to immediately after Phase 6c. Architecture.md — when the dashboard architecture is defined, reference this insight for the "proving ground" design goal.
