# Brief: Structured GATE Review + Automated Content Publishing

**Date:** 2026-04-13
**Status:** draft
**Depends on:** Brief 139 (GTM Cycle Type — complete), Brief 140 (Growth Composition — complete or in parallel), Unipile social channel adapter (Brief 133 — complete)
**Unlocks:** Engagement tracking loop, asset pipeline

## Goal

- **Roadmap phase:** Phase 14: Network Agent (GTM track)
- **Capabilities:** GTM-specific experiment review at GATE, automated content publishing (LinkedIn via Unipile, X via X API), published content tracking for next-cycle feedback, asset recommendation prompts

## Context

The feed assembler (`src/engine/feed-assembler.ts`) builds `ReviewCardBlock` from `waiting_review` runs. Currently it extracts `outputText` as generic text from `processOutputs`. For GTM pipeline runs, the ACT step outputs are structured experiments (credibility draft, pain-naming draft, outreach drafts) — but the review card shows them as raw text.

**All delivery is automated after GATE approval — no manual posting queue needed.**

| Track | Output | Delivery | Adapter |
|-------|--------|----------|---------|
| Credibility + Pain-naming | LinkedIn **feed posts** | Automated | Unipile Posts API (`client.users.createPost()`) — already paying |
| Credibility + Pain-naming | X **tweets/threads** | Automated | X API v2 (`POST /2/tweets`, $0.01/tweet pay-per-use) |
| Outreach | LinkedIn **DMs** | Automated | Unipile Messaging API (Brief 133, already built) |
| Outreach | X **DMs** | Automated | X API v2 (`POST /2/dm_conversations`) |
| Outreach | **Emails** | Automated | AgentMailAdapter (existing) |

The Unipile SDK already has a Posts API (`client.users.createPost()`) separate from the Messaging API. This is NOT the DM adapter from Brief 133 — it's the `UsersResource` class that publishes public feed posts. The existing `UnipileAdapter` in `channel.ts` handles messaging only; we need to extend it or add a posting method.

For X, the API v2 pay-per-use model costs $0.01/tweet. Threads are posted sequentially with `reply.in_reply_to_tweet_id`. A typical growth plan (~20 tweets/week) costs ~$0.80/month.

## Objective

GTM experiments at the GATE display with structured presentation. After approval, content publishes automatically to LinkedIn (via Unipile) and X (via X API). Published posts are tracked with platform post IDs and URLs so the LEARN step can check engagement next cycle. Asset recommendations surface with generation prompts.

## Non-Goals

- Manual posting queue / copy-to-clipboard (automated publishing replaces this)
- Buffer integration (both channels publish natively now)
- New block types or React components
- Engagement analytics dashboard (LEARN step handles this)
- Changing the review card renderer (we format as rich markdown in `outputText`)
- LinkedIn articles (Unipile Posts API doesn't support them — feed posts only)

## Inputs

1. `src/engine/feed-assembler.ts` — Review item assembly (lines 220-318)
2. `src/engine/surface-actions.ts` — Action handler (the switch statement at line 195)
3. `src/engine/channel.ts` — UnipileAdapter (messaging), `sendAndRecord()`, ChannelAdapter interface
4. `processes/templates/gtm-pipeline.yaml` — Step IDs and output structure
5. `packages/web/lib/compositions/growth.ts` — Will render published content status (Brief 140)
6. `packages/web/app/api/growth/route.ts` — Will serve published content data (Brief 140)
7. Unipile Posts API docs: `client.users.createPost({ account_id, text, attachments? })`
8. X API v2 docs: `POST https://api.x.com/2/tweets`

## Constraints

- Review card `outputText` is markdown — the existing `ReviewCardBlock` renderer handles this. No component changes.
- Unipile Posts API uses `client.users.createPost()` (different SDK resource than messaging) — do NOT extend the existing `UnipileAdapter.send()` for posting. Create a separate posting function or adapter method.
- X API uses OAuth 1.0a (app key + user access token) for single-user posting. This matches the env var pattern (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`). OAuth 2.0 with PKCE would be needed for multi-user — not required for v1 where the user connects their own account. Store tokens in env vars / credential vault per ADR-005.
- X threads: post tweets sequentially, each with `reply.in_reply_to_tweet_id` pointing to the previous. If any tweet in the thread fails, record partial success.
- Published content must be recorded in `stepRuns.outputs` with: `platform`, `postId`, `postUrl`, `publishedAt`, `content`. The LEARN step reads these next cycle.
- GATE approval is the control point — nothing publishes without it. The trust gate is non-negotiable.
- **Harness pipeline traversal:** `publishPost()` is invoked from within the `land-content` step execution. Because `land-content` is `executor: ai-agent`, it traverses the full harness pipeline including outbound-quality-gate before execution completes. The GATE human approval + outbound-quality-gate on the LAND step provide two layers of quality assurance. `publishPost()` must NOT be callable outside of step execution.
- `DITTO_TEST_MODE` must suppress social publishing the same way it suppresses DMs (Brief 133 pattern).
- Asset generation prompts are injected as `suggestion` blocks — the "Run this prompt" action routes through the existing `suggest-accept` handler.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| Review card enrichment | `src/engine/feed-assembler.ts` assembleReviewItems | adopt | Extend existing per-process enrichment |
| Unipile Posts API | Unipile SDK `UsersResource.createPost()` | depend | Already using Unipile for messaging — Posts API is same SDK |
| X API v2 posting | X API v2 (`POST /2/tweets`) | depend | Official API, pay-per-use, thread support |
| Test mode suppression | `src/engine/channel.ts` `isSocialTestModeSuppressed()` | adopt | Same pattern as Brief 133 |
| Surface action namespacing | `src/engine/surface-actions.ts` review namespace | adopt | Same pattern, new namespace |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/feed-assembler.ts` | Modify: In `assembleReviewItems()`, detect GTM pipeline GATE step. Parse ACT step outputs (credibility, pain-naming, outreach) from `stepRuns`. Format as structured markdown in `outputText` (hook, target, hypothesis, kill criteria, confidence, full draft per experiment). |
| `src/engine/channel.ts` | Modify: Add `publishPost(platform, content, attachments?)` function that routes to Unipile Posts API (LinkedIn) or X API (X). Add `PublishResult` type with `postId`, `postUrl`, `platform`. Extend `SocialPlatform` to include `"x"`. Add `XApiClient` class for X API v2 (OAuth 2.0, tweet creation, thread posting). |
| `src/engine/channel.ts` | Modify: Add `getXApiConfig()` factory (reads `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` from env). |
| `.env.example` | Modify: Add `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` environment variables. |
| `src/engine/surface-actions.ts` | Modify: Add `"asset"` case to namespace switch: return suggestion block with generation prompt text from `gtmContext.strategy.assetRecommendations`. |
| `packages/web/app/api/growth/route.ts` | Modify: Include published content data — LAND step outputs with post IDs, URLs, and timestamps per platform. |
| `src/engine/channel-publishing.test.ts` | Create: Tests for `publishPost()` — LinkedIn via Unipile Posts API, X via X API, thread posting (sequential with reply_to), test mode suppression, error handling, partial thread failure. |
| `src/engine/feed-assembler.test.ts` | Create or modify: Test that GTM pipeline GATE review items have structured experiment markdown. |

## User Experience

- **Jobs affected:** Review (structured experiment review), Orient (see published content status in growth dashboard)
- **Primitives involved:** Review Card (enriched markdown), Status Card (publish confirmation), Record (asset recommendations)
- **Process-owner perspective:** At the GATE, user sees each experiment clearly — hook, target, hypothesis, confidence — instead of a wall of text. User approves. Content publishes automatically to LinkedIn and X. User sees confirmation in the growth dashboard. Next cycle, SENSE checks engagement on published posts.
- **Interaction states:**
  - **GATE review:** ReviewCardBlock with rich markdown. Three sections (credibility, pain-naming, outreach). Approve/Edit/Reject buttons.
  - **Publishing:** Automatic after approval. Status card: "Published to LinkedIn" / "Thread posted to X (6 tweets)".
  - **Publish failure:** Status card with error. Content remains in step output for retry or manual posting.
  - **Asset recommendation:** Record block with "Generate with prompt" button → Suggestion block with pre-loaded prompt → "Run this prompt" feeds into conversation.
- **Designer input:** Not invoked — uses existing block renderers, enriched data only

## Acceptance Criteria

1. [ ] GTM pipeline GATE review cards show structured markdown: each experiment has Hook, Target, Hypothesis, Kill criteria, Confidence, and Full draft sections
2. [ ] Experiments are grouped by track (Credibility / Pain-naming / Outreach) with markdown headers
3. [ ] Non-GTM process review cards are completely unaffected
4. [ ] `SocialPlatform` type includes `"x"` alongside `"linkedin"`, `"whatsapp"`, `"instagram"`, `"telegram"`
5. [ ] `publishPost("linkedin", content)` calls Unipile `client.users.createPost()` and returns `PublishResult` with `postId` and `postUrl`
6. [ ] `publishPost("x", content)` calls X API v2 `POST /2/tweets` and returns `PublishResult` with `postId` and `postUrl`
7. [ ] X threads: `publishPost("x", threadContent)` posts tweets sequentially with `reply.in_reply_to_tweet_id` chaining
8. [ ] X thread partial failure: if tweet 4/6 fails, tweets 1-3 are recorded as published, error reported for remainder
9. [ ] `DITTO_TEST_MODE` suppresses publishing (same pattern as Brief 133 social DM suppression)
10. [ ] Published posts recorded in `stepRuns.outputs` with `platform`, `postId`, `postUrl`, `publishedAt`, `content`
11. [ ] `/api/growth` endpoint includes published content with platform post IDs and URLs
12. [ ] `asset.generate.{type}` surface action returns a suggestion block with the generation prompt from `gtmContext.strategy.assetRecommendations`
13. [ ] X API credentials stored in env vars (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`)
14. [ ] `pnpm run type-check` passes
15. [ ] Publishing tests verify LinkedIn (Unipile) and X (API v2) paths
16. [ ] Feed assembler test verifies structured GTM GATE output

## Reference Docs

- `docs/landscape.md` — needs update: add X API v2 evaluation (pay-per-use posting, thread support, OAuth 1.0a auth)
- `docs/adrs/029-x-api-and-social-publishing.md` — created: X API v2 + Unipile Posts API adoption decision
- `docs/architecture.md` — checked, no drift found (harness pipeline, trust gate, outbound-quality-gate all apply)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Verify: no new block types, no new DB tables
3. Verify: publishing is invoked within `land-content` step execution — traverses full harness pipeline including outbound-quality-gate
4. Verify: X API credentials handled per ADR-005 (env vars, never exposed to agents)
5. Verify: test mode suppression works for publishing (not just DMs)

## Smoke Test

```bash
# Type-check
pnpm run type-check

# Publishing tests
pnpm vitest run src/engine/channel-publishing.test.ts

# Feed assembler tests
pnpm vitest run src/engine/feed-assembler

# Manual integration (requires Unipile + X API credentials):
# 1. Activate a GTM pipeline cycle
# 2. Let it run to GATE
# 3. Verify review card shows structured experiments
# 4. Approve — verify LinkedIn post appears on feed, X thread appears on timeline
# 5. Verify step outputs contain postId and postUrl
```

## After Completion

1. Update `docs/state.md` with structured GATE + automated publishing
2. The full Social Growth Plans feature is now functional end-to-end
3. LEARN step can check engagement on published content via postId/postUrl
