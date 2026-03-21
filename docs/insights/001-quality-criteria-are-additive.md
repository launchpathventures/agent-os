# Insight-001: Quality Criteria Are Additive, Not Upfront

**Date:** 2026-03-19
**Trigger:** Session discussion on generalising coding's quality infrastructure (linters, tests, CI/CD) to any domain
**Layers affected:** L1 Process, L3 Harness, L5 Learning
**Status:** active

## The Insight

What makes coding agents powerful isn't the agent — it's the infrastructure. Linters, type checkers, tests, and CI/CD form a self-governing quality system that catches errors mechanically before any human reviews the output. The agent doesn't need to be perfect; it needs to be testable.

Most non-coding domains lack this infrastructure. Quality is assessed by a human reading the output and making a judgment call. This is why non-coding agents feel unreliable — there's nothing between the agent's output and the human's eyes.

The solution is not to require humans to define quality criteria upfront. Most humans can't articulate what good looks like until they see bad. A good manager doesn't start by writing a quality specification — they set a rough direction, react to early outputs, and build the standard through feedback. The standard emerges from use.

Ditto should help humans **discover** quality criteria, not require them to define criteria in advance:

1. Process starts with loose criteria ("report should be useful and concise")
2. Agent produces output, human reacts (approve, edit, reject)
3. System captures the reaction structurally — what was changed? What patterns emerge?
4. System proposes tighter criteria ("You've edited the last 4 reports to add a risk section. Should 'includes risk assessment' be a quality criterion?")
5. Human approves the criterion — now it's executable
6. Next time, a reviewer checks for it before the human sees the output
7. Over time, the quality spec writes itself from human behaviour

Each human correction becomes a candidate for a permanent quality gate — exactly how a bug in code becomes a regression test.

## Implications

**For the harness (L3):** The harness is not just "agents checking agents." It's a CI/CD pipeline for any domain. Review patterns should support executable quality criteria that grow over time, not just static checklists.

**For trust tiers (L3):** Trust depends on criteria maturity, not just agent track record. A process with zero executable quality criteria cannot be autonomous — there's nothing to verify quality with. The upgrade path from supervised to autonomous requires both a good track record AND a mature quality specification.

**For the learning layer (L5):** The feedback loop (L5) should feed back into the process definition (L1) by proposing new quality criteria extracted from correction patterns. This is the mechanism by which the quality spec writes itself.

**For process definitions (L1):** `quality_criteria` in process definitions should be treated as a living, growing list — not a static requirement set at process creation time. The schema should support criteria that are tagged with their origin (human-defined vs system-proposed) and their maturity (new vs battle-tested).

## Where It Should Land

- **Architecture spec (L3 Harness):** Add principle that quality criteria are additive and emerge from feedback
- **Architecture spec (L3 Trust):** Add criteria maturity as a factor in trust tier eligibility
- **Phase 2 brief:** Include executable quality criteria as a harness capability
- **Phase 3 brief:** Trust earning should account for criteria coverage, not just approval rates
