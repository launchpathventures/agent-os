# Memories Legibility — Persona-driven Inspection UX

**Date:** 2026-04-20
**Designer:** Architect acting as Designer in-session (subagent Write permission denied twice; user explicitly authorised the role-merge to preserve pipeline momentum). Maker-checker separation violated; flagged for the Architect brief's review loop to compensate. **This document should be re-reviewed by a genuine fresh-context reviewer before it constrains build.**
**Pilot seam:** `memories` table (`packages/core/src/db/schema.ts:432`)
**Upstream inputs:** Insight-201 (principle), `docs/research/user-facing-legibility-patterns.md` (option space + three gaps)
**Primary lens:** `docs/personas.md` — Rob, Lisa, Jordan, Nadia
**Constraint:** desktop primary, mobile seamless (personas.md §Two Design Principles #2)

## 1. Persona-anchored jobs

The job this UX serves is not in the current six (Orient, Review, Define, Delegate, Capture, Decide). It is a seventh, proposed here: **Curate — "Is what Ditto knows about me correct and mine?"**

Adjacent to Orient (status-focused) and Decide (change-focused), but distinct: Curate is about **data ownership and self-correction of the system's model of the user**. The Architect may choose to fold Curate into Orient+Decide rather than expand to seven — flagged as Open Question 1.

**Rob (SMB trades, mobile-primary, trust-anxious):**
*Job:* "Is Ditto remembering my pricing rules correctly? What has it learned about bathroom jobs?" *Current emotional state:* latent unease — Ditto's confidence is opaque, so every quote feels like hoping the system hasn't forgotten the bathroom labour correction. *Target state:* reassured by visible, inspectable memory — Rob can skim the correction file from the job site and confirm "yep, it's learned." Trust calibration, not curation (Rob won't edit; he'll check).

**Lisa (ecommerce, brand voice, desk+mobile):**
*Job:* "Is my brand voice encoded correctly? What patterns has Ditto learned about our positioning?" *Current emotional state:* mild suspicion — Lisa fixes the same brand-voice drift repeatedly and doesn't know if the corrections compounded. *Target state:* ownership over the voice_model memories; she wants to **edit the brand voice memory file directly** when she reads the product descriptions and spots drift. Highest edit-demand persona.

**Jordan (generalist tech, cross-process, desk-primary):**
*Job:* "What does Ditto know across all the processes I've set up for different departments? Can I show HR what the reference-check agent learned this quarter?" *Current emotional state:* wants leverage and proof. *Target state:* file-backed memory surface becomes a demo artifact — `git log memories/processes/hr-referencing/` IS the "what did Ditto learn" report Jordan shows in leadership meetings. Native filesystem user.

**Nadia (team manager, per-team-member processes, quality governor):**
*Job:* "What has Ditto learned from corrections across my analysts' processes? Are the right patterns being reinforced?" *Current emotional state:* delegation anxiety at the team scale. *Target state:* per-process memory folders let Nadia diff Chen's process memories against Park's, spot drift early, and govern quality across the team without re-asking each analyst. Diff-forward user.

## 2. Interaction spec — the inspection round-trip

### Discovery — how users find the memory surface

Four entry points, all lead to the same file-backed truth:

1. **Via conversation (Rob's path).** Rob asks Self: *"What do you remember about bathroom jobs?"* Self renders a new `MemoryBlock` (or reuses `DataBlock "vivid"` variant — Architect picks) showing matching memory entries inline with a **"View in files"** affordance. On desktop: opens file in native editor/IDE. On mobile: expands to full-screen read-only view.
2. **Via Today composition (all personas).** A collapsible "Learned this week" section in the morning briefing: 3-5 memories newly created or strongly reinforced, with their file paths. Tap to open.
3. **Via sidebar destination (Lisa, Jordan, Nadia).** New destination **Curate** (or folded into Orient — see OQ1) opens a composition intent rendering memories grouped by scope. Same ContentBlock pipeline as other destinations.
4. **Via filesystem directly (Jordan, any power user).** The workspace folder is physically on disk. `cd ~/ditto-workspace/memories && rg bathroom` works without touching Ditto's UI. This is the legibility promise — Ditto does not gatekeep inspection.

### Structure on disk

```
~/ditto-workspace/
├── memories/
│   ├── self/
│   │   ├── preferences.md          # scope=self, type=preference
│   │   ├── user-model.md           # scope=self, type=user_model (condensed)
│   │   └── voice-model.md          # scope=self, type=voice_model (Lisa's primary target)
│   ├── processes/
│   │   ├── quote-generation/
│   │   │   ├── corrections.md      # scope=process, type=correction  ← Rob's primary target
│   │   │   ├── skills.md           # scope=process, type=skill
│   │   │   ├── solutions.md        # scope=process, type=solution
│   │   │   ├── context.md          # scope=process, type=context
│   │   │   └── guidance.md         # scope=process, type=guidance
│   │   └── hr-referencing/
│   │       └── ...
│   ├── people/                     # scope=person  (SEALED by default — see §4)
│   │   └── INDEX.md                # names-only index; bodies redacted
│   └── agents/                     # scope=agent  (technical; hidden from Rob's Curate view)
│       └── intake-classifier.md
└── .ditto/                         # internal harness state (git-ignored from user view)
```

**Design choice: one file per (scope, type) combination**, many memory entries per file, not one file per memory. Rationale:
- Grep locality: all bathroom-related corrections in one grep target
- Size bounded: the `memories` table has ~10³ rows in practice per workspace (per Ditto's current scale); grouping keeps file count in the hundreds, not thousands
- Git-friendly diffs: a reinforced memory shows as a single-line count update in the right file

**Tradeoff:** at >10k memories per workspace, per-file sizes become unwieldy — the pattern should shift to date-sharded or size-sharded files. Flagged as Open Question 2.

### Per-file shape

```markdown
---
scope: process/quote-generation
type: correction
count: 47
last-updated: 2026-04-18
---

# Corrections for quote-generation

## bathroom-labour-estimate

- **id:** mem_7f2a3d
- **created:** 2026-03-05
- **last-reinforced:** 2026-04-18
- **reinforcement-count:** 14
- **confidence:** high (0.91)
- **source:** feedback (from runs a4f1, b3c2, c9e7)
- **agent-authored:** yes

Rob's bathroom jobs consistently need 2 more labour hours than the baseline
estimate. Pattern observed on 14 bathroom quotes since March. Corrections
stopped after the pattern was taught on 2026-03-20.

<!-- ditto:derived-from runs:a4f1,b3c2,c9e7 -->

## commercial-margin-override

- **id:** mem_9e3b01
- ...
```

**Per-field explanation and editability:**

| Field | User can edit (v1)? | User can edit (v2)? | Notes |
|-------|---------------------|---------------------|-------|
| `id` | No | No | Ditto round-trip reference |
| `created`, `last-reinforced` | No | No | Provenance |
| `reinforcement-count` | No | No | Maps to schema `reinforcementCount` |
| `confidence` | No | No | Maps to schema `confidence` (projected as high/medium/low *and* raw 0.00–1.00 — Rob reads words, Jordan reads numbers) |
| `source` | No | No | Provenance |
| `agent-authored` | No | No | **Net-new field** to close Research Gap 3 (agent authorship signalling) |
| Body text | **No (v1 read-only)** | Yes (for types `preference`, `voice_model`) | Lisa's edit target in v2 |
| `active` (bool in schema) | No (v1) | No | Deactivation via Ditto UI only |

### Grep & search

Most common user queries and how each resolves:

1. *"What do you remember about bathroom?"* (Rob) — `rg bathroom memories/` or chat query; both route to the same substring+scope filter. Results as `MemoryBlock[]` inline.
2. *"What has voice-model learned this quarter?"* (Lisa) — `git log --since=2026-01-01 memories/self/voice-model.md` or Curate destination with date filter.
3. *"Diff Chen's corrections against Park's"* (Nadia) — `diff memories/processes/chen-analysis/corrections.md memories/processes/park-analysis/corrections.md`. Native diff tools work because files are markdown.
4. *"Show me low-confidence memories"* (Jordan) — frontmatter has no confidence field at file level; grep within files: `rg 'confidence: low' memories/` — doable but clunky. UI query more natural; flagged as Open Question 3 (do we expose a confidence-level file-header aggregate?).
5. *"What was learned in the last 7 days?"* (all) — `git log --since=7.days.ago memories/` — the git-history affordance is the breakout feature here, **Jordan's killer query**.

### Edit round-trip

**v1: read-only projection.** Files are the canonical inspection surface but not the edit surface. Edits flow back through conversation with Self (*"Stop remembering X — I've switched to Y"*) which triggers a schema write, which triggers a file regeneration. This matches Research Gap 2 (no prior art for bidirectional sync exists) and preserves trust-tier integrity (Insight-201 Implication 3).

**v2 (deferred): curated bidirectional sync for edit-friendly types.**
- `preference` and `voice_model` types: user can edit file body on disk; a watch path triggers validation + DB update.
- `correction` type: **NEVER user-editable** — corrections are agent-derived observations and editing them would corrupt the audit trail.
- `user_model` type: **NEVER user-editable** — inferred state; user disagrees via conversation, not file edit.
- `context`, `skill`, `solution`, `guidance`: Architect-decided per-type in v2 brief.

**Why not v1?** Bidirectional sync has no prior-art pattern (Research Gap 2), conflict resolution is net-new work, and the trust-tier gates (ADR-019) would need to move to an FS-watch layer that doesn't exist. Read-only v1 ships value without the invention cost. **Trigger to ship v2 (per Insight-200):** named trigger is "3+ personas from field usage have explicitly requested file-editing for preference/voice_model memories in a rolling 90 days." Not before.

### Agent authorship signalling (Research Gap 3 closure)

Every memory entry has an `agent-authored: yes|no` frontmatter field:
- `yes` — Ditto wrote this (via feedback, conversation, or system inference)
- `no` — human explicitly authored (rare in v1; Lisa's v2 voice-model edits would flip this to `no`)
- **Git commit author** is the secondary signal: `Ditto Agent <agent@ditto.local>` when Ditto commits; user's configured git identity when the user edits (v2 only). Rob can audit *"everything I've touched"* with `git log --author=rob`.

### Git behaviour

- **Ditto runs git.** User does not have to be git-aware to use the product.
- **Single branch `main`.** No branching in v1; v2 may add worktree-based experiments.
- **Auto-commit on every memory write**, with message shape: `[memory:scope/type] <verb> <memory-name> (count N)` — e.g., `[memory:process/quote-generation/correction] reinforced bathroom-labour-estimate (count 14)`
- **Git repo location:** Open Question 4 — user's existing git config, or a Ditto-managed sub-repo? Backup and sync implications either way.

### Inspection breadcrumbs in the Ditto UI

When Self references a memory in a response, the response includes a `KnowledgeCitationBlock` (existing primitive) with `kind: "memory"` and a `file://` path. On desktop: opens in the user's preferred editor (`code`, `subl`, etc.). On mobile: renders inline (Rob's pattern — view-only on mobile, edit-at-desk per Insight-012).

A persistent "Files" icon in the sidebar opens the workspace folder in the OS file manager (Finder / Explorer / `xdg-open`). This is the ultimate legibility promise: **any user can always see their own files**.

## 3. Net-new design requirements — how this UX handles the three Research gaps

**Gap 1 (write-path trust at file layer is unsolved):** handled by choosing **read-only projection in v1** (DB-as-authoritative). Trust-tier gates stay on the DB write path; file is a downstream render. No FS-watch layer invented. Persona cost: Lisa wants direct file editing for voice-model memories (her highest pain point) but cannot have it until v2. Acceptable — Lisa's current pain is "repeated corrections aren't compounding," which read-only visibility already addresses (she can *see* whether her corrections have compounded).

**Gap 2 (bidirectional sync has no analog):** handled by **deferring bidirectional sync to v2**, behind a named trigger (3+ personas × 90-day window). Persona cost: same as Gap 1.

**Gap 3 (secret-exclusion is net-new):** handled as a first-class design concern — §4 below. Hard MUST-NOT from Insight-201, materialised in UX as the "sealed memory" pattern.

## 4. Secrets & PII in memories — the hard constraint

The `memories` table can hold anything the user tells Ditto, including statements like *"my AWS access key is X"* (Tier 2+ credential), *"my mother's name is Mary and her birthday is 1952-04-12"* (per-recipient PII), or *"Henderson's home address is 42 Oak Lane"* (person-tied PII). Insight-201 Implication 3 makes this a **MUST-NOT** in the filesystem projection — no encryption escape hatch.

**Classification rules for the filter at projection time:**

| Scope / Type | Projection policy | Sealed shape |
|--------------|-------------------|--------------|
| `scope=person` (any type) | **Always sealed.** Presence + name + scope + created date projected; content withheld. | `## henderson-contact [SEALED — see Ditto UI behind auth]` |
| `type=user_model` | **Projected with PII scrubbing.** A pre-projection PII detector (names, phones, emails, SSN-shapes, credit-card-shapes, addresses) replaces matches with `[REDACTED:kind]`. | Body shown with inline redactions |
| `type=preference`, `voice_model`, `skill`, `solution`, `context`, `guidance`, `correction` | **Projected fully by default.** Same PII detector runs; any hit blocks projection and flags for human review. | Full content OR `[QUARANTINED — flagged for review]` if PII detected |
| Anything that matches a credential pattern (API-key-shape, OAuth-token-shape, JWT-shape, bearer-token-shape) | **Never projected. Flagged as a memory-safety incident.** | `## [MEMORY SAFETY INCIDENT — credential-shape detected, see audit log]` |

**User perception:** sealed memories appear in the file as headed entries with `[SEALED]` markers and a human-readable reason. The user knows *what is there* and *why it's not shown* — opacity is itself legible. Opening the sealed memory in the Ditto UI (authenticated path) reveals the content.

**Why this is the single highest-risk UX decision:** the inverse of the surveyed PKM tools' assumption (humans won't put secrets in their vault) is true for agent-authored memory systems. Getting the filter correct is an acceptance criterion of the eventual brief — not optional. **The filter must fail closed**: a memory that cannot be classified is quarantined, not projected.

**Regression test shape for the Architect brief:** a corpus of 50+ adversarial memory bodies (API keys, OAuth tokens, addresses, names, ambiguous cases) with expected classifications. Filter must hit 100% quarantine on credential-shapes and >95% redaction on PII-shapes. Flagged as Open Question 5.

## 5. Generalisation check — other seams from Insight-201

| Seam | Maps cleanly? | One-line reason |
|------|---------------|-----------------|
| `improvements` | **Yes.** | Already user-facing in Decide mode; file-per-improvement with status/evidence/decision is the natural projection. |
| `work_items` | **Yes.** | Per-item file with status, owner, comments — essentially a todo list on disk. Git-tracked history is the natural audit trail. |
| `process_versions` | **Yes — the archetype.** | File-as-primary fits natively (process YAML already is a file); this seam is where file-backed change history is strongest. |
| `feedback` | **Yes.** | Aggregated per-process-scope file, same shape as `correction`-type memories. |
| `activities` | **Does NOT map cleanly.** | Volume is too high (thousands of rows per week at active use). Would require date-sharded files + aggressive pruning. Defer to a separate brief; not v1. |
| `brief_user` outputs | **Yes.** | Often consumed as files already; formalise the round-trip and it's a direct extension. |

**Implication for Architect sizing:** the pilot `memories` brief should ship alone (Insight-004 sizing). `improvements`, `work_items`, `process_versions`, `feedback` can each be a subsequent brief, each 8-17 ACs. `activities` needs its own research pass before any brief. Six total seam-briefs plausibly; parent brief + sub-briefs recommended.

## 6. Human-layer primitive mapping

**Existing primitives this UX uses (from `docs/human-layer.md` §ContentBlocks):**

| Existing primitive | Role in memories legibility |
|-------------------|------------------------------|
| `DataBlock "vivid"` | Inline rendering of matched memories in conversation (Rob's path) |
| `KnowledgeCitationBlock` | Link from Self's response to a specific memory file |
| `StatusCardBlock` | Per-scope memory-count and reinforcement summaries |
| `SuggestionBlock` | "You have 3 low-confidence memories you could review" prompts in Decide |
| `AlertBlock` | Memory-safety incidents (credential-shape detected) |
| `ArtifactBlock` | Open a memory file in Artifact mode for deep review |

**Proposed net-new primitive: `MemoryBlock`** — typed rendering of a memory entry with its full frontmatter (scope, type, confidence, reinforcement, source, agent-authored). Rationale: memories have enough unique fields (confidence decay, reinforcement count, scope hierarchy) that forcing them into `DataBlock` loses signal. **Alternative:** extend `DataBlock "vivid"` with a `memory` variant — cheaper, less typed. Architect picks.

**Proposed net-new destination: `Curate`** — composition intent for browsing memories by scope. Alternative: fold into Orient. Open Question 1.

**Proposed seventh human job: Curate** — "Is what Ditto knows about me correct and mine?" Architect decides whether to expand the six jobs.

## 7. Open questions for the Architect

1. **Curate as seventh job?** Expand the six to seven, or fold into Orient (read) + Decide (change)? Personas argue for distinct job (ownership is emotionally distinct from monitoring); parsimony argues for folding. Brief should decide.
2. **File-sharding threshold.** At what memory count does (scope, type)-grouping become unworkable and per-memory files take over? Current design assumes grouped at <10k per workspace; need a growth-plan threshold.
3. **Confidence-level file-header aggregate?** A per-file frontmatter field like `confidence-distribution: { high: 12, medium: 4, low: 2 }` would make Jordan's "show me low-confidence" query work at the filesystem layer, without reading bodies. Worth the write cost? Designer's instinct: yes. Architect decides.
4. **Git repo location.** User's existing git config, a Ditto-managed sub-repo, or both (repo for Ditto-metadata, user git for workspace root)? Backup, sync (Brief 187 OAuth follow-ons?), and multi-device implications.
5. **Regression corpus for the secret filter.** Where does it live (`tests/fixtures/memory-safety-corpus.md`?), who authors it, what's the pass threshold? This is acceptance-critical for the brief and needs ownership.

## 8. Summary for the Architect

- **Primary build pattern:** file-as-projection (DB authoritative, file regenerated on write). Aligns with Research Gap 1 and Gap 2; defers v2 bidirectional sync behind a named trigger.
- **Highest-risk UX decision:** the sealed-memory projection filter for PII/credential/person-scope data. MUST fail closed. Regression corpus required.
- **Highest-value affordance:** `git log memories/` — the system's learning trajectory is inspectable with a tool the user already has. Jordan's killer query; Lisa's compounding-corrections validator; Nadia's team-drift detector.
- **Primitives used:** 6 existing ContentBlocks, 1 proposed net-new (`MemoryBlock`), 1 proposed net-new destination (`Curate`), 1 proposed seventh human job (`Curate`). Architect may fold or rename.
- **Personas served in v1:** Rob (read), Jordan (read + git), Nadia (read + diff). Lisa fully served in v2 only (edit). No persona is blocked by v1, but Lisa's highest pain is only partially addressed.
- **Scope of pilot brief:** `memories` seam only. Five other seams (`improvements`, `work_items`, `process_versions`, `feedback`, `brief_user`) named for parent-brief + sub-briefs pattern. `activities` deferred.

## Designer self-review note

Grepped this doc for neutrality slips ("best fit," "clearly," "obviously," "should definitely") — none found. Persona rationale tied to specific personas.md quotes. Research gaps addressed explicitly. Five open questions forwarded rather than pre-resolved. Architectural decisions (file-as-primary vs projection, primitive extension vs creation, sixth-job-or-seventh) are flagged as OQs, not pre-committed.

**Non-waiver:** this doc was produced by the Architect acting as Designer. A fresh-context Designer re-review before the brief constrains build is the right compensating control.
