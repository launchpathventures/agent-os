# Insight-174: Unified Channel APIs Over Per-Platform Automation

**Date:** 2026-04-11
**Trigger:** Research into LinkedIn ghost mode support (Brief 124 follow-on)
**Layers affected:** L3 Harness (channel adapters), L6 Human (multi-channel sending)
**Status:** provisional — needs validation of unified API provider maturity and alternatives

## The Insight

For social channel ghost mode (LinkedIn DMs, WhatsApp, Instagram, etc.), the winning pattern is **unified messaging APIs** (like Unipile) rather than per-platform browser automation tools (like Expandi) or raw browser agents (like Stagehand).

This mirrors how Ditto already handles email: AgentMail abstracts away email infrastructure so Ditto focuses on the harness, not the delivery. Unipile does the same for social channels — one REST API, multiple platforms, session management and anti-detection handled by the provider.

The alternative — integrating with per-platform SaaS tools — is mixed. Most (Expandi, Dripify, Waalaxy) don't support per-message programmatic text control. HeyReach and Phantombuster do, making them viable but single-platform. They're designed for campaign templates, not voice-matched individual messages. And building browser automation in-house (via Stagehand or browser-use) means owning session management, anti-detection, and platform-specific DOM navigation — all liability with no moat.

Browser automation (Stagehand) remains valuable as a **general capability** for Alex — research, data extraction, form filling, web navigation — but not as the LinkedIn sending channel. "Browser as a skill" and "LinkedIn as a channel" are separate concerns.

## Implications

1. **Channel adapter pattern extends cleanly:** `ChannelAdapter` interface already supports `"email" | "voice" | "sms"`. Adding `"social"` with a Unipile-backed adapter follows the same pattern as AgentMail for email.
2. **Ghost mode infrastructure is channel-agnostic:** The identity resolution, voice calibration, cognitive mode, and trust gate work regardless of whether the message goes out via email or LinkedIn DM.
3. **Browser automation is orthogonal:** Stagehand/browser-use is a tool capability (like file reading or web search), not a channel adapter. Alex might use browser skills to research a person on LinkedIn, then send the ghost DM via the Unipile channel adapter.
4. **Cost model is favorable:** Unipile at €5/connected account/month vs Expandi at $99/seat/month or browser infrastructure costs.

## Where It Should Land

- Architecture spec: Channel adapter section should note the unified API pattern for social channels.
- Landscape doc: Unipile and Stagehand need evaluations.
- Future brief: "Social Channel Ghost Mode via Unified Messaging API" — when LinkedIn ghost mode moves from research to design.
