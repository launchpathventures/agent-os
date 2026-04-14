# Insight 182: Outreach Requires Plan-Approve-Execute, Not Execute-Report

**Date:** 2026-04-14
**Status:** active
**Emerged from:** Brief 149 design — user received 200+ outreach status emails with no visibility into targeting or effectiveness
**Affects:** sales-marketing cycle, network-connecting cycle, status-composer, cycle-tools

## The Insight

Autonomous outreach without upfront strategy approval destroys user trust faster than any other system behavior. The user's first experience of Alex sending 200 emails with no plan, no visibility, and no volume control is indistinguishable from spam automation.

The pattern must be: **plan -> approve -> execute -> learn -> adjust -> repeat**. Not: **execute -> report**.

## Three Corollaries

### 1. Volume scales with demonstrated results, not time

Default volume ladder: 5 -> 10 -> 20 per cycle. Scaling requires positive response rate from the previous batch. User can override in either direction. The volume budget is a `cycleConfig` parameter (Insight-179: plan is a process instance, not a new object).

### 2. Strategy is a conversation, not a form

Alex presents the target list conversationally. The user iterates via email or workspace chat. Alex confirms understanding and re-presents. No outreach until explicit "go ahead." The conversational iteration uses the same `selfConverse()` path regardless of surface.

### 3. Visibility must be continuous and structured, not delayed and textual

Status emails with "204 outreach messages sent" are useless. Users need per-person results: who was contacted, what happened, what's next. Rendered as HTML tables in email, InteractiveTableBlocks in workspace — same data, surface-appropriate format.

## Relationship to Other Insights

- Insight-168 (Operating Cycle Archetype): strategy step fits between ASSESS and ACT
- Insight-179 (Plan = Process Instance): volume budget is cycleConfig, not a new table
- ADR-027 (Cognitive Orchestration): strategy sub-process is thin (2 steps), Self handles iteration
- Insight-167 (Broadcast Supervised, Direct Autonomous): volume governance is orthogonal to trust tiers — even autonomous direct outreach respects volume caps
