# Insight-187: Identity Choice Is a Trust Conversation, Not a Default

**Date:** 2026-04-14
**Trigger:** Designing Brief 152 — initial design silently applied `defaultIdentity` from cycle YAML without asking the user. The human caught it: "shouldn't we ask the user what identity they want to send from?"
**Layers affected:** L6 Human (trust-building interaction), L2 Agent (identity resolution), L3 Harness (identity routing)
**Status:** active

## The Insight

Choosing how outreach gets sent is one of the most trust-laden decisions a user makes with Ditto. It determines whose reputation is on the line:

| Identity | Reputation at stake | User risk |
|----------|-------------------|-----------|
| Send as Alex (`principal`) | Ditto's institutional reputation | Low — user is protected behind Alex |
| Send from my email (`user`) | User's personal/brand reputation | High — recipients think it's the user |

This is not a setting to silently apply. It's a conversation where Alex explains the trade-offs and the user makes an informed choice. The user is saying "this is how I want to show up to the world" — that deserves a moment of deliberation, not a YAML default.

Note: the original three-identity model (principal, agent-of-user, ghost from Insight-166) collapsed to two after user feedback — "agent-of-user" and "ghost" are the same thing from the user's perspective. If sending from your email, Alex should naturally learn your voice. See Insight-188.

## The Anti-Pattern

The initial design had `defaultIdentity: agent-of-user` in cycle YAML and the identity-router handler silently applying it. The user would discover their sending identity only when a recipient replied to an email they didn't know was sent.

This violates the trust contract at every level:
- **The user didn't consent** to their email being used
- **The user didn't understand** the trade-offs (response rates vs reputation risk)
- **There's no moment of trust** — the system assumed instead of asked

## The Pattern

The identity choice is part of the cycle activation conversation, not a separate settings flow:

1. Alex recommends an identity (informed by the cycle's `defaultIdentity`) but explains why
2. The user sees all available options with plain-language trade-offs
3. Ghost mode is gated — only available if voice calibration is ready
4. The choice is remembered for future cycles (user memory) but can be changed
5. If the chosen identity needs Gmail and it's not connected, the OAuth flow is inline — not a separate setup journey

**The `defaultIdentity` in cycle YAML becomes a recommendation, not a mandate.** Alex says "I'd suggest sending from your email for this — better response rates" and the user decides.

## Implications

1. **Every identity transition needs user consent.** Moving from principal to agent-of-user is an escalation of trust — Alex must ask, not assume.
2. **The choice should be a conversation moment** with a dedicated ContentBlock type (`SendingIdentityChoiceBlock`) that makes the trade-offs visual and tappable.
3. **Remember the preference.** Once the user chooses, persist it to user memory. Future cycles default to the remembered preference but still confirm on first use of a new cycle type.
4. **Ghost mode deserves extra friction** — it's the highest-risk identity. Alex should explain it clearly and only offer it when voice calibration is ready.

## Where It Should Land

- `src/engine/self-tools/cycle-tools.ts` — `activate_cycle` returns `pendingIdentityChoice` when identity isn't specified
- `src/engine/self.ts` — delegation guidance instructs Self to present identity choice during cycle activation
- `packages/core/src/content-blocks.ts` — `SendingIdentityChoiceBlock` type
- `docs/architecture.md` — document as a trust interaction pattern in Layer 6
