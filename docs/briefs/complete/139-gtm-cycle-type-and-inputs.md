# Brief: GTM Cycle Type + Structured Inputs

**Date:** 2026-04-13
**Status:** draft
**Depends on:** Brief 138 (parent design — Social Growth Plans), GTM Pipeline v2 (complete), Cycle self-tools (complete), Deliberative Perspectives handler (complete), Unipile social channel adapter (Brief 133 — complete)
**Unlocks:** Brief 140 (Growth Composition Intent), Brief 141 (Structured GATE + Posting Queue)

## Goal

- **Roadmap phase:** Phase 14: Network Agent (GTM track)
- **Capabilities:** `gtm-pipeline` as a first-class cycle type, structured gtmContext input, perspectives on research steps

## Context

The cycle-tools system (`src/engine/self-tools/cycle-tools.ts`) supports three cycle types: `sales-marketing`, `network-connecting`, `relationship-nurture`. Each maps to a process slug in `processes/cycles/`. The GTM pipeline template exists but isn't wired as a cycle type — it can't be activated via `activate_cycle` or managed with `pause_cycle`/`resume_cycle`.

The deliberative perspectives handler (`src/engine/harness-handlers/deliberative-perspectives.ts`) is fully built. It reads `harness.perspectives` config from step definitions in YAML. No existing process YAML uses perspectives yet — this will be the first.

The Unipile social channel adapter (Brief 133) is built: `UnipileAdapter` in `src/engine/channel.ts` handles LinkedIn DMs, WhatsApp, Instagram, and Telegram messaging via `sendAndRecord()`. The GTM pipeline's `land-outreach` step currently only lists `crm.send_email` as a tool — it does not reference social sending. This brief wires the outreach delivery path to use Unipile for LinkedIn DMs when the experiment targets a LinkedIn contact.

**Two distinct delivery paths in the GTM cycle:**
- **Content publishing** (credibility posts, pain-naming posts) → LinkedIn **feed posts** via Unipile Posts API (`client.users.createPost()`), X **tweets/threads** via X API v2 (`POST /2/tweets`). Both automated after GATE approval (Brief 141).
- **Direct outreach** (personalized DMs to specific people) → LinkedIn **DMs** via Unipile Messaging API (Brief 133, already built), X **DMs** via X API v2, emails via `crm.send_email`.

## Objective

A user can say "help me grow my developer audience on X" and Self calls `activate_cycle({ cycleType: "gtm-pipeline", ... })`. The cycle starts, perspectives fire on research steps, and cross-cycle learning works through auto-restart.

## Non-Goals

- UI for viewing plans (Brief 140)
- Structured GATE presentation (Brief 141)
- Posting queue (Brief 141)
- Buffer integration (future)

## Inputs

1. `src/engine/self-tools/cycle-tools.ts` — Cycle type system to extend
2. `processes/templates/gtm-pipeline.yaml` — Template to add perspectives config and Unipile outreach
3. `processes/cycles/gtm-pipeline.yaml` — Ditto's own cycle (same enhancements)
4. `src/engine/harness-handlers/deliberative-perspectives.ts` — Existing handler (read for config shape)
5. `packages/core/src/db/schema.ts` — `cycleType` column definition
6. `src/engine/heartbeat.ts` — Auto-restart flow (read for `learnOutputs` forwarding)
7. `src/engine/channel.ts` — UnipileAdapter, `sendAndRecord()`, SocialPlatform type (read for tool wiring)
8. `src/engine/channel-social.test.ts` — Existing Unipile tests (read for integration patterns)

## Constraints

- `cycleType` is a text column with application-level validation — no migration needed
- Perspectives config must match the shape `parsePerspectivesConfig()` already expects: `harness.perspectives.{ enabled, trigger, peer_review, max_lenses, model_tier, composer_hints }`
- `activate_cycle` must enforce the existing overlap prevention (no concurrent runs of same cycle type)
- Multiple GTM plans = multiple `activate_cycle` calls — this requires relaxing the "one active cycle per type" constraint specifically for `gtm-pipeline`. Each plan has a distinct `planName` in `gtmContext` that differentiates them.
- The `continuous: true` default and auto-restart with `learnOutputs` forwarding must work for GTM cycles exactly as it does for the existing three types

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Cycle type registry | `src/engine/self-tools/cycle-tools.ts` existing pattern | adopt | Extend proven pattern |
| Perspectives YAML config | `src/engine/harness-handlers/deliberative-perspectives.ts` | adopt | Config parser already built |
| Auto-restart with learn forwarding | `src/engine/heartbeat.ts` | adopt | Existing continuous cycle pattern |
| Social DM outreach | `src/engine/channel.ts` UnipileAdapter (Brief 133) | adopt | LinkedIn DM sending via `sendAndRecord()` already built — wire into GTM outreach step |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/self-tools/cycle-tools.ts` | Modify: Add `"gtm-pipeline"` to `CYCLE_TYPES`, `CYCLE_SLUG_MAP`. Update `ActivateCycleInput` to accept optional `gtmContext` object. Relax one-active-per-type constraint for gtm-pipeline (allow multiple with different `planName`). Add `"growth plan"` cycle label. Add optional `planName` parameter to `PauseCycleInput`, `ResumeCycleInput`, `CycleStatusInput`, `CycleBriefingInput`. Add `findActiveCycleRuns()` (plural) for multi-plan types. Enforce unique `planName` within active GTM runs. |
| `processes/templates/gtm-pipeline.yaml` | Modify: Add `harness.perspectives` config to `sense`, `assess`, and `gate` steps. Add `composer_hints` referencing audience/channel context. Update `land-outreach` step: add `crm.send_social_dm` tool alongside `crm.send_email`, update description to reference Unipile for LinkedIn DM delivery. Update `land-content` step: add `social.publish_post` tool, update description to reference automated publishing via Unipile (LinkedIn) and X API (X). Update `act-outreach` description to note channel selection includes LinkedIn DM via Unipile and X DM via X API. |
| `processes/cycles/gtm-pipeline.yaml` | Modify: Same perspectives config, Unipile, and X API tool additions as the template. |
| `src/engine/self-tools/self-tools.test.ts` | Modify: Add test for `activate_cycle` with `cycleType: "gtm-pipeline"` and structured `gtmContext`. |

## User Experience

- **Jobs affected:** Delegate (user tells Self to start a growth plan)
- **Primitives involved:** Conversation (Self asks questions, calls `activate_cycle`)
- **Process-owner perspective:** User has a conversational exchange about their audience and goals. Self summarises and activates. User gets confirmation with plan summary.
- **Interaction states:** N/A — this is engine wiring, UI comes in Brief 140
- **Designer input:** Not invoked — engine-only brief

## Acceptance Criteria

1. [ ] `CYCLE_TYPES` includes `"gtm-pipeline"` and `CYCLE_SLUG_MAP` maps it to `"gtm-pipeline"`
2. [ ] `activate_cycle({ cycleType: "gtm-pipeline", goals: "...", icp: "...", channels: "x" })` starts a GTM pipeline run with `gtmContext` in `processRuns.inputs`
3. [ ] Multiple GTM pipeline cycles can run concurrently if they have different `planName` values in `gtmContext`
4. [ ] `activate_cycle` rejects duplicate `planName` within active GTM pipeline runs
5. [ ] `pause_cycle({ cycleType: "gtm-pipeline", planName: "Dev audience on X" })` pauses only the named plan
6. [ ] `resume_cycle` accepts optional `planName` for GTM pipeline disambiguation
7. [ ] `cycle_status` for `gtm-pipeline` returns status for ALL active GTM plans (via `findActiveCycleRuns` plural helper)
8. [ ] `cycle_briefing` accepts optional `planName` to target a specific plan
9. [ ] Existing cycle types (`sales-marketing`, `network-connecting`, `relationship-nurture`) are unaffected — `planName` parameter is ignored for non-GTM types
10. [ ] `processes/templates/gtm-pipeline.yaml` has `harness.perspectives` on `sense` step (enabled, trigger: always, max_lenses: 5)
11. [ ] `processes/templates/gtm-pipeline.yaml` has `harness.perspectives` on `assess` step (enabled, trigger: always, max_lenses: 4)
12. [ ] `processes/cycles/gtm-pipeline.yaml` has matching perspectives config
13. [ ] `pnpm run type-check` passes
14. [ ] Existing `self-tools.test.ts` tests still pass
15. [ ] New test: `activate_cycle` with `cycleType: "gtm-pipeline"` returns success with plan summary
16. [ ] New test: second `activate_cycle` with same `planName` is rejected
17. [ ] `land-outreach` step in both YAML files lists `crm.send_social_dm` tool alongside `crm.send_email`
18. [ ] `land-outreach` step description references Unipile for LinkedIn DMs and X API for X DMs
19. [ ] `land-content` step in both YAML files lists `social.publish_post` tool
20. [ ] `land-content` step description references automated publishing via Unipile (LinkedIn) and X API (X)

## Reference Docs

Reference docs checked: no drift found. `docs/architecture.md` process-as-primitive and trust tier patterns apply as-is. `cycleType` extension is application-level only (no core changes).

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Verify: no new DB tables, no core package changes, perspectives config matches handler expectations
3. Verify: multi-plan concurrency doesn't break overlap prevention for other cycle types

## Smoke Test

```bash
# Type-check
pnpm run type-check

# Run self-tools tests
pnpm vitest run src/engine/self-tools/self-tools.test.ts

# Verify YAML is valid
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('processes/templates/gtm-pipeline.yaml', 'utf8')); console.log('Template OK')"
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('processes/cycles/gtm-pipeline.yaml', 'utf8')); console.log('Cycle OK')"
```

## After Completion

1. Update `docs/state.md` with GTM cycle type wiring
2. Brief 140 (Growth Composition Intent) is now unblocked
3. Brief 141 (Structured GATE + Posting Queue) is now unblocked
