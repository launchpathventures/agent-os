# Insight-186: Non-Blocking Integration Upgrade Offers

**Date:** 2026-04-14
**Trigger:** Designing Google Workspace OAuth UX for Brief 152. The question: when Alex needs to send as the user but Gmail isn't connected, should Alex block and ask, or proceed and offer?
**Layers affected:** L2 Agent (tool fallback behavior), L6 Human (integration connection UX)
**Status:** active

## The Insight

When an integration is missing but a fallback exists, **proceed with the fallback and offer the upgrade** — don't block the user's workflow to demand setup.

The anti-pattern is what most SaaS products do: "Connect your Gmail to continue" → user has to stop, find settings, do OAuth, come back. This interrupts the user's momentum and frames the integration as a prerequisite rather than an enhancement.

The Ditto pattern:

1. **Start immediately** with what works (AgentMail as Alex)
2. **Offer the upgrade** in context ("want outreach to come from your Gmail instead?")
3. **Make it one click** to start (direct link to OAuth consent, `login_hint` pre-filled)
4. **Don't nag** — offer once per cycle type, then respect silence

This follows Insight-090 (integration auth is a conversation moment) but adds a critical nuance: **the conversation moment is non-blocking**. The user gets value before they connect anything. The connection is additive.

## Why This Matters

SMB owners (Rob, our primary persona) are not going to stop mid-workflow to connect Gmail. They want to see Alex working. The moment Alex sends a first outreach email successfully — even from Alex's own address — Rob sees the value. That's when the offer to "upgrade to sending from your Gmail" lands naturally.

If we gate on Gmail connection, Rob never sees the first email go out. He's stuck in a setup flow instead of seeing results.

## The Pattern

```
Trigger: Agent needs capability X but only has fallback Y
→ Use fallback Y immediately (don't block)
→ Offer capability X in context (email for Layer 2, UI for Layer 3)
→ Make activation one click (OAuth link with login_hint)
→ Flag the offer so it's not repeated
→ When X becomes available, automatically upgrade future operations
```

## Where It Should Land

- `docs/architecture.md` — Layer 6 (Human Interface) interaction pattern: "non-blocking upgrade offers"
- Process template guidelines — steps should never require integrations that have fallbacks
- `src/engine/channel-resolver.ts` — the `onFallback` callback is the implementation point
