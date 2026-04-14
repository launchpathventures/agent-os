# Insight-180: Spike Test Every New External API Before Wiring

**Date:** 2026-04-14
**Trigger:** Two P0s caught in dev-review: Anthropic image gen API call had wrong model ID + missing beta header; X media upload had incorrect OAuth signature for form-encoded body.
**Layers affected:** L2 Agent (tool execution), Dev Process
**Status:** active

## The Insight

Type-checking catches structural errors. It does NOT catch API format errors — wrong model IDs, missing headers, incorrect OAuth signing, wrong Content-Type for specific endpoints. These only surface at runtime, usually after the feature is "complete" and the builder has moved on.

The fix: every brief that adds a new external API integration MUST include a spike test that makes one real API call. Not a mock. Not a type check. A real authenticated request that verifies:
1. Auth format is accepted (OAuth signature, API key header, bearer token)
2. Endpoint URL returns 200 (not 404, not 405)
3. Response shape matches what the code parses

The spike test lives in `src/engine/integration-spike.test.ts`, skipped when credentials are absent, run manually before wiring the tool.

## Implications

- Brief template updated with spike test guidance in Smoke Test section
- `integration-spike.test.ts` is the canonical location for all API connectivity verification
- Builder should run spike BEFORE implementing the tool resolver entry — not after
- Dev-reviewer should check for spike test evidence when reviewing new API integrations

## Where It Should Land

Absorbed into `docs/briefs/000-template.md` (Smoke Test section) and `docs/dev-process.md` (Builder constraints).
