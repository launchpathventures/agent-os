# Agent OS — Development Process

**Last updated:** 2026-03-19

This document describes how Agent OS gets built. It formalises the role separation that disciplines each development session — the solo-founder hat-switching problem made explicit.

---

## Why Role Separation

Agent OS is built by a human and a single AI agent. The AI plays every role — PM, researcher, architect, builder, reviewer, documenter. Without explicit separation, roles blur: the builder redesigns mid-implementation, the reviewer softens findings on its own work, the researcher skips to recommending.

Role separation doesn't require multiple agents. It requires conscious hat-switching — like a solo founder who puts on their marketing hat, then their product hat, then their sales hat. The mental frame changes even when the person doesn't.

Each role is implemented as a **skill** (slash command) that loads the role contract into active context. When invoked, the skill constrains what the AI does and doesn't do in that role.

---

## The Six Meta-Roles

| Role | Skill | One-line purpose |
|------|-------|-----------------|
| **Dev PM** | `/dev-pm` | Triage and sequence — what to work on next |
| **Dev Researcher** | `/dev-researcher` | Find existing solutions — what can we build FROM? |
| **Dev Architect** | `/dev-architect` | Design the solution — produce briefs and ADRs |
| **Dev Builder** | `/dev-builder` | Implement the approved plan as code |
| **Dev Reviewer** | `/dev-reviewer` | Challenge the work against the architecture |
| **Dev Documenter** | `/dev-documenter` | Update state, roadmap, run retrospective |

The full contract for each role lives in `.claude/commands/dev-*.md`. This document summarises the system; the skills are the source of truth.

---

## Session Flow Patterns

### Pattern A: Pick up the next brief (most common)

```
Human: "Let's pick up the next piece of work"
  → Dev PM: reads state.md + roadmap.md, recommends work
  → Dev Researcher: scouts existing solutions (if research needed)
  → Dev Architect: designs solution, writes brief
  → Human: reviews and approves brief
  → Dev Builder: implements the brief
  → Automated checks: type-check, acceptance criteria
  → Dev Reviewer: challenges against architecture (fresh context)
  → Human: approve / reject / revise
  → Dev Documenter: updates state.md, roadmap.md, runs retro
```

### Pattern B: Fix a small issue

```
Human: "Fix this specific problem"
  → Dev Builder: implements the fix
  → Automated checks: type-check
  → Dev Reviewer: checks the fix (can be lighter-weight)
  → Human: approve
  → Dev Documenter: updates state.md if needed
```

### Pattern C: Exploratory design session

```
Human: "I want to think about X"
  → Dev Researcher: explores what exists
  → Dev Architect: designs the approach
  → Dev Reviewer: challenges the design
  → Human: approves, refines, or parks it
```

### Pattern D: Documentation only

```
Human: "Update the docs for what we did"
  → Dev Documenter: updates state.md, roadmap.md
  No review needed for pure state tracking.
```

---

## Separation Guidance

### Must be genuinely separated

**Builder and Reviewer.** This is the most critical separation. The architecture's maker-checker pattern requires it. The reviewer must operate with fresh context — spawned as a separate agent. Blending these defeats the purpose. The developer does not mark their own homework.

**Researcher and Architect.** The researcher presents options neutrally. The architect makes decisions. If blended, research gets biased toward the solution you already want to build. The "composition over invention" principle requires honest research that might conclude "there's nothing to borrow here."

### Should be separated but can be lighter-weight

**PM and Architect.** Different questions: what to work on vs how to do it. But in a solo-founder context, the PM role is often 30 seconds of reading state.md. It doesn't need heavyweight separation — just a conscious pause.

**Builder and Documenter.** Different outputs but similar context. Separating them prevents "I'll update the docs later" drift.

### Fine to blend

**PM and Documenter.** Both are about project state awareness. The PM reads state; the Documenter writes state. Same mental frame.

---

## Quality Check Layering

Software development has a self-governing quality infrastructure: linters, type checkers, tests, CI/CD. These catch errors mechanically before human review. The agent doesn't need to be perfect — it needs to be testable.

Agent OS development applies this principle directly:

1. **Automated checks run first** — `pnpm run type-check`, acceptance criteria from the brief
2. **Structured review second** — Dev Reviewer checks against the 8-point architecture checklist
3. **Human judgment last** — only on what passed everything else

The Builder skill explicitly requires automated checks before handoff to the Reviewer. This layering is the seed for the harness's general quality infrastructure (see Insight-001: Quality Criteria Are Additive).

---

## Provenance

The six-role development process is **original to Agent OS**. No existing framework formalises how a single AI agent should switch between constrained roles during a collaborative development session. The closest analogues are:

- **gstack** — defines specialised agent roles (planner, builder, reviewer) but for product work, not meta-development
- **antfarm** — enforces maker-checker separation but through separate agent invocations, not role contracts
- **Rust RFC process** — the brief template draws from RFC structure (context, motivation, design, drawbacks)

The insight system (one file per discovery, template-based, absorbed when mature) is **original** — a staging ground between informal observations and formal ADRs.

## Feedback Capture

In the automated harness, every human decision (approve/edit/reject) is recorded in the feedback table and feeds the learning layer. In the manual dev process, this structured capture doesn't exist yet.

Currently, feedback from the development process is captured through:
- **Conversation** — the human's corrections and observations (ephemeral)
- **State updates** — what changed and retrospective notes (durable but unstructured)
- **Insights** — design discoveries captured in `docs/insights/` (durable and structured)

What's missing: a structured record of *why* work was approved, rejected, or revised. This becomes available when the harness exists — at that point, the dev process's approve/reject decisions flow through the same feedback pipeline as any other process.

For now, the retrospective ("what worked, what surprised, what to change") is the closest substitute. The Dev Documenter skill captures this explicitly.

## From Skills to Harness

These role contracts are the manual precursor to the automated harness. Here's how each element maps:

| Role Contract Element | Future Harness Equivalent |
|----------------------|--------------------------|
| Purpose statement | Agent system prompt |
| Constraints (MUST NOT) | Harness enforcement rules (L3) |
| Required inputs | Process step inputs (L1) |
| Expected outputs | Process step outputs (L1) |
| Handoff protocol | Step sequencing + dependency resolution (L2) |
| "Fresh context" requirement | Session management policy (L2) |
| Automated checks | Executable quality criteria (L3) |

The transition from skills to harness is a trust decision, not an architecture decision. Skills rely on AI discipline + human oversight. The harness enforces mechanically. Convert when you want automated enforcement — when the process is repeatable enough and the quality criteria are mature enough that the system can govern itself.

This follows the project's own core thesis: **conversation crystallises into process definition.**
