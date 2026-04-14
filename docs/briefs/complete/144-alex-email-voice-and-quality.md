# Brief 144: Alex Email Voice, Composition, and Quality Gates

**Date:** 2026-04-14
**Status:** draft
**Depends on:** None (fixes existing system)
**Unlocks:** Trustworthy email cadence, workspace upsell path, industry-specific landing pages

## Goal

- **Roadmap phase:** Phase 9: Network Agent Continuous Operation
- **Capabilities:** Email composition quality, front door onboarding flow, status briefing usefulness

## Context

A full audit of Alex's 14 email sending paths revealed three critical problems that undermine user trust:

**1. Front door email storm.** When a user completes the front door conversation, they receive 3 emails within 60 seconds: (a) verification code, (b) intro email ("I'm Alex from Ditto, just making sure you have my email"), (c) LLM-generated action email ("Here's the plan"). The intro email is generic filler that adds nothing — the action email already covers everything. The user's first impression of Alex's email presence is "this thing spams me."

**2. Status emails are empty calories.** The pulse-driven status email says "4 outreach messages sent" with no names, no context, no outcomes. The user has no idea who was contacted, what was said, or whether anything worked. This is the primary ongoing touchpoint with the user — and it's useless. It actively destroys the trust Alex built during the front door conversation.

**3. No quality gate on LLM-generated emails.** Four email paths use LLM composition with zero validation: action email (post-ACTIVATE), CoS action email, relationship pulse, and Self router reply. Alex's voice in chat is carefully defined (Australian, warm, direct, dry humour, one question per message, substance over filler) but none of these constraints apply to email composition. The LLM could produce corporate jargon, sycophantic filler, or factually wrong content — and it goes straight to the user's inbox.

**Root cause:** Email was treated as a delivery mechanism, not a trust surface. Every email from Alex IS Alex. If it doesn't sound like Alex, it damages the relationship.

## Objective

Every email from Alex sounds like Alex — warm, direct, specific, substantive. The front door sends one follow-up email (not two). Status emails tell the user what actually happened. LLM-generated emails pass a voice/quality check before sending.

## Non-Goals

- Redesigning the email verification flow (verification codes are fine)
- Adding new email trigger paths (14 paths is enough)
- HTML email template redesign (text-first emails are intentional)
- Ghost mode changes (Brief 124 — working correctly)
- Workspace SSE notification design (separate concern)
- Email deliverability / spam score optimization

## Inputs

1. `src/engine/channel.ts` — `sendAndRecord()`, `formatEmailBody()`, `textToHtml()` — the core send infrastructure
2. `src/engine/self-tools/network-tools.ts` — `sendIntroEmail()`, `sendActionEmail()`, `sendCosActionEmail()` — front door emails
3. `src/engine/status-composer.ts` — `composeStatusEmail()`, `gatherStatusData()` — pulse-driven status
4. `src/engine/relationship-pulse.ts` — `composeProactiveMessage()` — LLM-generated proactive emails
5. `src/engine/completion-notifier.ts` — `notifyProcessCompletion()` — process completion emails
6. `src/engine/network-chat-prompt.ts` — Alex's voice definition (lines 123-190) — the authoritative voice spec
7. `src/engine/inbound-email.ts` — reply handling and notification emails
8. `docs/insights/162-alex-email-relationship-lifecycle.md` — email cadence principles
9. `docs/insights/161-email-vs-workspace.md` — when email works vs breaks down

## Constraints

- Alex's voice in email MUST match his voice in chat — same personality, same rules (no filler, no sycophancy, substance over ceremony)
- All emails MUST go through `sendAndRecord()` (except verification codes — transactional, intentional bypass)
- Test mode gating (`DITTO_TEST_MODE` + `DITTO_TEST_EMAILS`) MUST continue to work on all paths
- Status emails MUST respect "silence is a feature" — the 3-day minimum and activity threshold stay
- The quality gate MUST NOT add more than 500ms latency to email sends (use Haiku, not Sonnet)
- Email composition prompts MUST NOT exceed 800 tokens (system prompt + context, excluding conversation history)
- Ghost mode emails are exempt from voice checks — they're the user's voice, not Alex's
- Do not break inbound email threading (`inReplyToMessageId` chains)

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Voice consistency across surfaces | `network-chat-prompt.ts` Alex voice spec | pattern | The authoritative definition of how Alex communicates — extract and share across email composition |
| Email quality validation | Haiku validation pattern in `network-chat.ts` (`validateAndCleanResponse`) | pattern | Already validates chat responses — extend the same pattern to email |
| Substantive status updates | Insight-162 "every communication is substantive — no filler" | pattern | Established principle that applies to status emails |
| Briefing-as-intake pattern | Insight-162 early trust cadence | pattern | Status emails should weave in useful context, not just counts |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/email-voice.ts` | **Create**: Alex's email voice spec as a reusable system prompt fragment. Extracted from `network-chat-prompt.ts` voice definition. Used by all LLM-composed email paths. |
| `src/engine/email-quality-gate.ts` | **Create**: Haiku-based quality check for LLM-generated emails. Validates: sounds like Alex, no filler/sycophancy, specific not generic, factually grounded in context. Returns pass/fail + cleaned version. |
| `src/engine/self-tools/network-tools.ts` | **Modify**: (1) Delete `sendIntroEmail()` entirely. (2) Update `startIntake()` to skip the intro email call. (3) Improve `sendActionEmail()` system prompt to include Alex voice spec. (4) Improve `sendCosActionEmail()` system prompt to include Alex voice spec. (5) Both action emails pass through quality gate before sending. |
| `src/engine/status-composer.ts` | **Rewrite**: `composeStatusEmail()` becomes LLM-composed using Alex voice spec + gathered data. `gatherStatusData()` enriched to pull actual interaction summaries, contact names, and outcomes — not just counts. Fallback to current hardcoded template if LLM fails. |
| `src/engine/relationship-pulse.ts` | **Modify**: `composeProactiveMessage()` system prompt updated to use shared Alex voice spec. Output passes through quality gate before sending. |
| `src/engine/completion-notifier.ts` | **Modify**: Notification email composed with Alex voice spec (can remain hardcoded but rewritten to sound like Alex — specific, warm, direct). |
| `src/engine/inbound-email.ts` | **Modify**: Notification templates (positive reply alert, opt-out notification, cancel confirmation) rewritten to sound like Alex. |
| `src/engine/channel.ts` | **Modify**: `formatEmailBody()` persona sign-off updated — "Alex\nDitto" becomes just "Alex" (or "— Alex" for warmth). Remove the corporate "\nDitto" suffix from the sign-off. Keep Ditto branding in the referral/magic-link footers only. |

## User Experience

- **Jobs affected:** Orient (status emails inform), Review (completion notifications prompt review), Capture (reply handling acknowledges user input)
- **Primitives involved:** None (email is pre-workspace — no UI primitives)
- **Process-owner perspective:** The user receives fewer, better emails from Alex. Each email sounds like the Alex they met in the front door conversation — warm, direct, specific. Status updates tell them WHO Alex contacted, WHAT happened, and WHAT needs their attention. They stop getting duplicate intro/action emails. They trust Alex's email presence the way they trust his chat presence.
- **Interaction states:** N/A (email, not UI)
- **Designer input:** Not invoked — email is text-first, no visual design changes

## Acceptance Criteria

### Sub-brief A: Front Door Email Consolidation

1. [ ] `sendIntroEmail()` is deleted — no code path calls it
2. [ ] `startIntake()` no longer triggers an intro email — only the action email fires after ACTIVATE
3. [ ] A new user completing the front door conversation receives exactly 2 emails: (a) verification code, (b) action email. Not 3.
4. [ ] The action email references the conversation specifically — names, business, what Alex plans to do
5. [ ] The action email includes the "reply to this email" CTA (replacing what the intro email provided)

### Sub-brief B: Status Email Overhaul

6. [ ] `gatherStatusData()` pulls interaction summaries and contact names, not just counts
7. [ ] `composeStatusEmail()` uses LLM composition with Alex voice spec
8. [ ] Status email names WHO was contacted (e.g., "Reached out to Sarah Chen at Acme Accounting")
9. [ ] Status email describes OUTCOMES where available (e.g., "Sarah replied — she's interested in a call")
10. [ ] Status email includes WHAT NEEDS ATTENTION if pending approvals exist (not just a count)
11. [ ] Hardcoded fallback template fires if LLM composition fails — never sends an empty email
12. [ ] Status emails deduplicated by user email — multiple user records for the same email produce one email, not N

### Sub-brief C: Email Quality Gate

13. [ ] `email-quality-gate.ts` exists with a `validateEmailVoice()` function
14. [ ] Quality gate uses Haiku (not Sonnet) and adds <500ms latency
15. [ ] Quality gate checks: (a) no sycophantic filler ("great question", "absolutely", "I'd love to help"), (b) no corporate jargon, (c) specific to the user's situation (not generic), (d) substance — makes a point, shares information, or asks a real question
16. [ ] `sendActionEmail()` passes through quality gate before sending
17. [ ] `sendCosActionEmail()` passes through quality gate before sending
18. [ ] `composeProactiveMessage()` (relationship pulse) passes through quality gate before sending
19. [ ] Quality gate returns the original email if it passes — does not rewrite emails that are already good
20. [ ] Quality gate pass/fail result, which checks failed, and latency are logged durably (interaction metadata or activity log) — not just console.log — to feed the learning layer

### Sub-brief D: Alex Voice Spec (Shared) — BUILD FIRST

21. [ ] `src/engine/alex-voice.ts` exists as the single source of truth for Alex's personality — traits, anti-patterns, and voice rules
22. [ ] `network-chat-prompt.ts` imports Alex personality traits from `alex-voice.ts` — no duplication of personality definition between chat and email
23. [ ] Voice spec includes: personality traits (warm, direct, Australian, dry humour), anti-patterns (no filler, no sycophancy, no corporate jargon), email-specific rules (concise, one CTA per email, sign off as "Alex" not "Alex\nDitto")
24. [ ] Voice spec is used by: `sendActionEmail()`, `sendCosActionEmail()`, `composeStatusEmail()`, `composeProactiveMessage()`
25. [ ] `formatEmailBody()` sign-off changed from "Alex\nDitto" to "— Alex" (or just "Alex")
26. [ ] Completion notification and inbound notification templates rewritten to match Alex's voice (warm, direct, specific — not robotic)

## Build Order

The sub-briefs have dependencies and must be built in this sequence:

1. **Sub-brief D** (Alex Voice Spec) — creates the shared voice module that all other sub-briefs consume
2. **Sub-brief C** (Email Quality Gate) — creates the validation function that A and B pass emails through
3. **Sub-brief A** (Front Door Consolidation) — deletes intro email, improves action email using D's voice spec and C's quality gate
4. **Sub-brief B** (Status Email Overhaul) — rewrites status composer using D's voice spec and C's quality gate

A builder can implement all four in one session following this sequence.

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - Voice consistency: do the email voice spec and chat voice spec produce the same personality?
   - Quality gate scope: are all LLM-generated email paths covered?
   - Fallback safety: does every LLM-composed email have a hardcoded fallback?
   - Test mode: do all paths still respect `DITTO_TEST_MODE`?
   - Latency: does the quality gate stay under 500ms?
   - No regressions: do inbound reply threading, ghost mode, and opt-out footers still work?
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Front door consolidation: Complete a front door conversation through ACTIVATE
#    → Verify exactly 2 emails received (verification code + action email)
#    → Verify action email references conversation specifics (name, business, plan)
#    → Verify no separate "I'm Alex from Ditto, just making sure you have my email" intro email

# 2. Status email quality: Trigger a pulse tick with active interactions
#    → Verify status email includes contact names and summaries, not just "4 outreach sent"
#    → Verify duplicate user records for same email produce only 1 status email

# 3. Quality gate: Inspect server logs for quality gate pass/fail on action email
#    → Verify gate runs (log line present)
#    → Verify gate adds <500ms (check timestamps)
#    → Verify email that passes gate is sent unchanged

# 4. Voice consistency: Read the action email out loud
#    → Does it sound like the Alex from the front door chat?
#    → No "I'd love to help", no "great question", no corporate jargon?
```

## After Completion

1. Update `docs/state.md` — email quality gate active, front door sends 2 emails not 3, status emails LLM-composed
2. Update `docs/roadmap.md` — mark email voice consistency as complete
3. Capture insight: "Email IS Alex — every email from Alex must pass the same voice/quality bar as chat" → `docs/insights/`
4. Phase retrospective: measure status email engagement before/after (reply rates, workspace conversion)
