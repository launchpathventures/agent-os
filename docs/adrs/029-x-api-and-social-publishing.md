# ADR-029: X API v2 + Unipile Posts API for Social Content Publishing

**Date:** 2026-04-13
**Status:** proposed

## Context

Social Growth Plans (Brief 138) need to publish content to LinkedIn and X after GATE approval. Three options evaluated:

| Option | LinkedIn Posts | X Posts/Threads | Cost | Complexity |
|--------|--------------|-----------------|------|-----------|
| **Buffer API** | Yes | Yes | $6/mo/channel | OAuth, scheduling, separate service |
| **Unipile Posts API + X API v2** | Yes (Unipile) | Yes (X API) | Unipile (already paying) + ~$1-2/mo X API | Two APIs, but one already integrated |
| **Manual posting queue** | Copy-paste | Copy-paste | Free | No integration, high user friction |

Buffer adds a third-party dependency for both channels when we already have Unipile connected for LinkedIn (messaging + posts in the same SDK) and X API v2 is cheap at $0.01/tweet pay-per-use.

**Key findings:**
- Unipile's Posts API (`client.users.createPost()`) is a separate SDK resource from the Messaging API. It publishes LinkedIn feed posts with text and image attachments. Already paying per connected account.
- Unipile's X/Twitter integration is **deprecated** — cannot rely on it for X publishing.
- X API v2 moved to pay-per-use in 2026. No free tier for new developers. $0.01/tweet, ~$1-2/month at typical growth plan volume (~20 tweets/week).
- X API uses OAuth 1.0a for single-user posting (app key + user access token). Simple for v1 where user connects their own account.

## Decision

Use **Unipile Posts API for LinkedIn feed posts** and **X API v2 for X tweets/threads**. No Buffer dependency.

- LinkedIn: `client.users.createPost({ account_id, text, attachments? })` — same Unipile SDK already in use for DMs.
- X: Direct `POST /2/tweets` via `XApiClient` class in `src/engine/channel.ts`. OAuth 1.0a auth. Thread posting via sequential tweets with `reply.in_reply_to_tweet_id`.
- Both invoked from within `land-content` step execution, traversing the full harness pipeline (including outbound-quality-gate).
- Published content recorded in `stepRuns.outputs` with `postId`, `postUrl`, `publishedAt` for engagement tracking.
- `DITTO_TEST_MODE` suppresses publishing (same pattern as Brief 133 DM suppression).

## Provenance

- **Unipile Posts API:** `unipile-node-sdk` `UsersResource.createPost()` — depend level. Already using Unipile for messaging (Brief 133).
- **X API v2:** Official REST API (`api.x.com/2/tweets`) — depend level. Pay-per-use, no SDK dependency (direct fetch calls).
- **ChannelAdapter pattern:** `src/engine/channel.ts` — adopt. `publishPost()` follows the same pattern as `sendAndRecord()`.

## Consequences

- **Easier:** Both channels publish automatically after GATE approval. No manual copy-paste. No Buffer account/OAuth to manage.
- **Easier:** LinkedIn uses the same Unipile connection already set up for DMs — zero additional setup.
- **Harder:** X API requires a separate developer account and API keys (one-time setup).
- **Cost:** X API ~$1-2/month at typical volume. Negligible.
- **Constraint:** LinkedIn articles (long-form) are NOT supported by Unipile Posts API — feed posts only.
- **Constraint:** Unipile's X integration is deprecated — X must use its own API. Two different APIs for two platforms.
- **Follow-up:** If multi-user X posting is needed later, migrate from OAuth 1.0a to OAuth 2.0 with PKCE.
- **Follow-up:** Buffer could be added later for scheduling/analytics if needed, but is no longer required for basic publishing.
