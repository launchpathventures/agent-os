# Insight-168: Operating Cycle Archetype — The Reusable Pattern for All Alex Capabilities

**Date:** 2026-04-09
**Trigger:** Stress-testing the "minimal process, judgment-driven" approach for sales/marketing against the existing architecture. The resolution — coarse processes with judgment-heavy steps — revealed a universal pattern that applies to every Alex capability, not just sales.
**Layers affected:** L1 Process (archetype definition), L2 Agent (identity model, mode routing), L3 Harness (new handlers), L4 Awareness (cross-cycle coordination), L5 Learning (cycle retrospective pattern)
**Status:** active

## The Insight

Every Alex capability follows the same structural pattern: an **Operating Cycle** — a coarse, continuously-running process with judgment-heavy steps, harness-enforced quality gates, and step-category trust graduation.

The cycle shape is universal:

```
SENSE  → What happened since last cycle? (inbound, signals, changes)
ASSESS → What needs attention? (prioritise, classify, triage)
ACT    → Do the work (outreach, responses, creation, maintenance)
GATE   → Quality check before anything goes external (harness handler, not prompt)
LAND   → Execute external actions (send, post, publish, book)
LEARN  → What worked? What to adjust? (retrospective, metrics, learning layer)
BRIEF  → Tell the user what happened (daily/weekly digest)
```

Not every cycle uses every phase. A purely internal cycle (strategic intelligence) might only use SENSE → ASSESS → BRIEF. A full external cycle (sales) uses all seven. The phases are composable.

### Seven Structural Components (reusable across all cycles)

1. **The Cycle Shape** — SENSE → ASSESS → ACT → GATE → LAND → LEARN → BRIEF. Each phase is a coarse step where Alex applies cognitive judgment. The harness provides rails between phases.

2. **The Identity Model** — Each cycle declares which sending identity Alex uses (alex-as-alex, alex-as-user, user-agent). Some cycles use one identity; some switch mid-cycle based on action context.

3. **The Broadcast/Direct Split** — Every external action is classified deterministically by audience size. Broadcast (many recipients) = always supervised. Direct (one recipient) = trust-governed, can earn autonomy. Classification is by channel/action type, not judgment.

4. **Step-Category Trust** — Trust graduates per phase within the cycle, not for the whole cycle at once. Internal phases (SENSE, ASSESS, LEARN) can be autonomous immediately. External phases (ACT, LAND) earn trust independently based on feedback.

5. **Handoff Triggers** — Domain-specific escalation conditions where Alex stops and pulls the user in with a full briefing. The briefing format is standardised: context, summary, recommendation, options.

6. **Quality Gate** — Structural (harness handler) quality check on every external action. Checks house values, volume limits, opt-out enforcement, cross-user rate limits. Non-bypassable regardless of trust tier.

7. **Cycle Retrospective** — Every cycle ends with a learning step that feeds L5. Domain-specific metrics, but universal structure.

### What This Means for New Capabilities

Adding a new Alex capability = writing one coarse process definition that instantiates the archetype. Define: domain-specific phases, identity model, handoff triggers, quality criteria, and metrics. The shared infrastructure (quality gate handler, identity router, broadcast/direct classifier, trust model, retrospective pattern) handles the rest.

### Infrastructure to Extract Into Core

These components are reusable across all cycles and belong in `packages/core/`:

1. **Outbound Quality Gate Handler** — structural check against house values, volume limits, opt-outs, cross-user rate limits
2. **Broadcast/Direct Classification Handler** — deterministic audience-size routing to appropriate trust model
3. **Identity Router Handler** — maps mode + channel + relationship context to sending identity
4. **Voice Calibration Memory Type** — user voice model loaded during memory injection for ghost mode
5. **Step-Category Trust Extension** — per-phase trust overrides within a process definition
6. **Handoff Briefing Pattern** — standardised escalation format (context, summary, recommendation, options)
7. **Cycle Retrospective Pattern** — standardised learning step with domain-pluggable metrics

## Implications

1. **Alex's capability surface is a set of concurrent operating cycles** sharing infrastructure. Users activate the cycles they need. A painter runs Sales + Connect + Project + Finance. A startup founder runs Hiring + Sales + Intel + Connect.
2. **New capabilities are cheap to add** once the archetype infrastructure exists. The domain-specific work is small; the reusable infrastructure does the heavy lifting.
3. **The archetype resolves the "process vs judgment" tension.** Processes provide cadence, auditability, trust graduation, and quality gates. Judgment provides the content and decisions within each phase. Neither is sufficient alone.
4. **This is the "process as primitive" principle at the right granularity.** Not task-level flowcharts (too fine, kills judgment). Not free-form operation (too coarse, loses quality control). Operating cycles are the sweet spot.

## Where It Should Land

- `docs/architecture.md` — new section: "Operating Cycle Archetype" as a first-class process pattern
- `packages/core/` — the seven reusable infrastructure components listed above
- `docs/briefs/` — brief for implementing the archetype infrastructure
- Each future capability gets its own cycle definition instantiating the archetype
