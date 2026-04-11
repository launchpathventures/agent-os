# Research: LinkedIn Ghost Mode & Browser Automation for Ditto

**Date:** 2026-04-11
**Requested by:** Human (during Brief 124 ghost mode implementation)
**Status:** Complete
**Consumers:** Dev Architect (brief for LinkedIn ghost mode), Dev PM (roadmap sequencing)

## Research Question

How can Ditto support ghost-mode sending on LinkedIn (DMs, connection requests) and potentially other social channels? Three tracks: (1) integrating with existing LinkedIn automation SaaS tools, (2) open-source browser automation libraries, (3) unified messaging APIs.

---

## Track 1: LinkedIn Automation SaaS Tools

These tools automate LinkedIn by running browser sessions (cloud or extension) on behalf of the user.

### Expandi ($99/mo per seat)

- **How it works:** Cloud-based browser automation. Dedicated IP per account. Mimics human behavior patterns.
- **API:** No traditional REST API. Uses **reversed webhooks** — you POST data INTO Expandi (add people to campaigns, pause/resume). Outbound webhooks fire on events (message sent, reply received, connection accepted, campaign finished).
- **Programmatic message control:** You can add people to pre-configured campaigns via reversed webhooks. You cannot push arbitrary message text via API — campaigns are configured in the Expandi UI.
- **Integration workflow:** Webhook URLs are generated per-campaign in the Expandi dashboard. No OAuth. No API keys in the traditional sense.
- **Delivery confirmation:** Yes — webhook events for "message sent," "contact replied," "connection accepted."
- **LinkedIn detection risk:** Medium-low. Cloud browser with dedicated residential IP, human-like delays.
- **Setup friction:** User creates Expandi account, logs into LinkedIn within Expandi, creates campaign templates. Ditto pushes contacts via reversed webhook.
- **Limitation for Ditto:** Cannot programmatically set message text per-send. Must pre-configure campaign templates in Expandi UI. This breaks ghost mode's core requirement of per-message voice-matched content.

### Phantombuster ($69-$439/mo)

- **How it works:** Cloud "Phantoms" — pre-built automations that run on a schedule. Uses browser sessions.
- **API:** Full REST API included on all plans. Can launch Phantoms, pass arguments, retrieve results.
- **Programmatic message control:** Yes — can pass message text as a Phantom argument. LinkedIn Message Sender Phantom accepts custom message per contact.
- **Delivery confirmation:** Results available via API after Phantom execution. Not real-time webhooks.
- **LinkedIn detection risk:** Medium. Shared infrastructure, execution-time-based throttling.
- **Setup friction:** User creates account, connects LinkedIn cookie (`li_at`). Ditto calls API to launch Phantoms with message content.
- **Pricing model:** Execution-time based. 20h/mo on Starter ($69), 80h/mo on Pro ($159).

### HeyReach ($79/mo starter, $799/mo agency)

- **How it works:** Cloud browser sessions. Multiple LinkedIn senders per campaign.
- **API:** "Most extensive API on the market" (self-claimed). REST API + 20+ webhook events.
- **Programmatic message control:** Yes — API supports campaign creation and message customization.
- **Delivery confirmation:** Yes — 20+ webhook events including message sent, reply received.
- **LinkedIn detection risk:** Medium. Higher-tier plans require user-provided proxies (BYOP).
- **Setup friction:** User connects LinkedIn accounts. Ditto integrates via API.
- **Note:** $79 starter is 1 seat. Agency ($799) for up to 50 accounts. Overkill for single-user ghost mode.

### Dripify ($39-$59/mo per user)

- **How it works:** Cloud-based LinkedIn automation with drip sequences.
- **API:** Limited. Primarily a UI-driven tool.
- **Programmatic message control:** Limited — sequence-based, not per-message API control.
- **LinkedIn detection risk:** Medium.
- **Setup friction:** Low — browser extension + cloud hybrid.

### Waalaxy (€19-€69/mo)

- **How it works:** Browser extension + cloud. LinkedIn + email multichannel.
- **API:** Limited. Primarily UI-driven with some Zapier integrations.
- **Programmatic message control:** Limited.
- **LinkedIn detection risk:** Medium-low (extension-based).
- **Cheapest option** for basic LinkedIn automation.

### La Growth Machine (~€600/mo per identity)

- **How it works:** Multi-channel (LinkedIn + Email + Twitter). Per-identity pricing.
- **API:** Available but not extensively documented.
- **Programmatic message control:** Yes — API supports custom sequences.
- **LinkedIn detection risk:** Medium.
- **Note:** Expensive identity-based pricing model. Best for agencies.

### Summary: SaaS Tool API Capabilities

| Tool | Monthly Cost | REST API | Push Custom Message Text | Webhooks | Ghost-Feasible |
|------|-------------|----------|------------------------|----------|----------------|
| Expandi | $99 | No (reversed webhooks) | No — campaign templates only | Yes | **No** |
| Phantombuster | $69-$439 | Yes (all plans) | Yes | Limited (polling) | Partial |
| HeyReach | $79-$799 | Yes (extensive) | Yes | Yes (20+ events) | Yes |
| Dripify | $39-$59 | Limited | No | Limited | No |
| Waalaxy | €19-€69 | Limited | No | Limited | No |
| La Growth Machine | ~€600 | Yes | Yes | Unknown | Partial |

---

## Track 2: Open-Source Browser Automation

### Category A: LinkedIn-Specific Libraries

#### linkedin-private-api (TypeScript/Node.js)
- **Repo:** github.com/eilonmore/linkedin-private-api
- **npm:** `linkedin-private-api`
- **Language:** TypeScript
- **What it does:** Wraps LinkedIn's Voyager API. Supports: send messages, navigate conversations, search profiles, send connection requests. No tokens needed — uses LinkedIn session cookie.
- **Maintenance:** Low activity in recent years. Community forks exist.
- **Anti-detection:** None built-in. Raw API calls with user's session cookie.
- **LinkedIn detection risk:** High — no human-like behavior simulation, no rate limiting built-in.
- **Ditto adoption level:** **Adopt** — grab source, add rate limiting and anti-detection, own it.

#### linkedin-api (Python)
- **Repo:** github.com/nsandman/linkedin-api
- **Language:** Python
- **What it does:** Similar to above — wraps Voyager API for profiles, messaging, connections.
- **Note:** Python — would need a sidecar or subprocess for Ditto's TypeScript stack.
- **Ditto adoption level:** **Pattern** — study the API reverse-engineering, implement in TypeScript.

#### linkedin-messaging-api (by Beeper)
- **Repo:** github.com/beeper/linkedin-messaging-api (DEPRECATED)
- **Note:** Beeper (now acquired by Automattic) built this for their unified messaging platform. Deprecated but demonstrates the pattern of bridging LinkedIn messaging into a unified API.
- **Ditto adoption level:** **Pattern** — the bridge pattern is relevant.

### Category B: General-Purpose AI Browser Agents

#### browser-use (78k+ stars)
- **Repo:** github.com/browser-use/browser-use
- **Language:** Python-first. TypeScript port exists (`browser-use-typescript` on npm) but early.
- **License:** MIT
- **What it does:** Full autonomous browser control via LLM. Describe a goal, agent figures out clicks/typing/navigation. Built on Playwright.
- **Key features:** Vision + DOM extraction, multi-tab support, cookie persistence, human-in-the-loop.
- **LinkedIn use case:** Could navigate LinkedIn, compose DMs, send connection requests — all via natural language instructions.
- **Anti-detection:** Uses real browser (Playwright). Can use persistent profiles.
- **Limitation:** Python-first. TypeScript port is immature.
- **Ditto adoption level:** **Pattern** — study the agent loop architecture, implement TypeScript equivalent using Stagehand.

#### Stagehand (8k+ stars, TypeScript-first)
- **Repo:** github.com/browserbase/stagehand
- **Language:** TypeScript
- **License:** MIT
- **What it does:** Four primitives — `act`, `extract`, `observe`, `agent`. Mix AI with code for browser automation. Built on Playwright.
- **Key features:** Supports OpenAI, Anthropic, Gemini via Vercel AI SDK. Deterministic replay for cost optimization. Production-ready with Browserbase cloud.
- **LinkedIn use case:** `page.act("Send a DM to Sarah saying 'Hey, following up on our chat'")` — natural language browser control.
- **Anti-detection:** Real browser via Playwright. Browserbase cloud provides managed browser infrastructure.
- **Cloud option:** Browserbase ($99/mo for 1000 browser hours).
- **Ditto adoption level:** **Adopt** — TypeScript, MIT, clean API, actively maintained. Best fit for Ditto's stack.

#### Skyvern (16.5k+ stars)
- **Repo:** github.com/Skyvern-AI/skyvern
- **Language:** Python
- **License:** AGPL-3.0
- **What it does:** Swarm of specialized agents (navigation, interaction, data extraction, password handling). Uses vision LLMs to understand pages visually.
- **Key features:** Works on never-seen-before websites. Self-generating Playwright code. Workflow chaining.
- **LinkedIn use case:** Could handle LinkedIn automation as a workflow. More heavyweight than needed.
- **Limitation:** Python, AGPL license (copyleft — problematic for commercial use).
- **Ditto adoption level:** **Pattern** — study the multi-agent swarm approach.

#### Steel Browser
- **Repo:** github.com/steel-dev/steel-browser
- **What it does:** Open-source browser sandbox API. Session management, proxy support, cookie persistence.
- **Ditto relevance:** Infrastructure layer — could host persistent LinkedIn sessions.
- **Ditto adoption level:** **Pattern** — session management concepts.

### Summary: Browser Automation for LinkedIn

| Tool | Language | Stars | LinkedIn-Ready | Anti-Detection | Ditto Fit |
|------|----------|-------|---------------|----------------|-----------|
| linkedin-private-api | TypeScript | ~2k | Yes (messaging API) | None | Maintenance unknown | Adopt source |
| browser-use | Python | 78k+ | Via agent | Real browser | Active (Mar 2026) | Pattern only |
| Stagehand | TypeScript | 8k+ | Via agent | Real browser + cloud | Active (Apr 2026) | Adopt |
| Skyvern | Python | 16.5k | Via agent | Vision LLM | Active | Pattern (AGPL) |
| Steel Browser | TypeScript | - | Infra only | Session mgmt | Unknown | Pattern |

---

## LinkedIn Official API — Why It's Insufficient

LinkedIn's official APIs (Marketing API, Community Management API) do **not** support sending DMs between arbitrary users. The official "Communication APIs" only allow sending invitations and messages to existing connections, and require a LinkedIn partnership agreement for access. Rate limits are undocumented and enforced per-endpoint. In practice, LinkedIn restricts third-party DM sending to approved enterprise partners (Salesforce, HubSpot, etc.) via their Sales Navigator and Recruiter APIs, which cost $100-$150+/user/month and still have strict quotas (~50 DMs/day). This is why the entire LinkedIn automation industry exists — the official path is gated and expensive.

---

## Track 3: Unified Messaging APIs

### Unipile (€5/account/month)

- **What it is:** Unified REST API for messaging across LinkedIn, WhatsApp, Instagram, Messenger, Telegram, X, email, and calendars.
- **How it works:** User connects their LinkedIn account via Unipile. Unipile maintains the session. Ditto calls Unipile's API to send messages.
- **API:** 500+ REST endpoints. Full messaging, InMail, invitations, conversation sync. Node.js SDK available (`unipile-node-sdk` on npm, TypeScript).
- **Programmatic message control:** Yes — full control over message content via API.
- **Pricing:** €5/connected account/month. Volume discounts available. 7-day free trial, no credit card.
- **LinkedIn detection risk:** Handled by Unipile (they manage sessions and anti-detection).
- **Setup friction:** User connects LinkedIn account via Unipile's OAuth-like flow. Ditto integrates via REST API.
- **Multi-channel:** Same API for LinkedIn DMs, WhatsApp, Instagram DMs, email, etc.
- **Maturity concern:** Company funding/size unknown. SDK has low GitHub activity. Single-vendor risk.
- **Ditto adoption level:** Candidate for **depend** — but maturity needs validation before committing.

### Nango (open-source, self-hostable)

- **What it is:** Open-source unified API platform (YC W23). Supports 700+ API integrations including LinkedIn, Gmail, Slack, Twitter, WhatsApp.
- **How it works:** You write integration logic as TypeScript functions. Nango handles OAuth, token refresh, rate limiting, sync scheduling. Self-hostable or use their cloud.
- **API:** REST API + TypeScript SDK. LinkedIn integration covers profile data, connections. Messaging coverage unclear — Nango focuses on data sync more than action execution.
- **Pricing:** Free self-hosted. Cloud plans from $0 (limited) to enterprise pricing.
- **LinkedIn messaging support:** Partial — Nango handles OAuth and sync well but may not cover LinkedIn's unofficial Voyager API for DM sending. It wraps official APIs, which means the same DM limitations as LinkedIn's official path.
- **Ditto adoption level:** **Adopt** for the integration infrastructure pattern. May not solve LinkedIn DM sending specifically.

### OutX (browser-session-based)

- **What it is:** LinkedIn data access and action platform. Uses the user's real browser session.
- **How it works:** Mirrors the user's browser session for LinkedIn interactions. LinkedIn sees normal user activity.
- **Messaging:** Supports sending messages and connection requests via API.
- **LinkedIn detection risk:** Low — uses real browser session, appears as normal user activity.
- **Maturity:** Newer entrant, positioning as the "safe" alternative to cloud-based tools.

### Comparison: Unified APIs

| Provider | Pricing | LinkedIn DMs | Multi-Channel | Open Source | TypeScript SDK | Maturity |
|----------|---------|-------------|--------------|-------------|----------------|----------|
| Unipile | €5/acct/mo | Yes | Yes (7+ platforms) | No | Yes | Unknown |
| Nango | Free (self-host) | Partial (official API only) | Yes (700+ integrations) | Yes | Yes | YC W23, established |
| OutX | Unknown | Yes | LinkedIn-focused | No | Unknown | Newer |

---

## Gaps Identified

1. **LinkedIn's official API blocks DM sending** — all third-party solutions use unofficial/session-based approaches, creating inherent platform risk regardless of which path Ditto takes.

2. **No existing open-source TypeScript library handles LinkedIn DM sending with anti-detection** — linkedin-private-api exists but has no rate limiting or anti-detection. Would need significant hardening.

3. **browser-use has no production-ready TypeScript version** — the dominant AI browser agent is Python-first. Stagehand is the TypeScript equivalent but smaller ecosystem.

4. **Most SaaS tools don't support true per-message programmatic control** — Expandi (the most popular) only supports campaign templates, not arbitrary message text. HeyReach and Phantombuster do support it.

5. **Unified API providers are early-stage** — Unipile's company maturity is unverified. Nango is more established (YC W23) but may not cover unofficial LinkedIn DM APIs. Single-vendor dependency risk for any unified API approach.

---

## Reference Docs Status

- **landscape.md:** Needs update — Unipile and Stagehand not evaluated. LinkedIn automation tools not covered.
- **architecture.md:** Channel abstraction (ChannelAdapter) already supports extensibility. No changes needed.
- **insights/:** New insight warranted — "Unified channel APIs over per-platform automation" pattern.
