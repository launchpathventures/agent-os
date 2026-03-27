# Insight-105: Scaffold, Canvas, Evolution — Three Tiers of System Rigidity

**Date:** 2026-03-27
**Trigger:** Architect review of 28 prototypes raised the question: are we building fixed screens or a composable system? User clarified: "we must be opinionated about what is composable and what can be evolved. The key is to ensure the user can evolve the system gracefully with Self."
**Layers affected:** L6 Human (UI architecture), L2 Agent (Self composition logic), L1 Process (Build meta-process as extender), ADR-009, ADR-015
**Status:** absorbed into ADR-024 + Brief 047 — move to archived when ADR-024 accepted

## The Insight

**Every element of Ditto's UI belongs to exactly one of three tiers: Scaffold, Canvas, or Evolvable.** The tiers determine what's fixed, what's composed, and what can grow.

The 28 prototypes are **composition references** — visual targets for what specific compositions should look like. They prove the design system works and establish the vocabulary. They do NOT define the full set of possible compositions. If we build 28 React pages, we've built a static dashboard that can never evolve. That's the opposite of what Ditto is.

### Tier 1: Scaffold (Opinionated, Fixed)

These are architectural commitments. They don't change per user, per process, or per session. They're what makes Ditto feel like Ditto. Changing them requires an ADR.

- **Three-column workspace layout** — sidebar (240px) | centre canvas (flex) | right panel (320px)
- **Artifact mode layout** — conversation (300px) | artifact (flex) | context panel (320px)
- **Navigation structure** — Today / Inbox / Work / Projects / Routines / Settings
- **Conversation as pervasive input** — always available at bottom, accessible from any context
- **The Self as composer** — the Self decides what appears in the centre canvas
- **Six artifact viewers** — Document, Spreadsheet, Image, Live Preview, Email, PDF
- **Process visualization** — narrative (not graph) for intra-process, node graph for inter-process
- **Trust display** — user language ("Check everything" ↔ "Let it run"), evidence-based
- **Design system** — two-green palette, DM Sans, cardless typographic flow, pill buttons
- **Block registry pattern** — typed blocks, exhaustive renderer, parts-based streaming

### Tier 2: Canvas (Composed from Blocks)

These are composed dynamically by the Self from the block library. Different contexts produce different compositions. The prototypes show reference compositions — examples, not the exhaustive set.

- **Centre column content** — what blocks appear, in what order, with what data
- **Right panel content** — what context, provenance, or suggestions are shown
- **Feed items** — composition of RecordBlocks, AlertBlocks, MetricBlocks based on what's happening
- **Review surfaces** — inline, batch, deep, in-conversation modes assembled from blocks
- **Process detail** — which metrics, which steps, which activity — composed from blocks
- **Morning brief** — narrative composed by the briefing-assembler, rendered as blocks
- **Knowledge views** — tables, health strips, detail panels — composed from blocks
- **Onboarding flow** — the Self composes the intake experience adaptively

### Tier 3: Evolvable (Meta Dev Process Extends)

These grow through use. The Build meta-process (ADR-015) can create new vocabulary when patterns stabilize. The user evolves the system with the Self as their collaborator.

- **New block types** — when Live Preview patterns stabilize, Build extracts them into native blocks
- **New process templates** — with their own output catalogs and block compositions
- **New integration connections** — discovered through conversation, registered in the integration registry
- **Composition patterns** — how blocks are assembled for new use cases (learned from user corrections)
- **Knowledge structure** — what knowledge dimensions exist, how they're organized
- **Self's composition rules** — what the Self chooses to show in different contexts (learned from user behaviour)
- **Output catalogs** — per-process vocabulary of available components (ADR-009 catalogs compose and extend)

## The Extension Mechanism

When a process produces output that no existing block handles well:

1. **Escape hatch: Live Preview** — any HTML/CSS/JS renders in a sandboxed iframe. The user sees the result, not the code. This covers ~20% of outputs that structured viewers can't handle.

2. **Pattern detection** — when the same kind of Live Preview keeps being generated (e.g., "every client onboarding produces a timeline visualization"), the system detects the pattern.

3. **Build extracts** — the Build meta-process creates a new ContentBlock type (TypeScript interface + React renderer) and registers it in the block registry.

4. **Native rendering** — future compositions use the native block instead of Live Preview. Faster, more polished, integrated with the design system.

5. **Catalog extension** — the new block type is added to the process's output catalog. Other processes can compose with it.

This is the research-extract-evolve cycle (Insight-031) applied to the UI itself.

## Implications

- The implementation plan must be organized around building the composition engine, not building screens
- Sprint 1 builds the scaffold (layout shell, navigation, block registry)
- Sprint 2 builds the composition engine (Self assembles blocks into centre canvas)
- Sprint 3+ builds block renderers and reference compositions
- Every "page" in the app is a composition intent, not a fixed React page component
- Live Preview viewer is the extensibility escape hatch — must be built early
- The Build meta-process needs a "create block type" capability (Phase 11+)

## Where It Should Land

- **ADR-024** — formalises the three-tier model as an architectural decision
- **Implementation brief** — organized around composition engine, not screens
- **Architecture.md** — Layer 6 section should reference the three-tier model
- **Brief 038** — update non-goals to clarify what's MVP composition vs Phase 11+ evolution
