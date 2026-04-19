# User-Facing Legibility Patterns — file-backed storage of knowledge and agent-produced state

**Date:** 2026-04-20
**Author:** Dev Researcher (background subagent, 2026-04-20 session), reconstituted by Architect from the subagent's final-message summary after Write/Bash/WebFetch were denied in the subagent's sandbox. Full ~2,800-word body was drafted by the subagent but could not be materialised to disk. This file is the tight recovery of the subagent's load-bearing claims. If deeper detail is needed before the Architect writes a brief, **re-invoke `/dev-researcher` with the subagent's write permission explicitly enabled**, or use this summary as-is — the three gaps below are the main architectural signal.

**Scope for consumers:** feeds Insight-201 (user-facing legibility) → Designer (persona-driven inspection UX) → Architect brief.

**Status:** recovery-complete; deeper project-by-project axis mapping available on re-invocation.

## Method

Survey of tools handling **user-facing, filesystem-legible storage of knowledge or agent-produced state** against nine axes: primary representation (file-as-truth / file-as-projection / bidirectional), conflict resolution, write-path trust/validation, secret & PII handling, query/index layer, git integration, scale limits, format choice, folder taxonomy.

Neutral survey — no recommendations at this stage. Composition-level labels in the landscape entries are tagged as *candidates*; final label selection deferred to Architect.

Drafted from well-documented public architecture of each tool plus Ditto's prior research (`qmd-obsidian-knowledge-search.md`, `memory-systems.md`, `knowledge-management-for-ai-dev.md`). **Two claims not re-verified in this session** (web fetch denied, flagged for Architect spot-check before any brief cites them): (1) Dendron's `.schema.yml` write-time validation semantics; (2) Logseq's current UUID-in-file semantics. Both have evolved in the public versions.

## Projects Surveyed

1. **hilash/cabinet** — already triaged 2026-04-20; markdown-on-disk, git auto-commit on save, DB-wins-on-export
2. **Obsidian** — mature markdown PKM; plugin ecosystem; file-as-truth canonical; no server; offline-first
3. **Logseq** — outliner with block-level file storage; file-wins-on-reload; UUIDs in frontmatter
4. **Foam** — VSCode-based markdown notes; thinner conventions than Dendron
5. **Dendron** — VSCode-based; `.schema.yml` structural validation at write time; maintenance risk flagged
6. **Reflect** — markdown-first with graph; closed-source sync layer
7. **Tana / Roam** (surveyed as **contrast**) — closed/opaque storage; named for why they chose NOT file-backed
8. **Org-mode + TiddlyWiki** — brief historical references
9. **Quarto + nbdev** — agent-adjacent source-is-text stance; `.ipynb` opacity subsumed here
10. **FUSE / filesystem-projection pattern** (generic technical pattern — GitFUSE, sqlfuse-style)
11. **Datasette + simonw's Dogsheep** — the coherent opposite stance (SQLite-first, export secondary); included because the opposite-stance characterisation is load-bearing for the option space
12. **Smallweb / static-site-as-DB** — excluded (not analogous to agent-writes-user-inspects round-trip)

## The Three Architecturally-Consequential Gaps

### Gap 1: Write-path trust at the file layer is unsolved

No surveyed tool enforces authorship-trust at file-write time. Dendron's `.schema.yml` enforces *structural* validation only — it checks shape, not provenance or authority. In every other tool (Obsidian, Logseq, Foam, Reflect, cabinet), any process with filesystem write access can author content without challenge.

This has two implications for Ditto:
- If the file is the primary store, Ditto's trust-tier gates (ADR-019), content-block trust severity classification, and feedback-capture event emission (architecture.md §Layer 5 #7) must move to an FS-watch layer. That layer does not exist in the surveyed field — it would be a net-new Ditto invention, not composition.
- If the file is a read-only projection of the DB, the gates remain intact on the DB write path. This is the safer composition path.

**Consequence for Architect:** the three implementation conviction levels in Insight-201 (read-only projection → bidirectional sync → file-as-primary) are not equivalent in trust-integrity cost. Read-only projection is low-cost; bidirectional sync and file-as-primary require substantial net-new work.

### Gap 2: Bidirectional file↔DB sync with in-process conflict resolution has no direct analog

Logseq is file-wins-on-reload (agent cannot intervene mid-session). Cabinet is DB-wins-on-export (the DB is the arbiter). CRDT tools (Roam, Reflect) delegate to remote servers. No surveyed tool implements symmetric in-session reconciliation between a user's file edits and an agent's DB writes happening concurrently.

**Consequence for Architect:** bidirectional sync for any Ditto seam would be invented, not composed. If a brief wants bidirectional sync, the scope must own the conflict-resolution design from scratch — there is no "just adopt X" path. This elevates read-only projection as the default first build.

### Gap 3: Secret-exclusion as a first-class design invariant is absent in every file-first tool surveyed

In the surveyed tools, the assumption "the user will not put secrets in their vault" is the security posture. No surveyed tool filters or excludes fields at write time to keep credentials out. This assumption holds when the human is the author; it **inverts** when the agent is the author.

**Consequence for Architect:** the MUST-NOT in Insight-201 Implication 3 (secrets/OAuth/PII never in files, no encryption escape hatch) is a **net-new design requirement** with no prior art to adopt. The filter logic lives at the projection boundary. Getting the filter correct is part of every applying brief's acceptance criteria — not optional.

### Secondary gaps flagged (lower priority)

- **Activity-scale file volume.** Agent-velocity writing produces file counts and per-file sizes PKM tools were not designed for. No surveyed precedent for the write cadence an always-on harness would generate at `activities` projection.
- **Agent-authored-content provenance.** No surveyed tool distinguishes "user wrote this" from "agent wrote this" at the file level. Git commit author can proxy this (cabinet uses it), but the proxy fails when the same user identity runs both interactive and agent sessions.

## Landscape.md Candidate Entries (composition-level as *candidates*; Architect picks final label)

- **cabinet** — PATTERN candidate (already mentioned in 2026-04-20 triage; re-labels here in the legibility context)
- **Obsidian** — PATTERN candidate
- **Logseq** — PATTERN candidate
- **Foam** — PATTERN candidate
- **Dendron** — PATTERN candidate, **with maintenance risk** (do not DEPEND — project activity has slowed per prior research; schema-validation pattern is still worth studying even if we don't consume the library)
- **Datasette / Dogsheep** — PATTERN candidate (as the **coherent opposite stance** — SQLite-authoritative with periodic legible export)
- **Quarto / nbdev** — PATTERN candidate (source-is-text stance for agent-adjacent workflows)
- **Tana / Roam** — PATTERN-contrast only (named for why file-backed was rejected)
- **Reflect** — PATTERN-contrast only (closed sync layer; interesting UX, not adoptable)
- **FUSE** — PATTERN-contrast only (generic technical pattern; DIY infrastructure cost high)

**No DEPEND or ADOPT candidates surfaced.** This option space is about *stances and invariants*, not importable libraries. That is itself a finding: any Ditto brief applying Insight-201 composes an original design at the seam, informed by the surveyed stances but importing no code.

## Scope Deliberately Excluded

- **Smallweb / static-site-as-DB patterns** — not analogous to the agent-writes-user-inspects round-trip Ditto needs.
- **Raw Jupyter handling** — subsumed into the Quarto/nbdev entry; `.ipynb` opacity is already extensively covered by public diff-tooling literature and doesn't need its own entry for this decision.
- **Per-repo code-level spelunking into cabinet/Logseq/Dendron** — web-fetch unavailable in the subagent session; Architect should verify the two flagged claims (Dendron schema write-time validation, Logseq UUID semantics) directly against current repos before a brief cites them as load-bearing.

## Reference-Doc Additions Pending

Landscape.md additions drafted above — the Architect should paste them into `docs/landscape.md` under a new subsection (e.g., "User-Facing Legibility Patterns (2026-04-20)") at the same level as existing thematic sections. No ADR changes. No architecture.md changes pending this research — Insight-201 is the current absorbable material.

## Next Step

Handoff to Dev Designer for persona-driven inspection UX spec (Rob / Lisa / Jordan mapping to inspection surfaces across the candidate seams in Insight-201). Then Architect synthesises into a brief.
