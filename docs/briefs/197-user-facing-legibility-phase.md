# Brief 197: User-Facing Legibility — Phase Design

**Date:** 2026-04-20
**Status:** ready
**Depends on:** Insight-201 (user-facing legibility principle); `docs/research/user-facing-legibility-patterns.md` (option-space research); `docs/research/memories-legibility-ux.md` (Designer UX pass for the pilot sub-brief)
**Unlocks:** sub-brief 198 (memories legibility, pilot); future sub-briefs for outbound / inbound / generated / feedback / improvements / work_items / process_versions / activities

## Goal

- **Roadmap phase:** Phase 9+ (trust, legibility, user ownership — foundational product properties)
- **Capabilities delivered by the phase:**
  - Users can inspect, on their local filesystem, what Ditto has learned, sent, received, and produced on their behalf
  - Ditto's state across user-facing seams becomes grep-able, git-trackable, and OS-file-browseable
  - Trust calibration, audit trails, and quality governance become filesystem-legible operations, not UI-only operations
  - Secrets and PII are categorically excluded from the legible surface (hard MUST-NOT)

## Context

Insight-201 established that **at user-facing data seams, the default representation should be filesystem-like (markdown on disk, grep-able, git-trackable)**, with DB-opacity as the exception that must justify itself. Research (`user-facing-legibility-patterns.md`) surveyed cabinet, Obsidian, Logseq, Foam, Dendron, Datasette, FUSE projection patterns — and surfaced three architecturally-consequential gaps with no prior art: (1) write-path trust at the file layer, (2) bidirectional file↔DB sync, (3) secret-exclusion as a first-class design invariant. Designer pass (`memories-legibility-ux.md`) developed persona-driven UX for the memories pilot and validated the pattern.

During architect review, the scope widened: the user-facing legibility demand is not only about **internal state** (what Ditto remembers) but about **"what did Ditto do on my behalf"** — outbound communications sent, inbound communications received and processed, and business artefacts generated. These categories have higher persona pain (Rob's *"did you actually send that?"* anxiety is stronger than *"what do you remember?"*) but also carry a substantive **artefact-canonicalisation prerequisite**: the content is not currently persisted as discrete retrievable artefacts (outbound bodies live in `step_runs` JSON blobs; generated artefacts are composed in-flight and not persisted; inbound communications are strewn across `activities` and integration-broker archives).

This parent brief designs the legibility **phase** across all four categories. Sub-briefs ship per category. Category 4 sub-briefs (internal state) are the cheapest and ship first as pilots; Categories 1–3 sub-briefs each own a canonicalisation-prerequisite before projection can apply.

## Objective

Establish file-backed legibility as the durable pattern for Ditto's user-facing state across four categories (outbound, inbound, generated, internal), starting with memories as the proof-of-pattern pilot and expanding category-by-category. Categorically exclude secrets and PII. Keep the engine-core boundary clean (projection is product-layer).

## Non-Goals

- **No bidirectional file↔DB sync in v1.** Read-only projection only (DB authoritative, file regenerated on write). Bidirectional sync deferred per Insight-200 behind a named trigger (see §Constraints).
- **No file-as-primary-store in v1.** DB remains authoritative; files are downstream projections. File-as-primary is a v3+ concern, if ever.
- **No mobile file editing.** Per personas.md and Insight-012 ("Edit @ desk"), file editing is a desktop-only affordance across all sub-briefs.
- **No Category 1–3 implementation in the pilot sub-brief (198).** Outbound / inbound / generated sub-briefs require artefact-canonicalisation work first and have their own research passes before build.
- **No pre-reservation of future sub-brief numbers** (per Insight-200). Sub-briefs claim numbers at scheduling time.
- **No new trust-tier mechanics.** Projection must honour existing trust-tier gates (ADR-019); if it can't, the pattern is wrong for that seam and the brief that proposed it must be rejected.
- **No replacement of existing UI surfaces.** Legibility files are an additional inspection surface; the conversational UI, Artifact mode, and composition intents remain primary.

## Inputs

1. `docs/insights/201-user-facing-legibility.md` — the principle and the four-category breakdown
2. `docs/research/user-facing-legibility-patterns.md` — option-space survey + three research gaps
3. `docs/research/memories-legibility-ux.md` — Designer UX pass for the pilot sub-brief
4. `docs/personas.md` — primary lens; Rob / Lisa / Jordan / Nadia and the six problems (especially Problem 1 "can't delegate" and Problem 5 "can't see reasoning")
5. `docs/human-layer.md` — the six jobs; 26 ContentBlock types; composition-intent destinations
6. `docs/architecture.md` — §Layer 5 #6 (brief lifecycle sync precedent for file-as-primary); §Layer 6 (human layer); §Cross-Cutting Governance
7. `docs/adrs/019-trust-tiers.md` — trust-tier integrity constraint
8. `docs/adrs/025-centralized-network-service.md` — workspace deployment context
9. `packages/core/src/db/schema.ts` — canonical table list and field shapes
10. `docs/dev-process.md` §Autopilot — build discipline
11. Insight-004 (brief sizing), Insight-050 (validate before infrastructure), Insight-068 (composition levels), Insight-111 (signal separation), Insight-127 (trust signals not activity traces), Insight-180 (stepRunId guard; spike tests), Insight-190 (migration journal discipline), Insight-200 (interface seam + named trigger)

## Sub-Brief Index

| # | Category | Seam | Status | Notes |
|---|----------|------|--------|-------|
| **198** | **Infrastructure (refactor)** | Memory write-path chokepoint | **draft this session** | **Prerequisite for 199.** Introduces single `writeMemory()` helper; migrates ~8 non-test call-sites. Independent value: observability and testability across every memory write path. |
| **199** | **4 (internal)** | `memories` projection + safety filter | **draft this session** | **Pilot seam.** Depends on 198. Includes the fail-closed credential/PII classifier and the regression corpus. Designer UX complete in `docs/research/memories-legibility-ux.md`. |
| **200** | **Infrastructure (phase)** | Workspace git-over-HTTPS server + bootstrap | **draft this session** | **Shared across ALL future legibility sub-briefs.** Ditto serves the workspace projection as an authenticated git remote; user runs `git clone https://ditto.you/<workspace-slug>/ws.git`. **No GitHub or other external-service dependency.** Can build in parallel with 198+199; unlocks user-facing access once the projection exists. |
| (TBD) | 1 (outbound) | emails sent, DMs, posts | future | **Requires research pass on artefact canonicalisation** (persisted sent-email shape, LinkedIn post archival, DM history) before Designer + Architect briefs |
| (TBD) | 2 (inbound) | received emails, voicemails, forms | future | Same canonicalisation prerequisite as Category 1 |
| (TBD) | 3 (generated) | quotes, invoices, reports, briefings, content drafts | future | Same canonicalisation prerequisite |
| (TBD) | 4 (internal) | `improvements`, `work_items`, `process_versions`, `feedback`, `activities` | future (each its own sub-brief) | No canonicalisation prerequisite; ship after memories pattern is validated. Each reuses Brief 200's git-server infrastructure for zero-additional-cost user access. |

Per Insight-200 hygiene, future sub-briefs are **not** pre-numbered. They claim numbers at scheduling time.

**Build sequencing:** 198 must complete before 199. 200 has no dependency on 198/199 and can build in parallel. The pilot is demonstrable end-to-end once 198 + 199 + 200 all ship.

## Constraints (apply to every sub-brief)

- **Read-only projection only in v1.** DB writes trigger file regeneration. User edits to files are NOT honoured in v1 (workspace-level note in `memories/README.md` explains the round-trip). Trigger for v2 bidirectional (per Insight-200): **"3+ distinct users whose behaviour matches 3+ persona archetypes have explicitly requested file-editing for a specific type within a rolling 90-day window."** Not before. Personas are archetypes; the trigger is about distinct users, not distinct persona-labels.
- **Secrets and PII MUST NOT project** (Insight-201 Implication 3). Tier 2+ credentials, OAuth tokens, access keys, session cookies, refresh tokens, and per-recipient PII are categorically excluded. Encryption-at-rest is not a valid escape hatch. Every sub-brief carries a regression corpus as acceptance criterion.
- **Filter fails closed.** Any memory entry or artefact that cannot be classified with confidence is quarantined (`[QUARANTINED — flagged for review]`), not projected.
- **Engine-core boundary.** Projection logic lives in `src/engine/` or `packages/web/`. **Never** in `@ditto/core`. Core exposes typed read APIs; the projection consumes them. Violates CLAUDE.md rule 4 if this is ignored. The boundary test also forbids new imports from `src/` into `packages/core/` (hidden cross-package coupling is the primary violation vector, not surface file edits).
- **Trust-tier integrity.** Projection runs at DB write time (post-trust-gate). File is downstream; cannot mutate back into the DB. ADR-019 gates remain on the write path.
- **Git auto-commit on every projection write** (pattern from hilash/cabinet — 2026-04-20 triage; also cited in Insight-201 §Implementation conviction levels), message shape `[legibility:category/seam] <verb> <entity-name>`. Ditto runs git; user does not need git literacy to use the product.
- **Workspace projection target is container-internal.** The projection root lives inside the Ditto workspace's Railway container volume (e.g., `/workspace/memories/`), not on the user's laptop. User access is via Brief 200's git-over-HTTPS server — the user `git clone`s the workspace from Ditto. **Ditto is the git server; no external-service dependency (no GitHub, no GitLab, no Gitea).** Users who want to mirror to a personal GitHub can add their own remote; Ditto does not require or assume it.
- **Side-effecting function guard (Insight-180).** Functions that write to the filesystem outside the workspace folder must require `stepRunId`. Projection writers that write only within the workspace container volume are exempt (no external side effects); the exemption must be documented inline in each projector file. Functions that serve the projection over network (Brief 200's git-over-HTTPS endpoint) require `stepRunId` if they have side effects; pure read-serving endpoints do not.
- **Mobile is read-only.** Across all sub-briefs, mobile surfaces show content but do not allow editing (even in v2). "Edit @ desk" (Insight-012). Clone-and-edit workflow is desktop-only by construction — mobile `git clone` is impractical for Rob's usage pattern.
- **No external git-hosting dependency.** Ditto must not require users to create or own accounts on GitHub, GitLab, Gitea, or any third party for legibility to function. Brief 200 makes Ditto itself the authenticated git remote. This constraint exists to honour the personas constraint that Rob (SMB trades) has no reason to create a GitHub account.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| File-as-truth PKM pattern | Obsidian (public architecture) | pattern | Mature, settled; non-adoptable (user owns their choice of editor) — study the markdown+frontmatter shape |
| Git auto-commit on every save | hilash/cabinet (2026-04-20 triage) | pattern | Direct fit for projection round-trip; cabinet is a product, not a library; we implement the pattern |
| Block-level file storage with UUID in frontmatter | Logseq (public architecture; **verify current semantics**) | pattern | Reference for per-entity IDs in markdown files |
| Structural schema validation | Dendron `.schema.yml` (**verify; project has maintenance risk**) | pattern | Architectural reference only; do not depend |
| SQLite-authoritative with legible export stance | simonw/Datasette + Dogsheep | pattern-contrast | Named because it is the **coherent opposite** of file-first — grounds the tradeoff conversation |
| Brief lifecycle sync (file-as-primary, DB-as-index) | Ditto `docs/architecture.md` §Layer 5 #6 | pattern | **Internal precedent** — this exact pattern already works in Ditto for briefs/ADRs/insights; legibility phase generalises it |
| Named-trigger parking for deferred capability | Ditto Insight-200 | pattern | How v2 bidirectional sync is parked |

No `depend` or `adopt` candidates — legibility is a design pattern, not an importable library. Research confirmed this explicitly.

## What Changes (Phase-Level Work Products)

This parent brief does not itself ship code. Its work products are design artefacts that govern sub-briefs.

| File | Action |
|------|--------|
| `docs/briefs/197-user-facing-legibility-phase.md` | Create: this brief (phase design) |
| `docs/briefs/198-memories-legibility.md` | Create this session: pilot sub-brief |
| `docs/insights/201-user-facing-legibility.md` | Already created + reviewed + revised in this session; referenced here as the principle |
| `docs/research/user-facing-legibility-patterns.md` | Already created; option-space research |
| `docs/research/memories-legibility-ux.md` | Already created; Designer UX for pilot |
| `docs/architecture.md` §Layer 6 (future) | Absorb Insight-201 as a §Legibility subsection **after** two sub-briefs have applied the pattern end-to-end (Insight-201 absorption criterion). Not this session. |
| `docs/landscape.md` (future) | Add a "User-Facing Legibility Patterns (2026-04-20)" section with the seven draft entries from the research file. Deferred to the Documenter. |

## User Experience (phase-level)

- **Jobs affected:** the six existing human jobs are preserved; this phase proposes a **seventh job, Curate** — *"Is what Ditto knows, has sent, has received, or has produced correct and mine?"* — sub-brief 198 instantiates Curate for the memories seam specifically. If Curate does not prove out across two sub-briefs, it folds into Orient + Decide at phase absorption.
- **Primitives involved:** existing `DataBlock`, `KnowledgeCitationBlock`, `StatusCardBlock`, `SuggestionBlock`, `AlertBlock`, `ArtifactBlock`. One proposed net-new primitive (`MemoryBlock`) contained to sub-brief 198; other sub-briefs will propose analogous seam-specific blocks.
- **Process-owner perspective:** the user gains a parallel inspection surface. The conversational UI, Artifact mode, and composition intents remain primary; legibility files are the "dive in and look" affordance that builds durable trust (personas.md Problem 1) and exposes audit trails (Problem 5).
- **Interaction states:** phase-level pattern only: file exists → content rendered read-only in OS file browser or editor; sealed → `[SEALED]` marker with human-readable reason; quarantined → `[QUARANTINED]` marker flagged for admin review.
- **Designer input:** `docs/research/memories-legibility-ux.md` (pilot). Each future sub-brief must include its own Designer pass before build.

## Acceptance Criteria (parent-level)

The parent brief is "complete" when the phase design is in place and governs the first sub-brief cleanly. These ACs are boolean and testable.

1. [ ] Insight-201 exists, is reviewed (APPROVE_WITH_REVISIONS with all CRITICAL/IMPORTANT fixes applied), and names the four-category breakdown explicitly (outbound / inbound / generated / internal).
2. [ ] Research report `docs/research/user-facing-legibility-patterns.md` exists with the three architecturally-consequential gaps (write-path trust, bidirectional sync, secret exclusion) and >=6 surveyed projects.
3. [ ] Designer UX pass `docs/research/memories-legibility-ux.md` exists with persona-anchored jobs for Rob / Lisa / Jordan / Nadia and the sealed-memory filter design.
4. [ ] Sub-briefs 198 (memory write chokepoint refactor), 199 (memories projection + safety filter), and 200 (workspace git-over-HTTPS server) exist in `docs/briefs/` at `draft` or `ready`; each has 8-17 ACs; 199 includes the secret-filter regression corpus as a gating AC (not deferred); 200 imposes no external-service dependency.
5. [ ] Parent brief (this file) names all four categories, specifies shared constraints (secret MUST-NOT, engine-core boundary, read-only v1, Insight-180 guards, git auto-commit shape, mobile read-only), and sets non-goals explicitly.
6. [ ] Every shared constraint in §Constraints carries a cross-reference to the Insight or ADR that motivates it.
7. [ ] Future Category 1–3 sub-briefs are named as pending in the sub-brief index, with the artefact-canonicalisation prerequisite explicitly flagged; numbers are **not** pre-reserved (Insight-200 hygiene).
8. [ ] The Curate-as-seventh-job question is named as a phase-level open question to resolve after 2+ sub-briefs have applied the pattern (Insight-201 absorption criterion).
9. [ ] Parent brief is reviewed by a fresh-context Dev Reviewer (not the Architect), and review verdict + fixes are presented alongside the brief for human approval.

## Review Process

1. Spawn fresh-context Dev Reviewer on this parent brief + sub-brief 198 **together** (the pair is the coherent deliverable)
2. Reviewer loads: `docs/architecture.md`, `docs/review-checklist.md`, Insight-201, research + UX reports
3. Reviewer checks: (a) four-category framing is coherent, (b) non-goals are binding, (c) shared constraints are tight and cross-referenced, (d) sub-brief 198 implements the pattern without violating shared constraints, (e) engine-core boundary respected, (f) secret filter regression corpus is an acceptance criterion in 198 not deferred, (g) no pre-reservation of future sub-brief numbers, (h) Insight-201 cited correctly and consistently.
4. Reviewer returns structured verdict (APPROVE / APPROVE_WITH_REVISIONS / REVISE / REJECT).
5. Architect applies CRITICAL + IMPORTANT fixes before presenting to human.
6. Human approves parent + sub-brief together, or revises scope.

## Smoke Test (phase-level)

The parent brief is a design artefact; the smoke test is document-level, not code-level.

- [ ] `grep -l "Insight-201" docs/briefs/197-*.md docs/briefs/198-*.md` — both briefs cite the insight
- [ ] `grep "MUST NOT" docs/briefs/197-*.md` — secret exclusion clause present and in the §Constraints section
- [ ] `grep "engine-core\|@ditto/core" docs/briefs/197-*.md` — engine-core boundary clause present
- [ ] `grep "Insight-200" docs/briefs/197-*.md` — named-trigger parking pattern cited for v2 bidirectional sync
- [ ] `grep "Insight-180" docs/briefs/198-*.md` — stepRunId guard clause present in sub-brief if it adds side-effecting functions
- [ ] No file in `packages/core/` is modified by sub-brief 198's Work Products table — projection code is product-layer

## After Completion

1. Update `docs/state.md` with the design artefacts produced and where they live (parent brief, sub-brief, insight, research, UX)
2. Flag the **Curate-as-seventh-job** phase-level OQ in `state.md` for PM triage
3. Flag **Category 1–3 artefact-canonicalisation research** as future work in `docs/roadmap.md` (new rows under Phase 9+)
4. **Do not** absorb Insight-201 into `docs/architecture.md` yet — absorption criterion requires 2+ sub-briefs applied end-to-end; wait until at least one Category 4 sub-brief ships and one other sub-brief (either another Category 4 seam or a Category 1 seam) ships behind it
5. Documenter adds the seven landscape entries from the research file to `docs/landscape.md` under a new "User-Facing Legibility Patterns" section
6. Phase retrospective is deferred to after the pilot sub-brief (198) ships; this parent is design-only
