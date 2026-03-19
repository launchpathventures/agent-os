# Brief: {Phase/Task Name}

<!--
Template provenance:
- Goal → Issue → Work Product → Approval structure from Paperclip (paperclipai/paperclip)
  /packages/db/src/schema/goals.ts, /packages/db/src/schema/issues.ts
- Non-Goals section from Rust RFC template (rust-lang/rfcs)
- Acceptance criteria as boolean pass/fail from compound-product (snarktank/compound-product)
- Constraints pattern from antfarm agent AGENTS.md (snarktank/antfarm)
- Provenance section original to Agent OS
- Review gate from Paperclip pr-report skill (.agents/skills/pr-report/SKILL.md)
-->

## Goal

Which roadmap item(s) does this brief serve? Link to `docs/roadmap.md` phase and capability.

- **Roadmap phase:** {Phase N: Name}
- **Capabilities:** {specific roadmap rows this brief delivers}

## Context

Why does this work exist? What prompted it? What's the current situation?

## Objective

What does success look like? One or two sentences.

## Non-Goals

What this brief explicitly does NOT cover. Prevents scope creep.

- ...

## Inputs

What to read before starting. List specific files with their purpose:

1. `{file path}` — {why to read it}
2. ...

## Constraints

What NOT to do. Boundaries. Things that must be preserved.

- ...

## Provenance

Where do the patterns for this work come from? Include why each source was chosen.

| What | Source | Why this source |
|------|--------|----------------|
| {pattern/approach} | {project} `{file path}` | {why it fits} |
| ... | ... | ... |

## What Changes (Work Products)

What files are created, modified, or deleted? These are the deliverables.

| File | Action |
|------|--------|
| `{file path}` | {Create / Rewrite / Modify / Delete}: {what specifically changes} |
| ... | ... |

## Acceptance Criteria

How do we verify this work is complete? Each criterion is boolean: pass or fail.

1. [ ] {testable criterion}
2. [ ] {testable criterion}
3. ...

## Review Process

How to validate the work after completion:

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: {specific things to verify for this task}
3. Present work + review findings to human for approval

## After Completion

1. Update `docs/state.md` with what changed
2. Update `docs/roadmap.md` status for completed items
3. Phase retrospective: what worked, what surprised, what to change
4. Write ADR if a significant decision was made (use `docs/adrs/000-template.md`)
