# Brief 156: Email Send Outcome Fidelity

**Date:** 2026-04-16
**Status:** draft
**Depends on:** none
**Unlocks:** cleaner follow-up sequences (avoids chasing "replies" to emails that never left), accurate cycle KPIs (MP-8.2)

## Goal

- **Roadmap phase:** Meta-Process Robustness (sub-roadmap MP-6)
- **Capabilities:** MP-6 reliability — interactions truthfully reflect what happened at the channel boundary

## Context

Audit of `src/engine/channel.ts` found that `sendAndRecord()` records an `outreach_sent` interaction regardless of whether the send actually succeeded. Specifically:

- Line 1037-1050: `adapter.send(...)` returns `{ success, error, messageId, threadId }`
- Line 1053-1071: `recordInteraction({ type: "outreach_sent", ... })` is called unconditionally with `metadata.sendError` if the send failed
- Line 996-1001: caller receives `{ success: sendResult.success, ... }` so the immediate caller knows, but downstream queries don't

The same pattern exists on the DM path (line 947, 972). The comment "Record the interaction regardless of send success" was intentional for audit, but it has three real consequences:

1. **Dedup caps misfire.** `MAX_DAILY_OUTREACH_PER_PERSON` and `hasInteractionSince` treat the failed send as a real contact. A user gets blocked from retry even though nothing reached them.
2. **Follow-up timing drifts.** `follow-up-sequences.yaml` uses interaction recency to schedule next touches. If the send failed, follow-ups still count from the "sent" time — meaning the follow-up could arrive before the prospect ever got the first email (if retry succeeds later).
3. **Cycle KPIs lie.** `network_status` counts `outreach_sent`. Users see "28 sent this week, 3 replies" when only 24 actually got delivered — response-rate looks worse than reality.

Trust auto-upgrade logic in `people.ts` only fires on `positive` outcomes, so it's unaffected. But the audit called this "marks sent even if failed" — a user-visible truth gap.

## Objective

`outreach_sent` interactions represent a successful channel send. Failed sends are recorded as a separate type (`outreach_failed`) so audit history is preserved but downstream queries (dedup, follow-up timing, KPIs) see only what actually went out.

## Non-Goals

- Retry logic on send failure (separate concern — `agentmail-adapter` / `gmail-adapter` handle transport retries)
- Changing interaction schema beyond adding the failed variant
- Refactoring the 4 call sites in `channel.ts` into one — they have legitimate differences (DM vs email, persona routing)
- Migrating existing `outreach_sent` rows with `metadata.sendError` — past data is read-only audit

## Inputs

1. `src/engine/channel.ts:902-1084` — `sendAndRecord()` DM and email paths. Key lines: 947, 972, 1024, 1056 (all four `recordInteraction` calls with `type: "outreach_sent"`)
2. `src/db/schema/network.ts:34-45` — `interactionTypeValues` — need to add `outreach_failed`
3. `src/engine/people.ts:247` — `hasInteractionSince(personId, type, since)` — verify callers pass `type` and how they'd now handle the split
4. `src/engine/channel.ts:867` — `MAX_DAILY_OUTREACH_PER_PERSON` comment references `outreach_sent` — update counter query
5. `src/engine/status-composer.ts`, `src/engine/relationship-pulse.ts`, `src/engine/people.ts` auto-upgrade — any consumer filtering by `type: "outreach_sent"` needs to be reviewed
6. `processes/templates/follow-up-sequences.yaml` — verify whether it references `outreach_sent` directly or relies on `lastInteractionAt`
7. `src/engine/self-tools/network-tools.ts` — `network_status` interaction counting
8. `src/engine/outreach-table.ts` — outreach summary aggregation

## Constraints

- Interaction schema is shared with downstream product views; the new type must be added to `interactionTypeValues` union and migrations must be generated via `pnpm db:generate`
- Must NOT drop the record on failure — audit trail matters. Same row shape, different `type`, same `metadata.sendError`
- Dedup cap should count `outreach_failed` separately (e.g., allow up to 3 retries in 24h) rather than lumping it into the `outreach_sent` cap, otherwise a failed send burns the daily budget
- Trust auto-upgrade must be untouched (it already filters on outcome, not type)
- Callers of `sendAndRecord` should not need code changes — the function still returns `{ success, interactionId, error }`

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|-----------------|
| Split "sent" vs "failed" interaction types | Gmail/Mailgun webhook terminology (`delivered`, `bounced`, `rejected`) | pattern | Standard channel-state modelling; matches user mental model |
| Keep audit row on failure | existing `sendAndRecord` pattern line 1020-1033 (AgentMail not configured path) | adopt | Same file already records a failed-send interaction when adapter is missing; generalise |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/db/schema/network.ts:34-45` | Modify: add `"outreach_failed"` to `interactionTypeValues` |
| `drizzle/` (generated) | Create: new migration via `pnpm db:generate` — no table-shape change, just union value (SQLite CHECK will regenerate if present, otherwise no-op) |
| `src/engine/channel.ts:947, 972, 1024, 1056` | Modify: branch on `sendResult.success` — success → `type: "outreach_sent"`, failure → `type: "outreach_failed"`. The metadata payload is identical (keeps `sendError` for debugging). Extract into a helper `recordSendOutcome(input, sendResult)` to avoid duplicating the branch four times |
| `src/engine/channel.ts:867-930` | Modify: `MAX_DAILY_OUTREACH_PER_PERSON` counting — only count `outreach_sent` (not `outreach_failed`) when enforcing the cap, so retries after transport failure are allowed |
| `src/engine/people.ts:247` | Verify: callers pass specific `type` — if any use `"outreach_sent"` to mean "any outbound attempt", either update the call site or add an `inArray` path |
| `src/engine/outreach-table.ts` | Modify: outreach summary distinguishes `sent` from `attempted` (sent + failed). Status-composer shows both for operational awareness |
| `src/engine/status-composer.ts` | Verify/modify: if referencing `outreach_sent` in queries, decide whether to surface failed sends (probably yes — "3 sends bounced this week" is useful) |
| `src/engine/self-tools/network-tools.ts` (`handleNetworkStatus`) | Modify: `interactions this week` count stays on `outreach_sent`; add `sends_failed` line when > 0 |
| `src/engine/channel.test.ts` (if exists) or new `src/engine/channel-outcome.test.ts` | Create: unit tests — successful send → `outreach_sent`, failed send → `outreach_failed`, dedup cap ignores failed sends, retry after failure is allowed |
| `src/engine/inbound-email.ts` reply classification | Verify: reply matching uses `threadId`/`messageId`, not interaction type — so no change needed, but document it |

## User Experience

- **Jobs affected:** Review (audit of what actually happened), Orient (cycle KPIs reflect reality)
- **Primitives involved:** OutreachTable, NetworkStatus briefing line, StatusComposer narrative
- **Process-owner perspective:** User sees accurate "24 sends delivered, 3 bounced — want me to retry?" instead of "28 sent" silently including failures
- **Interaction states:**
  - Success (existing): `outreach_sent` — unchanged
  - Failure (new): `outreach_failed` — shown in status-composer when count > 0 with specific reasons pulled from `metadata.sendError`
  - Dedup-blocked retry: user sees "would retry, last attempt failed with `<reason>`" — allow manual resend
- **Designer input:** Not invoked — reuses existing tables/narratives; copy updates in status-composer

## Acceptance Criteria

1. [ ] `"outreach_failed"` added to `interactionTypeValues` in `src/db/schema/network.ts`
2. [ ] `pnpm db:generate` produces a migration (or no-op if SQLite doesn't enforce the union)
3. [ ] `sendAndRecord` email path records `outreach_sent` on `sendResult.success === true`, `outreach_failed` otherwise
4. [ ] `sendAndRecord` DM path does the same for Telegram/other DM adapters
5. [ ] The extracted `recordSendOutcome` helper reuses identical metadata shape in both branches (diff should show one branch, not four)
6. [ ] `MAX_DAILY_OUTREACH_PER_PERSON` cap query only counts `outreach_sent` — proven by a test that seeds 5 `outreach_failed` rows and confirms cap is not hit
7. [ ] `hasInteractionSince(personId, "outreach_sent", since)` returns only successful sends; callers relying on "any attempt" are updated to use `inArray(type, ["outreach_sent", "outreach_failed"])`
8. [ ] `network_status` briefing: shows `sent` count (successes) + a `sends_failed` line when > 0
9. [ ] `outreach-table` separates a `failed` column (or equivalent) from the `sent` column
10. [ ] AgentMail-not-configured path (line 1020-1033) is updated to use `outreach_failed` type (it currently uses `outreach_sent` with `sendFailed: true` metadata — inconsistent)
11. [ ] No regression: trust auto-upgrade logic untouched (verified by running `people.test.ts`)
12. [ ] No regression: inbound reply classification still matches against outbound by threadId, not type (verified by `inbound-email.test.ts`)
13. [ ] Unit test: send success creates `outreach_sent`
14. [ ] Unit test: send failure creates `outreach_failed` with `metadata.sendError`
15. [ ] Unit test: daily cap allows 5 retries after 5 failed sends but blocks the 6th successful send
16. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: (a) no consumer of `interactionType` was missed (use `rg '"outreach_sent"' src/` to enumerate), (b) dedup semantics are documented so a future reader doesn't re-merge them, (c) metadata schema unchanged so audit tooling still parses, (d) trust logic untouched
3. Present work + review findings to human for approval

## Smoke Test

```bash
pnpm run type-check

# Dedicated channel tests
pnpm vitest run src/engine/channel-outcome.test.ts

# Sanity: no "outreach_sent" literal remains that should have been updated
grep -rn '"outreach_sent"' src/ | grep -v "test"

# Simulate: trigger a mock send-failure path via MOCK_LLM + adapter stub,
# then query interactions table and assert row has type="outreach_failed"
```

## After Completion

1. Update `docs/state.md` with channel-outcome fix
2. Update `docs/meta-process-roadmap.md` — add row for "Brief 156: email send outcome fidelity" under MP-6
3. Insight: record that "truth at the channel boundary" is a principle — downstream views must reflect what actually happened, not what was attempted. Candidate for an ADR about interaction type semantics if it recurs
