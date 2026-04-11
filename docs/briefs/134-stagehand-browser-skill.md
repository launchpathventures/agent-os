# Brief: Stagehand Browser Skill for Alex

**Date:** 2026-04-11
**Status:** draft
**Depends on:** None (independent of Brief 133)
**Unlocks:** Web research, LinkedIn profile extraction, prospect context enrichment, form filling

## Goal

- **Roadmap phase:** Phase 9: Network Agent Continuous Operation
- **Capabilities:** Browser-based web research, LinkedIn profile viewing, data extraction, general web navigation

## Context

Alex currently has no ability to browse the web. When preparing outreach, Alex relies on pre-enriched data in the person record. For ghost mode, voice matching, and relationship management, Alex needs richer context: recent LinkedIn posts, company news, mutual connections, prospect's writing style on social media.

Stagehand (github.com/browserbase/stagehand, 8k+ stars, TypeScript, MIT) is an AI browser SDK built on Playwright with four primitives: `act`, `extract`, `observe`, `agent`. It supports Anthropic models via Vercel AI SDK. It's the best-fit browser automation library for Ditto's TypeScript stack.

This brief gives Alex a `browse_web` self-tool for research and data extraction. This is a Layer 2 agent capability — separate from the social channel adapter (Brief 133). Alex uses browser skills to research a person, then sends the ghost DM via the channel adapter.

## Objective

Alex can browse the web to research prospects, read LinkedIn profiles, extract relevant context, and use that information to improve outreach quality — all via a `browse_web` self-tool that returns structured data.

## Non-Goals

- Using the browser to send messages (that's the channel adapter's job)
- Persistent LinkedIn login sessions (stateless research — login not required for public profiles)
- Full web crawling or site scraping
- Browser automation for form submission or account creation
- Real-time browser streaming to the user (Alex reports results, not a live browser view)

## Inputs

1. `docs/research/linkedin-ghost-mode-and-browser-automation.md` — Stagehand evaluation
2. `src/engine/self-tools/network-tools.ts` — existing self-tool patterns
3. `src/engine/tool-resolver.ts` — how tools are resolved and dispatched
4. Stagehand docs: https://docs.browserbase.com/introduction/stagehand
5. `src/engine/self.ts` — how Self invokes tools

## Constraints

- Browser skill is for READ operations only (research, extraction). No WRITE operations (sending messages, submitting forms, creating accounts) via browser.
- Browser sessions are stateless and short-lived — no persistent login sessions stored by Ditto.
- Stagehand runs in headless mode (no UI). Results are returned as structured text/JSON.
- Must respect robots.txt and rate limits. No aggressive crawling.
- Browser skill calls are logged in the activity table per ADR-005.
- Must not leak user credentials to browser sessions — Alex researches public information only.
- Budget: browser operations consume LLM tokens (Stagehand uses AI for element identification). Set a per-invocation token budget (default provisional — calibrate empirically during implementation).
- v1 uses local Playwright (headless Chromium, no Browserbase cloud dependency). Browserbase cloud ($99/mo) is a future option for production scaling.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Browser SDK | Stagehand (`@browserbasehq/stagehand`) | adopt | TypeScript, MIT, Playwright-based, Anthropic support. Young project (8k stars, startup-backed) — adopt level per project composition rules. Include validation step. |
| Self-tool pattern | `src/engine/self-tools/network-tools.ts` | adopt | Existing pattern for self-tools in Ditto |
| Tool resolution | `src/engine/tool-resolver.ts` | adopt | Existing dispatch pattern |
| Data extraction | Stagehand `extract` primitive | adopt | Natural language extraction with structured output |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/self-tools/browser-tools.ts` | Create: `browse_web` self-tool. Input: URL or search query + extraction instructions. Output: structured extracted data. Uses Stagehand `extract` and `observe` primitives. |
| `src/engine/self-tools/browser-tools.test.ts` | Create: tests for browser tool — URL validation, extraction formatting, error handling, token budget enforcement |
| `src/engine/self.ts` | Modify: register `browse_web` tool in Self's tool set |
| `src/engine/tool-resolver.ts` | Modify: add `browse_web` to built-in tools registry |
| `package.json` | Modify: add `@browserbasehq/stagehand` dependency |

## User Experience

- **Jobs affected:** Orient (Alex uses browser research to enrich daily briefings), Delegate (Alex researches before outreach), Decide (Alex presents research findings to inform user decisions)
- **Primitives involved:** Activity Feed (browser research logged), Conversation (Alex shares research findings inline)
- **Process-owner perspective:** "Alex, what has Sarah been posting about on LinkedIn recently?" Alex browses Sarah's public LinkedIn profile, extracts recent activity, and summarizes. Or during outreach preparation: Alex automatically researches the prospect to personalize the message.
- **Interaction states:**
  - Research in progress → "Researching Sarah's LinkedIn profile..."
  - Research complete → structured summary in conversation
  - Research failed → "I couldn't access that page. It may require authentication."
  - Rate limited → "I've done several web lookups recently. I'll pace the next ones."
- **Designer input:** Not invoked — browser skill surfaces through existing conversation interface

## Acceptance Criteria

1. [ ] `browse_web` self-tool exists with input schema: `{ url?: string, query?: string, extractionGoal: string }`
2. [ ] Tool can navigate to a URL and extract structured data using Stagehand `extract`
3. [ ] Tool can perform a web search (via search engine) when `query` is provided instead of `url`
4. [ ] Extracted data is returned as structured text (not raw HTML)
5. [ ] Tool refuses WRITE operations — returns error if extraction goal implies form submission or message sending
6. [ ] Browser sessions are headless and stateless — no persistent cookies or login state
7. [ ] Tool calls are logged in activity table per ADR-005
8. [ ] Token budget per invocation is enforced (configurable, default ~500 tokens for Stagehand AI calls)
9. [ ] Tool handles errors gracefully — page not found, timeout, robots.txt block
10. [ ] `browse_web` is registered in Self's tool set and available during conversation
11. [ ] Stagehand dependency added to package.json
12. [ ] `pnpm run type-check` passes
13. [ ] `pnpm test` passes (including new browser-tools tests)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: Layer alignment (L2 agent capability, not L3 channel), security (no credential leakage, no write operations), tool registration pattern, token budget enforcement
3. Present work + review to human

## Smoke Test

```bash
# Type check
pnpm run type-check

# Unit tests
pnpm vitest run src/engine/self-tools/browser-tools.test.ts

# Manual: ask Alex "What has [person] been posting about on LinkedIn?"
# Verify: Alex navigates to profile, extracts recent activity, summarizes in conversation
```

## After Completion

1. Update `docs/state.md`: "Browser skill: Stagehand-based browse_web self-tool for research and extraction"
2. Update `docs/landscape.md`: add Stagehand evaluation
3. Retrospective: Stagehand reliability, token cost per research operation, quality of extracted data
