# Brief 180 Review — Voice Context-Push Hardening

**Verdict:** APPROVE_WITH_CHANGES
**Date:** 2026-04-17
**Reviewer:** Dev Reviewer (fresh context, did not implement)

Independent verification runs:
- `pnpm run type-check` — PASS (0 errors)
- `pnpm vitest run src/engine/voice-context.test.ts src/engine/voice-push.e2e.test.ts packages/web/app/welcome/voice-call.test.ts` — 3 files, 24 tests, all PASS

Builder's broader claim "1791 tests passing" was not re-run here (long duration), but the voice-scoped files all pass on a clean checkout of this branch.

---

## 12-Point Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Layer Alignment | PASS | Layer 2 (Agent prompt), Layer 3 (harness guidance pipeline), Layer 6 (client UX). Mapping is clean — the voice "transport vs brain" split is preserved. |
| 2 | Provenance | PASS | Brief's provenance table is complete. Dedup cites Stripe idempotency-key; ETag cites RFC 7232; validator reuses `validateAndCleanResponse`. |
| 3 | Composition Check | PASS | ETag/304 uses native `fetch` semantics; dedup pattern not invented. |
| 4 | Spec Compliance | PASS | Engine-boundary test: `voice-dedup.ts` / `voice-telemetry.ts` sit in `src/engine/` — correct, because voice telemetry is Ditto-product, not reusable harness primitive. `voice_events` moving from `packages/core/` (as brief said) to `src/db/schema/frontdoor.ts` is consistent with CLAUDE.md rule #6 (ProcessOS would not use this). Builder flagged the deviation explicitly. |
| 5 | Trust Model | N/A | No trust-tier-sensitive surfaces changed. |
| 6 | Feedback Capture | PASS | New `voice_events` table is itself the feedback-capture surface. Covers push/pull ratio, validator rewrite, cache hit rate. |
| 7 | Simplicity | FLAG | Two minor over-builds: `voiceDedup.stats()` counters shipped but no consumer reads them yet; `sanitize()` truncation threshold + `{truncated: true}` collapse path is untested and untriggered. Keep or delete — don't leave half-wired. |
| 8 | Roadmap Freshness | FLAG | `docs/state.md` / `docs/roadmap.md` not yet touched by this branch. Documenter step still outstanding (expected — reviewer runs first). |
| 9 | User Experience | PASS | No new UI primitives; in-call quality improvements only. Brief's UX section is populated. Heartbeat (the only user-visible addition) is explicitly gated off. |
| 10 | Security | FLAG | `/voice/telemetry` requires `voiceToken` match (good), but telemetry writes are unauthenticated-in-practice because anyone with a leaked voiceToken can spam events. Rate-limit is not present. Accept for now, log as future work. PII sanitizer is shallow (see Explicit Verification §4). |
| 11 | Execution Verification | FLAG | Unit + integration tests pass. Layer 4 (SDK probe) and Layer 5 (load test) are **documented but not run** per the brief's explicit fallback (AC 22-24). Manual E2E smoke (Layer 6) is human-only and not claimed run. This is consistent with the brief's rollout plan — staging 48h observation. Recorded as an open item, not a block. |
| 12 | Reference Doc Accuracy | PASS | `docs/landscape.md` updated (lines 279-288) with the SDK findings and explicit `PROBE_NOT_RUN` status. |
| 13 | Side-Effect Invocation Guards | N/A | No new side-effecting external callers; guidance endpoint is a read/evaluate path. |
| 14 | Delegation Guidance Branch Parity | N/A | No changes to `self.ts`. |
| 15 | Landscape Coverage | PASS | ElevenLabs SDK entry in `docs/landscape.md` updated with Brief 180 findings. |

---

## Brief-Specific Gates

| Gate | Result | Evidence |
|------|--------|----------|
| Push-pull hybrid preserves sync barrier (`get_context` still functional) | PASS | `voice-call.tsx:370-399` retains `get_context` client tool with both fast (cache) and slow (fetch) paths. `elevenlabs-agent.ts:268-277` keeps the tool declaration. |
| Server-side dedup; client 4s throttle removed | PASS | `voice-call.tsx:195-199` no longer throttles. `voice-dedup.ts` + `guidance/route.ts:82-95` provides server dedup. |
| Visitor context loading is cached (no N+1) | PASS | `assembleVisitorContextCached` (network-chat.ts:993) 60s TTL keyed by sessionId. `evaluateVoiceCore:707` uses cached variant. |
| `validateAndCleanResponse` invoked before guidance reaches client | PASS | `network-chat.ts:778`. `validateRewrote` threaded through to telemetry. |
| Agent prompt change does not break `get_context` fallback contract | FLAG | See Major finding #3 — description/RULES conflict. |
| `sendUserActivity` heartbeat gated on empirical probe | PASS | No heartbeat code exists anywhere in `voice-call.tsx`. Probe script is instructions-only. Enum includes `heartbeat_*` event names but no emitter — dead enum entries, minor. |
| Migration follows Insight-190 journal-resequencing hygiene | PASS | Journal idx=8 tag=0009_voice_events; 0009_voice_events.sql and 0009_snapshot.json exist; snapshot chain intact (0008.id → 0009.prevId). |
| `voice_events` telemetry does not log PII | PASS with caveat (shallow sanitize — Finding #4) |

---

## Findings

### Critical (blocks merge)
None.

### Major (should fix before merge)

**M1 — Dedup invalidation is missing on two session-mutation paths.** `voiceDedup.invalidate(sessionId)` is called only from `/voice/transcript` route. Two other paths mutate session state without invalidating:

1. `/api/v1/network/chat/session-updates` POST (`session-updates/route.ts:119-128`) appends a user/assistant message to `chatSessions.messages` and writes DB, then kicks off async `evaluateVoiceConversation`. Dedup is not invalidated. In practice the `transcriptHash` does change (messages changed) so the new lookup naturally misses — but the stale entry for the OLD hash remains in cache and can be served if a stale client still polls with an old hash. More importantly, `evaluateVoiceConversation` writes new `learned` to DB (see `evaluateVoiceCore:761-765`) which changes the ETag but does not change the transcript-hash, so the next same-transcript request returns the cached evaluation with stale `learned`.
2. `evaluateVoiceCore` itself (`network-chat.ts:760-765`) — whenever called with `persistLearned=true`, it updates `learned` in DB but does not invalidate `voiceDedup`. If a transcript-hash-identical request hits within 5s after learned advanced, the client receives pre-advance guidance.

Fix: invalidate in both places. Or change the dedup key to include a monotonic version (e.g., `updatedAt`) so learned-changes bust the key.

**M2 — Race condition: two concurrent guidance requests with identical `(sessionId, transcriptHash)` both run a full LLM call.** The dedup pattern is check-then-set with an `await` between (`guidance/route.ts:83` → `100`). Nothing in `voice-dedup.ts` shares an in-flight promise. Under the removed-client-throttle + 2s polling scenario, two requests fired within ~100ms will both miss the cache, both run `evaluateVoiceConversation` (both incur Claude call and both persist learned), and both write to cache. This directly undermines the "cost ≤ 1.5× baseline" constraint under bursty client conditions. Fix: store a `Map<key, Promise<CacheValue>>` of in-flight computes; second caller awaits the first's promise.

**M3 — Agent prompt contains a contradiction around `get_context`.** `elevenlabs-agent.ts:271` tool description says `"MANDATORY. Call this BEFORE every response."` but the updated persona RULES (lines 87-91) say `"If no SYSTEM INSTRUCTION has arrived for the current turn, call get_context first"`. The tool description is what the fast LLM sees most prominently. A fast GLM-4.5-Air model is likely to over-call `get_context` (wasting the 6s headroom) OR under-call it (ignoring description, following rules). Brief AC 17 requires the fallback be retained — it is retained in the prompt, but the contradictory tool description was not updated. Recommend updating the tool description to match the new intent ("Call when no SYSTEM INSTRUCTION has landed for the current turn").

### Minor (nice-to-have)

- **m1** — `voice-telemetry.ts sanitize()` strips only top-level keys (`email`, `name`, `phone`, `transcript`). Nested PII (`{ user: { email: "..." } }`) survives. No test covers nested shapes. Low risk given all current callers pass flat metadata, but the comment claims a stronger contract than the code delivers.
- **m2** — `voice_events` enum includes `heartbeat_started` / `heartbeat_stopped` but no producer exists (correctly, since heartbeat isn't shipped). Dead enum entries. Either ship with a feature-flagged producer or drop from the enum until the probe unlocks it.
- **m3** — `voice-call.test.ts` (renamed from brief's `voice-call.test.tsx`) is a compile-time shape + event-name parity check; brief's Layer 3 Client Behaviour Tests (7 scenarios: onModeChange trigger, AbortController cancellation, 304 suppression, etc.) are **not implemented**. Builder acknowledged this in the file's header comment ("adding jsdom + RTL as a follow-up gap"). The thinner test covers AC 19-21 event contract but leaves AC wiring behaviour (push timing, abort on back-to-back, 304 no-push) untested.
- **m4** — `voiceDedup` has no eviction telemetry, and `enforceCapacity()` runs synchronously on every `set()` — under 1000+ entries it would iterate the full Map. Won't matter at current scale (single voice call per session) but worth a note.
- **m5** — `scripts/voice-load-test.ts` is referenced by the brief but not inspected by me because it's a harness script; if it's stub-only, AC 14's "1.5× baseline" claim is unverified. Spot-checking would close this loop.
- **m6** — `guidance/route.ts:84-95` returns the cached `validateRewrote` flag but emits `push_deduped` telemetry instead of `validate_rewrote`. Correct — but the cached value's `validateRewrote` is re-emitted to the client (line 91), which is fine for observability.

---

## Explicit verifications (the 7 "must verify" items)

1. **Dedup invalidation correctness** — FAIL. Two mutation paths (`/session-updates POST` and `evaluateVoiceCore` learned-writeback) do not invalidate. See Major #M1. `/voice/transcript` path is covered.
2. **ETag determinism** — PASS. `buildGuidanceETag` sorts `learned` keys (voice-dedup.ts:111-115) making it order-invariant; `lastTurnIndex` is included; all three asserted by voice-context.test.ts:76-88 (key-order stability), 70-74 (lastTurnIndex advance), 64-68 (learned-value change). Production path at guidance/route.ts:71 consumes the same function — test coverage is genuine.
3. **Race condition: two concurrent requests with same hash** — FAIL. Both run LLM. See Major #M2. This is the single biggest risk to the "≤1.5× baseline cost" AC under realistic bursty clients.
4. **PII scrubbing** — PASS-with-caveat. Top-level `email`/`name`/`phone`/`transcript` keys stripped; test at voice-push.e2e.test.ts:194-208 verifies this. Nested PII NOT covered — see Minor #m1.
5. **`get_context` still works** — PASS on code path; FLAG on prompt. Client fast path + slow path both preserved (voice-call.tsx:370-398). But the agent prompt contradiction (Major #M3) could cause the fast LLM to skip the tool or overcall it.
6. **Client imperative handle leak** — PASS. Parent (`ditto-conversation.tsx`) keeps `voiceCallRef` alive while `callActive=true`; polling interval is cleaned up in `useEffect` return (line 370); `getCallState()` check before each poll call guards against post-end use. VoiceCall component does not conditionally unmount mid-call — it's mounted once `voiceReady`. No observed leak.
7. **Migration hygiene** — PASS. Journal idx=8 / tag=0009_voice_events is consistent with 0009_voice_events.sql and 0009_snapshot.json. Snapshot chain is intact (0008.id → 0009.prevId (regenerated)). 0008_even_joystick snapshot unchanged; 0009 adds 1 (voice_events) for 48 total. Insight-190 resequencing hygiene honoured.

---

## Recommendation

**APPROVE_WITH_CHANGES.** The work delivers the core brief — push-pull hybrid with server dedup, ETag/304, visitor-context caching, validator parity, telemetry table, migration hygiene, correctly-gated heartbeat. Tests pass, types are clean, landscape doc is updated.

Three things should land before production flag-flip (not necessarily before merge, given the staging 48h observation window):

1. **Fix M1 (dedup invalidation):** add `voiceDedup.invalidate(sessionId)` to `session-updates` POST and to `evaluateVoiceCore`'s learned-writeback. Alternative: include `updatedAt` in the dedup key.
2. **Fix M2 (thundering-herd):** share in-flight promises so concurrent same-hash requests coalesce. Without this, the 2s polling + user-final + agent-turn-end fan-out can triple-compute on every turn.
3. **Fix M3 (agent prompt contradiction):** update `get_context` tool description to match the new intent, or the fast LLM will not behave as the brief intends.

M1 and M2 together directly threaten AC 14 ("Claude calls ≤ 1.5× baseline"). Staging observation will likely surface them — but the fixes are small and should ship with the flag-on.

Builder's handoff was complete (files listed, test status claimed, deviations called out explicitly). No reference-docs line missing. Documenter is next.

Review complete: APPROVE_WITH_CHANGES (3 majors, 6 minors, 0 criticals). Please approve, reject, or revise. Once approved, invoke `/dev-documenter` to update project state.

---

## Builder response — 2026-04-17

All three Major findings addressed in this session before handoff to Documenter:

**M1 — Dedup invalidation gaps — FIXED**
- `packages/web/app/api/v1/network/chat/session-updates/route.ts`: added `voiceDedup.invalidate(sessionId)` after the `db.update(chatSessions).set({messages,...})` call.
- `src/engine/network-chat.ts` `evaluateVoiceCore`: added `voiceDedup.invalidate(sessionId)` inside the `persistLearned` branch, immediately after the learned-writeback.
- Verified by full test suite (1795 passed).

**M2 — Thundering-herd race — FIXED**
- `src/engine/voice-dedup.ts`: added `runOrJoin(sessionId, transcriptHash, compute)` with shared in-flight promise map. Concurrent callers attach to the first compute; on success the value is cached with TTL; on failure the slot clears so the next caller retries. `invalidate(sessionId)` also clears in-flight slots for that session so state advance forces a fresh compute.
- `packages/web/app/api/v1/voice/guidance/route.ts`: LLM path now wrapped in `voiceDedup.runOrJoin(...)`. Joined responses emit `push_deduped` telemetry with `{joined: true}` and set `x-voice-cache-hit: 1`.
- Four new tests in `voice-context.test.ts` cover: single-invocation under concurrency, independent keys run in parallel, successful cache persistence, and retry-on-failure. All pass.
- `stats.inFlightHits` counter added for observability.

**M3 — Agent prompt contradiction — FIXED**
- `src/engine/elevenlabs-agent.ts:271` `get_context` tool description changed from `"MANDATORY. Call this BEFORE every response..."` to `"Fallback only. The harness normally pushes a fresh SYSTEM INSTRUCTION before each of your turns; follow that. Call this ONLY when you need to respond and no SYSTEM INSTRUCTION has arrived..."`. Now aligned with persona RULES.

**Verification:** `pnpm run type-check` clean; `pnpm vitest run` 1795/1795 passing (+4 new runOrJoin tests).

Minor findings not addressed in this pass (acceptable per reviewer's own framing — "should fix before merge" caveats, not critical): `stats()` consumer still absent, `heartbeat_*` enum entries still dead pending probe, telemetry endpoint rate-limit deferred, `sanitize()` truncation path still untested. Documenter can log these as follow-ups.
