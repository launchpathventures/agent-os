# Insight-067: Conversation Is Alignment, the Work Surface Is Manifestation

**Date:** 2026-03-23
**Trigger:** Discussion about what the Ditto app is and what role conversation plays
**Layers affected:** L6 Human, product architecture
**Status:** active

## The Insight

Conversation in Ditto serves the same purpose that conversation and meetings serve in a business: exchange ideas, create shared vision, spec work, get feedback, refine and review. The rest of Ditto is the **living manifestation** of the work agreed and the processes that power it.

The Ditto app has two gravitational centers:

**The work surface** — primary. Where running processes, their current state, and their outputs live. Not a dashboard reporting on work — it IS the work. Living, interactive, evolving.

**The conversation surface** — purposeful. Where the user and the Self align, decide, and steer. Opened when needed, not lived in permanently.

The connection is bidirectional:
- Conversation **produces** work artifacts (new processes, refined outputs, decisions)
- Work **surfaces** things into conversation (exceptions, review requests, outputs needing judgment)

The Self presents outputs in conversation to clarify ideas, get feedback, and drive decisions — the same way a colleague puts a document on screen in a meeting. The output lives on the work surface; conversation is where it gets discussed and refined.

Conversations should be **purpose-aware and outcome-producing by default**. The Self negotiates scope ("What are we trying to figure out?") and extracts outcomes (decisions, work items, process changes) back into the work surface. This gives conversations the value of meetings without ceremony or a separate "meeting" primitive.

Good organizations have fewer, better meetings and the work flows between them. Ditto should feel the same: you converse when you need to align, then the work proceeds.

## Implications

- The work surface is the primary design challenge — showing living process state and outputs without becoming a project management dashboard
- Dynamic outputs (Insight-066) may be the primary way processes manifest on the work surface — a running process's dynamic output IS its representation to the user
- The Self needs to be output-literate: able to pull outputs into conversation, summarize, discuss, and help refine
- Don't build a "meeting" primitive — make the Self's conversational behavior purposeful by default (scope negotiation, outcome extraction)
- "Quiet oversight" (Insight feedback) connects: the work surface is what you glance at. Conversation is the exception, not the norm.

## Where It Should Land

**Partially landed:** ADR-009 v2 Section 5 (2026-03-23) — Self presents outputs in conversation; work surface is where outputs live. Remaining: L6 Human Layer in architecture.md should describe the conversation/work duality. Human-layer doc interaction patterns should distinguish conversation-surface vs work-surface interactions.
