# Brief 199: Memories Legibility — Projection + Safety Filter

**Date:** 2026-04-20
**Status:** ready
**Compensating-control waiver (2026-04-20):** AC #18 (fresh-context Designer re-review of `docs/research/memories-legibility-ux.md`) is **explicitly waived by user authorization**. Architect acted as Designer in-session; user reviewed the resulting UX pass directly and authorized the promotion to `ready` without a separate fresh-context Designer re-review. AC #18 remains in the brief as a first-class gating principle for future briefs; this promotion is a scoped exception, not a precedent. Builder should treat the UX spec as the binding UX contract; any deviations surface as architect callouts, not builder judgment.
**Depends on:** Brief 198 (memory write chokepoint refactor — **hard prerequisite**); Brief 197 (phase design — shared constraints); Insight-201 (principle); `docs/research/memories-legibility-ux.md` (Designer UX pass)
**Unlocks:** the legibility pattern is validated on the memories seam; Category-4 siblings (`improvements`, `work_items`, `process_versions`, `feedback`, `activities`) can reuse the pattern; Insight-201 absorption count increments by one

## Goal

- **Roadmap phase:** Phase 9+ (legibility — pilot seam)
- **Capabilities delivered:**
  - Every memory write produces a file in the workspace container volume (`/workspace/memories/…`), grouped by scope and type, with per-entry YAML frontmatter and `agent-authored` provenance
  - A credential + PII safety filter **categorically excludes** secrets, PII-on-person-scope, and ambiguous entries from the projection (fails closed at 0.95 classifier confidence)
  - Every memory write triggers a local git commit with message shape `[memory:scope/type] <verb> <name>` by author `Ditto Agent <agent@ditto.local>`
  - Self gains a `what_do_you_remember` chat affordance that renders matched memories with `KnowledgeCitationBlock` entries pointing at the file path inside the clone (user navigates in their clone after running `git clone` per Brief 200)

## Context

Brief 198 establishes the single chokepoint (`writeMemory()` helper) where projection can hook. Brief 200 establishes the git-over-HTTPS server that lets the user clone the workspace. This brief fills in the middle: the projection writer, the safety filter (with a concrete classifier specification and a regression corpus), the git-writer, the workspace bootstrap for the `memories/` subtree, and the chat affordance.

Designer UX (`memories-legibility-ux.md`) specifies the folder structure, per-file shape, sealed-memory pattern, and agent-authorship signalling. That Designer pass was done by the Architect acting as Designer in-session; **a fresh-context Designer re-review is a gating AC before this brief moves to Status: ready**.

Reviewer of the prior (pre-split) brief flagged three CRITICAL issues. All three are addressed here: (1) chokepoint is now owned by Brief 198 prerequisite; (2) deployment-target reframing — projection writes to the container volume, served via Brief 200's git server, no `DITTO_WORKSPACE_ROOT` env var invention, no external git-hosting dependency; (3) classifier mechanism specified below (regex-first hard patterns + LLM-backed ambiguous PII classifier).

## Objective

Ship a fail-closed filesystem projection of the `memories` table into the workspace container volume, with deterministic folder and file shape, per-entry YAML frontmatter including `agent-authored` provenance, atomic git auto-commit on every change, a concrete credential+PII classifier with regression corpus, and a chat affordance for memory lookup.

## Non-Goals

- **No bidirectional sync.** File edits in the container (or in a user's clone) are not reflected back into the DB in v1. Users change memories via conversation with Self. Parent brief §Constraints sets the trigger for v2.
- **No git-server serving.** Users access the clone via Brief 200. Brief 199's git-writer commits locally in the container; the server is a different concern.
- **No new memory types or scope types.** Schema unchanged.
- **No `activities` / `improvements` / `work_items` / `feedback` / `process_versions` projection.** Each is its own Category-4 sub-brief; memories is the pilot.
- **No new ContentBlock type** unless reuse of `KnowledgeCitationBlock` + `DataBlock "vivid"` with a `kind: "memory"` discriminator is demonstrably insufficient. Reuse-first discipline.
- **No Curate sidebar destination / seventh-job instantiation.** Parent brief §AC 8 defers this decision until two sub-briefs have applied the pattern; 199 adds only the chat affordance and the file surface.
- **No FUSE / WebDAV / OS-level mounts.** Plain file writes only. Future access modes are optional additions in other briefs.
- **No mobile editing.** Desktop-only by construction (parent brief §Constraints).

## Inputs

1. `docs/briefs/197-user-facing-legibility-phase.md` — parent brief (shared constraints binding)
2. `docs/briefs/198-memory-write-chokepoint-refactor.md` — prerequisite; defines the hook surface
3. `docs/briefs/200-workspace-git-server.md` — sibling; provides the serving mechanism
4. `docs/insights/201-user-facing-legibility.md` — principle + four-category breakdown
5. `docs/research/memories-legibility-ux.md` — Designer UX: folder structure, per-file shape, sealed-memory pattern, classifier rules (by type)
6. `docs/research/user-facing-legibility-patterns.md` — option space; three gaps (write-path trust, bidirectional, secret exclusion)
7. `docs/personas.md` — Rob / Lisa / Jordan / Nadia; Problem 1 (can't delegate) + Problem 5 (can't see reasoning)
8. `docs/human-layer.md` — `KnowledgeCitationBlock`, `DataBlock "vivid"`, `AlertBlock`
9. `packages/core/src/db/schema.ts` lines 126-142 (memory enum values), 432-457 (memories table shape) — read contract
10. `docs/adrs/019-trust-tiers.md` — projection runs post-gate
11. Insight-180 (stepRunId guard), Insight-190 (migration journal), Insight-200 (named-trigger parking)
12. Existing self-tool examples: `src/engine/self-tools/*.ts` — follow the pattern

## Constraints

All parent brief §Constraints inherit. Additionally:

- **Classifier mechanism is specified, not invented.** The safety filter is a **two-stage classifier**:
  - **Stage 1 — Regex-first for hard credential/token patterns** (100% quarantine). Named patterns (all matched case-insensitively with appropriate bounds): AWS access keys (`AKIA[0-9A-Z]{16}`), AWS secret (40 base64 chars following `aws_secret_access_key`), GitHub PATs (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` prefixes + 36 alphanumeric), OpenAI (`sk-[A-Za-z0-9]{32,}`), Anthropic (`sk-ant-[A-Za-z0-9\-_]{80,}`), generic JWT (`eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+`), OAuth bearer tokens when preceded by `Authorization: Bearer`, GCP service-account JSON fragments (detection by presence of `"private_key"` + `"type": "service_account"`), Stripe keys (`sk_(live|test)_[0-9a-zA-Z]{24,}`), Twilio SIDs (`AC[0-9a-fA-F]{32}`), Slack tokens (`xox[baprs]-`). Any regex hit → **quarantine** with `[QUARANTINED — credential-shape detected: <pattern-name>]`.
  - **Stage 2 — LLM-backed classifier for ambiguous PII** (fail-closed at 0.95 confidence). For memory content that passes Stage 1, an LLM call classifies: `safe` / `pii-person` / `pii-ambiguous` / `credential-ambiguous`. Prompt is small, temperature 0, output-structured. Cost per memory: <1¢. Calibration: on the regression corpus, Stage 2 must achieve ≥0.95 correct classification on the PII-shape subset and ≥0.99 on the credential-shape-ambiguous subset; below those thresholds, the brief fails AC #9.
  - **Cache:** Stage 2 results are content-hash keyed and cached in-memory per process lifetime (memory content changes are rare; cache hits make projection cheap).
  - **Provider choice:** Stage 2 uses the default LLM provider per `ADR-026` routing (Model Gateway); Haiku-class preferred for cost; verify via spike test per Insight-180.
- **Secrets and PII MUST NOT project.** From parent brief; materialised here as the Stage 1 + Stage 2 filter.
- **Fail closed.** Any Stage-2 confidence below 0.95 → `quarantine`. Not `redact`. Not `seal`. Not `project with warning`.
- **Git library choice is fixed: `isomorphic-git`.** Chosen ahead of implementation: pure JS (no native deps), works in Railway container without extra system packages, same library Brief 200 will use for its HTTPS server, minimises dependency count. Documented in §Provenance.
- **Projection target is container-internal.** See the "Workspace projection path" constraint above — projection writes under `DATA_DIR/workspace/memories/` on the existing fly.io volume. This is not a new volume; it is a new subdirectory of the existing mounted data volume.
- **Engine-core boundary strict.** Zero `packages/core/` changes. Zero new `src/` → `packages/core/` imports beyond existing schema reads. Verified by `git diff` grep + import-path audit as AC.
- **Projection is write-through-idempotent.** Keyed on content-hash of projected frontmatter + body; no-op writes skip git commit but MUST refresh the file if it's structurally stale or missing.
- **Trust-tier integrity.** Projection runs INSIDE `writeMemory()` (Brief 198's chokepoint), AFTER the DB insert/update returns and AFTER the trust gate has cleared (order: trust check → DB write → projection call → git commit). Projection cannot bypass the gate by definition.
- **`agent-authored` field in every entry.** Per Designer UX spec; `agent-authored: yes` when the caller is a system agent / feedback handler / knowledge extractor (default for v1 — all writes are agent-authored); `no` only for explicit human edits (not reachable in v1 since user edits flow through conversation, not direct writes). Future v2 bidirectional sync flips this. **V1 dormancy note:** the field is a constant `yes` in v1 — only v2 tests will exercise the `no` branch. Shipping the field in v1 is acceptable as forward-compat signalling (cheaper to reserve the field now than to retrofit later); the brief's test suite does not attempt to exercise the `no` branch in v1 ACs.
- **Insight-180 exemption documented inline.** Projection writes are workspace-local (container volume); no external side effects. The projector file starts with: `// stepRunId not required: all writes are workspace-container-local`. Future extensions writing outside the container volume carry the guard.
- **Desktop-only access affordance.** `KnowledgeCitationBlock` reuses the existing `sources[]` shape — `sources[].type = "memory"`, `sources[].name = <relative path within clone>` (e.g., `memories/processes/quote-generation/corrections.md#bathroom-labour-estimate`), `sources[].excerpt = <optional body preview>`. **Zero `packages/core/` modification.** The `type` field is already typed as `string` (`packages/core/src/content-blocks.ts:89`); `"memory"` is a legal value today. The brief **commits** to this reuse path — an engine-core edit is NOT an acceptable escape hatch. Render does NOT spawn `open` / `xdg-open` from the browser; the user navigates in their own editor after cloning per Brief 200.
- **Workspace projection path.** Projection root = `path.join(DATA_DIR, "workspace", "memories")` where `DATA_DIR` is the existing export from `src/paths.ts:44`. **Honest-labelling caveat:** no per-workspace volume abstraction exists today — the projection writes under the fly.io-mounted `ditto_data` volume (`/app/data` in production, per `fly.toml:31-33`). `getWorkspaceProjectionRoot()` is a small new helper in `src/engine/legibility/` that computes `path.join(DATA_DIR, "workspace", "memories")` and nothing more. The brief does NOT invent a `DITTO_WORKSPACE_ROOT` env var; the existing `DATABASE_PATH` env var pattern is adjacent (already configurable for deployment) and can extend later if per-workspace overrides are needed. Flagged as a Minor Open Question for the Architect: should `WORKSPACE_ROOT` env var be added now as a deployment-configurability hook, or left hard-coded until a concrete deployment scenario demands it? Current answer: defer until demanded (Insight-050 — validate before infrastructure).

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Folder structure by scope/type | Original (Designer UX spec `docs/research/memories-legibility-ux.md`) | original | Ditto-specific; driven by schema scope+type enums |
| YAML frontmatter per-entry | Obsidian public architecture | pattern | Mature markdown+frontmatter convention |
| `agent-authored` provenance field | Original (closes Research Gap 3 — no prior art in surveyed tools) | original | Net-new design requirement for agent-authored storage |
| Git auto-commit on every change | hilash/cabinet (2026-04-20 triage); Brief 197 §Provenance | pattern | Direct fit |
| Sealed-memory `[SEALED]` marker | Original (closes Research Gap 3 on secret exclusion — no prior art) | original | Net-new; the filter is load-bearing |
| Credential-shape regex patterns | Public secret-detection patterns (gitleaks, truffleHog) + Anthropic/OpenAI/Stripe docs | pattern | Standard; Ditto uses the settled patterns, not custom-authored |
| `isomorphic-git` library | github.com/isomorphic-git/isomorphic-git (v1+; permissive license; ~10k stars; TypeScript) | depend | Pure JS, no native deps; same library Brief 200 uses |
| `KnowledgeCitationBlock` extension | Ditto `packages/web/components/blocks/knowledge-citation-block.tsx` | pattern (self-reuse) | Existing primitive; adding `kind: "memory"` discriminator |
| Two-stage regex+LLM classifier | Pattern adapted from enterprise DLP (Data Loss Prevention) systems | pattern | Settled industry pattern for secret detection; Ditto's composition is Ditto-specific |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/legibility/memories-projector.ts` | Create: exports `projectMemoryWrite(db, memoryId, operation)`, `regenerateScopeFile(db, scopeType, scopeId, memoryType)`, `getWorkspaceProjectionRoot()`. Hooked from `writeMemory()` (Brief 198's helper) when `options.skipProjection !== true`. |
| `src/engine/legibility/memory-safety-filter.ts` | Create: exports `classifyMemory(content, metadata, scopeType, type)` → `{ verdict: "project" \| "redact" \| "seal" \| "quarantine", redactions?, reason? }`. Two-stage: Stage 1 regex; Stage 2 LLM (via existing provider router). |
| `src/engine/legibility/memory-safety-filter-stage1-patterns.ts` | Create: exports the named credential/token regex patterns (AWS, GitHub, OpenAI, Anthropic, JWT, OAuth bearer, GCP service-account, Stripe, Twilio, Slack). Module named patterns so they're testable in isolation. |
| `src/engine/legibility/git-writer.ts` | Create: thin wrapper over `isomorphic-git` exposing `commitMemoryChange(repoPath, message, files[])`; sets author `Ditto Agent <agent@ditto.local>`. |
| `src/engine/legibility/memories-projector.test.ts` | Create: unit tests for projection logic (folder structure, file shape, idempotency on no-op, regeneration on delete, agent-authored field). |
| `src/engine/legibility/memory-safety-filter.test.ts` | Create: runs the regression corpus; asserts Stage-1 100% on all credential-shape entries and Stage-2 ≥0.95 on PII-shape entries; fails loud on any threshold miss. |
| `tests/fixtures/memory-safety-corpus.ts` | Create: **≥54 adversarial entries total** — ≥30 named credential patterns (AWS/GitHub/OpenAI/Anthropic/Stripe/Twilio/Slack/JWT/GCP + OAuth bearer tokens), ≥12 PII entries (email addresses, phone numbers, physical addresses, name+birthdate pairs, credit-card-shapes, SSN-shapes), ≥12 ambiguous borderline entries (e.g., "my password is correcthorsebatterystaple" — no structural giveaway). Each entry tagged with `expectedVerdict` and `description`. |
| `src/engine/legibility/write-memory.ts` | **Modify (extends Brief 198's helper):** wire the projection call. After the DB write returns and before the function returns, call `projectMemoryWrite(db, insertedId, operation)` unless `options.skipProjection === true`. |
| `src/engine/self-tools/memory-query.ts` | Create: `what_do_you_remember(scope?, type?, query?)` self-tool; returns `ContentBlock[]` with `KnowledgeCitationBlock` entries (`kind: "memory"`, `path: "memories/…"` relative to clone root) and optional `DataBlock "vivid"` with `kind: "memory"` for inline body preview. |
| `packages/web/components/blocks/knowledge-citation-block.tsx` | **Modify:** render when `sources[].type === "memory"` — show `sources[].name` as path chip + copy-path button + explanatory note ("open in your clone of the workspace"). `sources[].excerpt` renders as inline body preview. **Does NOT spawn OS commands.** Mobile renders inline content preview (read-only). **No new fields added to `sources[]`; no new `kind` discriminator field; zero `packages/core/` edit.** |
| `docs/dictionary.md` | Modify: add "Memory Legibility File" and "Sealed Memory" entries |

**No new `DITTO_WORKSPACE_ROOT` env var.** Projection root is resolved via `getWorkspaceProjectionRoot()`; that helper returns the existing workspace volume path (verify against current Ditto workspace configuration before hard-coding).

**No `drizzle/meta/_journal.json` changes.** No schema changes.

## User Experience

- **Jobs affected:** Curate (proposed seventh; realized here via the `what_do_you_remember` chat affordance and the file surface). Orient (the briefing's "Learned this week" summary reads from the same projection and can cite file paths).
- **Primitives involved:** `KnowledgeCitationBlock` (extended), `DataBlock "vivid"` (reused for inline previews), `AlertBlock` (quarantine notifications surface in the next briefing), `SuggestionBlock` ("You have 3 low-confidence memories to review" — follow-on; may ship in this brief if the cost is low). No new ContentBlock type unless reuse is demonstrably insufficient.
- **Process-owner perspective:**
  - Rob asks *"what do you remember about bathroom jobs?"* in chat → Self calls `what_do_you_remember(query: "bathroom")` → response contains `KnowledgeCitationBlock` entries with file paths like `memories/processes/quote-generation/corrections.md#bathroom-labour-estimate`. Rob doesn't need to open anything; he skims the inline preview. Satisfies his "trust calibration" job.
  - Jordan runs `git clone https://ditto.you/<workspace-slug>/ws.git` once (via Brief 200), opens in VSCode, and `git pull`s before leadership meetings. `git log memories/` becomes his demo artefact. Satisfies his "leverage + proof" job.
  - Lisa clones, greps `memories/self/voice-model.md`, and returns to Ditto's chat to say *"stop applying informal tone to premium-tier"*; DB updates, file regenerates, git commits. In v1 she can read and respond via conversation; she cannot edit the file directly. Partial persona fit; full fit in v2.
  - Nadia clones, runs `diff memories/processes/chen-analysis/corrections.md memories/processes/park-analysis/corrections.md`. Cross-team pattern-spotting is native git/diff workflow.
- **Interaction states:** file exists, projected normally; `scope=person` → `[SEALED]` marker; Stage-1 or Stage-2 quarantine → `[QUARANTINED — flagged for review]`; workspace directory missing → projector creates on first write; classifier failure (LLM unavailable) → **fail closed, quarantine with reason "classifier unavailable,"** retry next write.
- **Designer input:** `docs/research/memories-legibility-ux.md` (Architect-as-Designer; **fresh-context Designer re-review is a gating AC** — see AC #18).

## Acceptance Criteria

1. [ ] `src/engine/legibility/memories-projector.ts` exists and exports `projectMemoryWrite`, `regenerateScopeFile`, `getWorkspaceProjectionRoot`; wired from Brief 198's `writeMemory` helper via `options.skipProjection !== true`.
2. [ ] Projection triggers on every memory insert/update/delete/deactivate that passes through `writeMemory`; verified by integration test.
3. [ ] Folder structure on disk matches UX spec: `memories/self/`, `memories/processes/<slug>/`, `memories/people/`, `memories/agents/`. Slug derivation from `scopeId` is deterministic and documented inline.
4. [ ] One markdown file per `(scopeType, scopeId, type)` triple. File frontmatter: `scope`, `type`, `count`, `last-updated`. **Per-entry frontmatter:** `id`, `created`, `last-reinforced`, `reinforcement-count`, `confidence`, `source`, `agent-authored`.
5. [ ] Every projected file begins with a `<!-- DO NOT EDIT — regenerated on every memory change. Changes via conversation with Ditto. -->` banner.
6. [ ] `src/engine/legibility/memory-safety-filter.ts` exists; exports `classifyMemory` returning one of `project` / `redact` / `seal` / `quarantine` with a reason.
7. [ ] **Stage 1 (regex):** all named patterns in `memory-safety-filter-stage1-patterns.ts` exist (AWS access/secret, GitHub PATs, OpenAI `sk-`, Anthropic `sk-ant-`, generic JWT, OAuth bearer, GCP service-account JSON, Stripe, Twilio, Slack); exported as named constants and independently unit-testable. A Stage-1 regex hit → `quarantine` with reason naming the pattern.
8. [ ] **Stage 2 (LLM classifier):** exists; called when Stage 1 produces no hit; prompt at temperature 0, structured output (`safe | pii-person | pii-ambiguous | credential-ambiguous`); confidence <0.95 → `quarantine`; provider selected via existing Ditto provider router (`ADR-026`); Haiku-class default. Classifier results cached by content-hash per process lifetime.
9. [ ] Classifier failure mode (LLM unavailable): **fail closed** — memory is quarantined with reason `"classifier unavailable"`; next projection attempt re-classifies. Verified by test that stubs LLM failure.
10. [ ] `tests/fixtures/memory-safety-corpus.ts` contains ≥50 entries; the named-pattern subset (≥30 entries across all Stage-1 patterns) achieves 100% `quarantine` in Stage 1; the PII-shape subset (≥12 entries) achieves ≥0.95 correct classification in Stage 2; the ambiguous subset (≥12 entries) achieves 100% `quarantine` (all ambiguous must fail closed). Test FAILS the brief if any threshold is missed.
11. [ ] Git auto-commit via `isomorphic-git` on every memory write that produces a file change; commit message matches `[memory:<scope>/<type>] <verb> <entity-name>` (verbs: `created` / `reinforced` / `deactivated` / `quarantined`). Author = `Ditto Agent <agent@ditto.local>`.
12. [ ] Idempotency: a memory write that produces no frontmatter or body change produces no git commit (content-hash comparison skips the commit) but DOES refresh the file if it was structurally stale or missing.
13. [ ] `src/engine/self-tools/memory-query.ts` exists, registered with the self-tool registry; `what_do_you_remember(scope?, type?, query?)` returns `ContentBlock[]` containing `KnowledgeCitationBlock` entries whose `sources[].type === "memory"`, `sources[].name` is the path relative to the workspace clone root, and `sources[].excerpt` optionally carries an inline preview.
14. [ ] `packages/web/components/blocks/knowledge-citation-block.tsx` renders the `sources[].type === "memory"` case with path chip + copy-path button + the explanatory note. **Does NOT** attempt to spawn `open` / `xdg-open` / `start` from the browser.
15. [ ] **Engine-core boundary check (strict, no escape hatch):**
    - `git diff --stat main..HEAD | grep packages/core` — **must be empty**. The brief commits to the zero-core-edit reuse path via existing `sources[].type: string` field.
    - `git diff main..HEAD -- packages/core/ | grep '^+.*from ".*src/'` — must be empty (no new imports from `src/` into core).
    - If the build surfaces a concrete insufficiency that genuinely cannot be worked around via the existing `sources[]` shape, the brief FAILS and is reopened by the Architect for type-shape revision — not patched in-flight by a builder.
16. [ ] **Insight-180 exemption documented:** `memories-projector.ts` and `git-writer.ts` both begin with `// stepRunId not required: writes are workspace-container-local, no external side effects`.
17. [ ] `pnpm run type-check` passes at root with zero errors; full `pnpm test` passes with zero regressions.
18. [ ] **Fresh-context Designer re-review** of `docs/research/memories-legibility-ux.md` has been completed (by a genuinely separate agent with fresh context, not the Architect) and any surfaced UX changes are either reflected in this brief or explicitly deferred with rationale. This AC gates the transition from `Status: draft` to `Status: ready`.

## Review Process

1. Spawn fresh-context Dev Reviewer with `docs/architecture.md`, `docs/review-checklist.md`, Brief 197, Brief 198, Insight-201, research + UX reports, and this brief
2. Reviewer verifies: (a) ACs are boolean and testable; (b) classifier specification is concrete enough that the Builder cannot invent; (c) regression corpus is adversarial (not soft); (d) fail-closed is implemented, not just asserted; (e) engine-core boundary clean; (f) `isomorphic-git` is the right choice given Brief 200's library choice; (g) the Designer re-review AC is load-bearing, not ceremonial; (h) Designer UX is faithfully translated
3. **Compensating control — fresh-context Designer re-review** of `memories-legibility-ux.md` runs in parallel; verdicts are presented together
4. Present work + both reviews to human

## Smoke Test

```bash
# Prereq: Brief 198 merged (chokepoint available); Brief 200 available for user-facing clone (not required for 199 smoke)

# 1. Seed a benign memory via conversation
pnpm dev  # start Ditto
# In chat: "Remember that I prefer terse responses"

# 2. Verify file appeared in container volume
ls /workspace/memories/self/
cat /workspace/memories/self/preferences.md
# Expect: DO NOT EDIT banner, YAML frontmatter with count:1, per-entry for "terse-responses" with agent-authored:yes

# 3. Verify git commit
cd /workspace && git log --oneline memories/
# Last commit: [memory:self/preference] created terse-responses (count 1)
# Author: Ditto Agent <agent@ditto.local>

# 4. Seed a credential-shape memory (should quarantine, Stage 1)
# In chat: "Remember my AWS key is AKIAIOSFODNN7EXAMPLE"
cat /workspace/memories/self/preferences.md
# Expect: "[QUARANTINED — credential-shape detected: aws-access-key]" in place of body
# Next briefing surfaces an AlertBlock

# 5. Seed an ambiguous PII memory (Stage 2 quarantine if classifier unsure)
# In chat: "Remember that my neighbor's phone is 555-123-4567"
cat /workspace/memories/people/INDEX.md  # scope=person — always sealed
# Expect: "[SEALED — scope=person; view in Ditto UI behind auth]"

# 6. Run the regression corpus
pnpm test src/engine/legibility/memory-safety-filter.test.ts
# Expect: Stage 1 100% on credential subset; Stage 2 ≥0.95 on PII; ambiguous 100% quarantined

# 7. Run full projection tests
pnpm test src/engine/legibility/
# Expect: 0 failures

# 8. Type-check
pnpm run type-check
# Expect: 0 errors

# 9. Engine-core boundary
git diff --stat main..HEAD | grep packages/core
# Expect: empty OR only the narrow KnowledgeCitationBlock discriminator extension (Reviewer-confirmed)
```

## After Completion

1. Update `docs/state.md` with: projector + safety filter landed; Insight-201 absorption count now 1 (deferred until 2+)
2. Update `docs/roadmap.md`: memories pilot seam marked complete; remaining Category-4 seams queued
3. No ADR: classifier is an implementation choice, not an architectural commitment; if a new classifier approach arrives (e.g., replacing LLM stage with a local detector), that's a replacement brief, not an ADR.
4. Phase retrospective (jointly with 198 + 200 landing): document whether the reuse-before-create discipline held for ContentBlocks; whether the Architect-as-Designer role merge caused UX drift (and whether the fresh-context Designer re-review caught it); whether the two-stage classifier fail-closed threshold of 0.95 was calibrated correctly or needs adjustment in follow-ons
5. Dictionary entries for "Memory Legibility File" and "Sealed Memory" committed
6. If `packages/core/src/content-blocks.ts` was modified for the `kind: "memory"` discriminator, document it in the retrospective as the single instance of reuse-before-create discipline not fully holding — signal for the parent brief's Curate-as-seventh-job question
