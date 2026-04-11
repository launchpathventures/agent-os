# Brief: Outreach Visibility + Email-Initiated Cancellation

**Date:** 2026-04-10
**Status:** draft
**Depends on:** Brief 121 (email_thread for thread-context resolution)
**Unlocks:** None (safety + trust improvements)

## Goal

- **Roadmap phase:** Phase 9: Network Agent Continuous Operation
- **Capabilities:** Outreach text visibility for users, email-initiated process cancellation

## Context

Two trust-building gaps remain:

1. **Users can't see what Alex sent.** When Alex contacts prospects on the user's behalf, the user only sees a summary in the report-back email. If a prospect complains ("some guy named Alex emailed me?"), the user has no way to see the actual outreach text. A real advisor would show you the draft.

2. **Users can't cancel via email.** If a user replies "actually cancel this" or "stop everything", there's no mechanism to halt running processes. The Self has `pause_goal` tool, and `inbound-email.ts` already routes user emails to `selfConverse()` for ambiguous cases. But obvious cancellation intent ("cancel", "stop") should be detected and acted on immediately without an LLM roundtrip.

## Objective

Users can see the actual text Alex sent to prospects (in report-back emails and on request), and can halt any running process by replying with cancellation intent to any Alex email.

## Non-Goals

- UI for browsing outreach history (future — workspace feature)
- Editing outreach after it's sent
- Undoing sent emails
- Cancellation of individual steps (only full goal/process pause)

## Inputs

1. `src/engine/channel.ts` — `sendAndRecord()` where full body storage is added
2. `src/engine/inbound-email.ts` — Reply classification and routing
3. `src/engine/heartbeat.ts` — `pauseGoal()` for process cancellation
4. `src/engine/notify-user.ts` — User notification routing
5. `processes/templates/front-door-intake.yaml` — Report-back step where outreach text is surfaced

## Constraints

- Full email body stored in interaction metadata (not a new table)
- Cancellation detection must be keyword-based (no LLM call) for speed and reliability
- Ambiguous cancellation ("maybe hold off", "I'm not sure about this") routes to Self for judgment
- Cancellation confirmation sent to user within 30 seconds
- Cancellation halts the goal (all child processes), not just one step
- Thread-context resolution (which goal to cancel) uses interaction metadata `processRunId`

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Full body storage in metadata | Interaction metadata pattern (already stores messageId, threadId) | adopt | Same mechanism, just adding body field |
| Intent detection | `isOptOutSignal()` in inbound-email.ts | adopt | Same pattern: keyword list → boolean classification |
| Goal pause | `pauseGoal()` in heartbeat.ts | adopt | Already built, just needs email-trigger wiring |
| Thread-context resolution | Interaction `processRunId` field | adopt | Already tracked, just needs lookup |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/channel.ts` | Modify: in `sendAndRecord()`, store `body: input.body` in interaction metadata alongside existing messageId/threadId. Existing `summary` stays truncated for UI display. |
| `src/engine/inbound-email.ts` | Modify: (1) Add `isCancellationSignal(text): boolean` — keyword detection for "cancel", "stop", "never mind", "don't do this", "hold off", "pause". (2) In `handleUserEmail()`, check for cancellation before routing to Self. If detected: look up active processRunId from thread context (interaction metadata), find parent goal, call `pauseGoal()`. Notify user: "Done — I've paused this. Reply if you want me to pick it back up." (3) Ambiguous cases still route to Self via `selfConverse()`. |
| `processes/templates/front-door-intake.yaml` | Modify: report-back step description — instruct AI to include actual outreach text: "Here's exactly what I sent to [name]:" followed by quoted draft from step inputs. |
| `processes/templates/user-nurture-first-week.yaml` | Modify: day-7-summary step — instruct AI to include links/quotes from outreach sent if available. |

## User Experience

- **Jobs affected:** Orient (see what was sent), Capture (cancel via email reply)
- **Primitives involved:** Conversation (email as interaction), TrustControl (cancellation = trust withdrawal)
- **Process-owner perspective:** "I can see exactly what Alex sent on my behalf. If I don't like it, I reply 'stop' and everything halts within 30 seconds. I'm in control."
- **Interaction states:**
  - Cancellation detected → "Done — I've paused [goal name]. Reply 'resume' to pick back up." (within 30s)
  - Ambiguous cancellation → Self responds conversationally ("Want me to hold off on the outreach to accountants, or everything?")
  - Outreach visibility → report-back email includes: "Here's what I sent to Sarah at Meridian: [full quoted text]"
- **Designer input:** Not invoked — email-only changes

## Acceptance Criteria

1. [ ] `sendAndRecord()` stores full email body in interaction metadata (`metadata.body`)
2. [ ] Existing interaction metadata fields (messageId, threadId) are preserved
3. [ ] `isCancellationSignal("cancel this")` returns true
4. [ ] `isCancellationSignal("stop everything")` returns true
5. [ ] `isCancellationSignal("never mind")` returns true
6. [ ] `isCancellationSignal("that sounds great")` returns false
7. [ ] `isCancellationSignal("maybe hold off")` returns false (ambiguous → routes to Self)
8. [ ] Cancellation detected → active goal paused via `pauseGoal()` within 30s
9. [ ] Cancellation detected → user receives confirmation email: "Done — I've paused this."
10. [ ] Ambiguous cancellation → routed to Self via `selfConverse()` (no auto-pause)
11. [ ] Report-back step in front-door-intake includes actual outreach text (quoted)
12. [ ] Thread-context resolution correctly identifies which goal to cancel from reply thread
13. [ ] Cancellation email from an email address that does NOT own the goal does NOT trigger pause
14. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: Security (cancellation only by the user who owns the goal, not arbitrary emails), trust model (cancellation = trust withdrawal, properly recorded), feedback capture (cancellation event recorded as interaction)
3. Present work + review to human

## Smoke Test

```bash
# Type check
pnpm run type-check

# Cancellation detection tests
pnpm vitest run src/engine/inbound-email-cancel.test.ts

# Manual: trigger a front-door-intake process, then send a reply "cancel this"
# Verify: goal paused, confirmation email sent, no further process steps execute
```

## After Completion

1. Update `docs/state.md`: "Outreach visibility (full body in metadata) + email cancellation detection"
2. No ADR needed — uses existing patterns (intent detection, goal pause)
3. Retrospective: false positive rate on cancellation detection? Any legitimate emails caught?
