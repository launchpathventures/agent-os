# Operating Cycles — Two-Tier Process Model

## Overview

Operating cycles are coarse, continuously-running processes that follow the **Operating Cycle Archetype** (Insight-168). They provide cadence and quality gates while delegating execution to existing process templates as sub-processes.

```
Cycle (tier 1)  ──calls──>  Sub-Process (tier 2)
sales-marketing-cycle       selling-outreach, social-publishing
network-connecting-cycle    connecting-introduction
relationship-nurture-cycle  network-nurture, follow-up-sequences
```

## The Archetype

Every cycle follows a subset of seven phases:

```
SENSE  → What happened since last cycle?
ASSESS → What needs attention?
ACT    → Do the work (draft, create, prepare)
GATE   → Quality check before anything goes external
LAND   → Execute external actions (via sub-processes)
LEARN  → What worked? What to adjust?
BRIEF  → Tell the user what happened
```

Not every cycle uses every phase. The phases are composable — a purely internal cycle might only use SENSE, ASSESS, and BRIEF.

## Cycle Definitions

| Cycle | Identity | Trust | Phases Used | Sub-Processes Called |
|-------|----------|-------|-------------|---------------------|
| Sales & Marketing | agent-of-user | supervised initial | All 7 | selling-outreach, social-publishing |
| Network Connecting | principal | supervised initial | All 7 | connecting-introduction |
| Relationship Nurture | principal | supervised initial | All 7 + dual LAND | network-nurture, follow-up-sequences |

## Sub-Process Mapping

Existing templates with `callable_as: sub-process` can be invoked by cycle LAND steps:

| Sub-Process | Called By | Purpose |
|-------------|-----------|---------|
| selling-outreach | Sales & Marketing | Direct outreach execution |
| social-publishing | Sales & Marketing | Broadcast content publishing |
| connecting-introduction | Network Connecting | Introduction execution |
| network-nurture | Relationship Nurture | Nurture touch execution |
| follow-up-sequences | Relationship Nurture | Follow-up cadence execution |

All other templates also have `callable_as: sub-process` metadata and can be invoked by future cycles.

## How Sub-Process Invocation Works

A cycle step with `executor: sub-process` and `config.process_id` triggers a child process run:

1. The heartbeat resolves the target process from `config.process_id`
2. Creates a child process run with `parentCycleRunId` set to the parent cycle's run ID
3. Runs `fullHeartbeat()` on the child — same harness pipeline, same trust gates
4. Collects child run output as the step result

Child runs go through the full harness pipeline. There are no special-case execution paths.

## Trust Model

- **Broadcast steps** (social-publishing): always `critical` trust — user must approve
- **Direct steps** (selling-outreach DMs): follow step-category trust graduation
- **Internal steps** (SENSE, ASSESS, LEARN, BRIEF): can be `autonomous` immediately
- **GATE steps**: `critical` or `supervised` — quality checks are non-bypassable

Step-level `trustOverride` allows individual steps to have different trust tiers than the process default.
