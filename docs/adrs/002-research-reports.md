# ADR-002: Research Reports as Durable Artifacts

**Date:** 2026-03-19
**Status:** proposed

## Context

Ditto follows a strict Research → Design → Build → Review cycle. The Dev Researcher produces detailed pattern analysis — specific file paths in source projects, how patterns work at the code level, gaps identified, build-from vs Original classifications. This is the primary input to the Dev Architect.

Currently, research findings exist only in conversation context. They evaporate when the session ends. This creates three problems:

1. **Re-research tax** — The same source projects get re-investigated across sessions. The Phase 2 research examined 7 projects across 100+ source files. That work is lost unless persisted.
2. **Broken provenance chain** — Briefs reference source projects in their Provenance table, but the detailed "how it works" analysis that informed those decisions has no home. A future builder or reviewer can see *what* was chosen but not *what was considered and why*.
3. **No knowledge compounding** — Each research session starts from scratch instead of building on prior findings. This violates the project's own learning principle.

The landscape doc (`docs/landscape.md`) evaluates frameworks at a high level (what they are, relevance rating). Research reports go deeper — specific files, implementation details, code-level patterns. These are complementary, not redundant.

The research itself confirmed this gap: across antfarm, Paperclip, Sim Studio, Open SWE, Mastra, Trigger.dev, and Inngest, none persist scouting/design intelligence. They all focus on operational memory (what happened during execution) or agent identity (who am I). Research knowledge — "how does project X implement pattern Y" — has no precedent in the landscape.

## Decision

Create `docs/research/` as a persistent home for research reports. One file per research topic.

**Naming:** Descriptive, not numbered. Research is referenced by topic, not sequence. Examples: `phase-2-harness-patterns.md`, `cli-framework-evaluation.md`, `trust-tier-mechanisms.md`.

**Structure:**

```markdown
# Research: {Topic}

**Date:** {YYYY-MM-DD}
**Researcher:** {Dev Researcher session}
**Phase:** {which roadmap phase this feeds}
**Status:** active | superseded by {file}

## Research Question

{What we needed to find out}

## Sources Examined

{List of projects/repos investigated, with brief rationale for inclusion}

## Findings

{Organised by capability area. Each finding includes:}
- Source project + specific file path
- How it works (factual description)
- What it provides

## Gaps

{Capabilities where no existing solution was found, marked as Original to Ditto}

## Deferred / Out of Scope

{What was intentionally not researched and why}

## Review

{Summary of reviewer findings — was the research approved, what caveats}
```

**Lifecycle:**
- **Active** — current findings, referenced by briefs
- **Superseded** — newer research exists on the same topic. Keep the old file (history), update status and link to replacement

**Referenced from:**
- Brief `Inputs` section: "Read `docs/research/phase-2-harness-patterns.md` for the pattern analysis"
- Brief `Provenance` section: decisions trace back to specific research findings
- Landscape doc remains the high-level evaluation; research reports are the detailed companions

**Relationship to other doc types:**

| Doc type | What it captures | Granularity | Lifecycle |
|----------|-----------------|-------------|-----------|
| `docs/landscape.md` | Framework evaluations, fit ratings | High-level | Updated when landscape changes |
| `docs/research/*.md` | Detailed pattern analysis, file paths, how things work | Code-level | Per research session, superseded when re-researched |
| Brief `Provenance` table | Which patterns were chosen and why | Decision-level | Fixed at brief creation |
| `docs/adrs/*.md` | Significant technical decisions | Decision-level | Fixed at decision time |

**Dev process changes:**
- Dev Researcher skill: output goes to `docs/research/` as a file, not just conversation
- Dev Architect skill: `docs/research/` added to Required Inputs
- CLAUDE.md: `docs/research/` added to Design Documents list
- Dictionary: "Research Report" added as a term

## Provenance

Original — no existing framework in the landscape persists design intelligence / scouting knowledge as a distinct artifact type. The closest analogues:

- **ralph** — three-tier state (git + progress.txt + prd.json) persists execution state but not research findings
- **"AI Ditto" practitioner pattern** — `memory.md` persists agent learning but not cross-project pattern analysis
- **Paperclip** — activity log persists operational events but not design rationale

The convention of structured research reports as project artifacts draws from academic/consulting practice (literature reviews, technology radar) rather than any software framework.

## Consequences

- **Easier:** Future sessions can build on prior research instead of starting from scratch. The Phase 2 research (7 projects, 100+ files) is now reusable.
- **Easier:** Brief provenance has a traceable source — "we chose antfarm's verify_each because [research report finding X]."
- **Easier:** Reviewer can check whether the architect considered all research options, not just the chosen one.
- **Harder:** Research reports can go stale if source projects change. Mitigated by the `superseded` lifecycle status.
- **New constraint:** Dev Researcher must now write a file, not just present findings in conversation. This adds overhead but the value compounds across sessions.
- **Follow-up:** The current Phase 2 research (in this session's conversation) should be persisted as the first research report.
