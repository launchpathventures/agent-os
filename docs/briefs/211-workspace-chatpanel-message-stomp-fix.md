# Brief 211: Workspace ChatPanel — Streamed Messages Stomped After Stream Completes

**Date:** 2026-04-21
**Status:** draft
**Depends on:** none (regression fix; PR #35 introduced)
**Unlocks:** un-skip 10 e2e specs (`packages/web/e2e/{blocks,pipeline,planning}.spec.ts`); workspace conversation surface becomes usable; `/drain-queue` autopilot regains full e2e coverage

## Goal

- **Roadmap phase:** Cross-cutting bugfix on the redesigned workspace chat surface (PR #35 — User-Facing Apps phase consolidation)
- **Capabilities:** Restore the workspace chat conversation as a usable surface — assistant responses must remain visible after streaming finishes; message rendering must not flash and disappear

## Context

PR #35 (commit `45a383b`, merged 2026-04-21) rewrote the workspace chat surface, replacing `packages/web/components/self/prompt-input.tsx` with a new `ChatPanel` (`packages/web/components/chat/chat-panel.tsx`) backed by `useChat` from `@ai-sdk/react` plus a thread-store (`packages/web/components/chat/thread-store.ts`).

The new surface has a user-visible regression: **when the user sends a message in the workspace chat, the response renders and then immediately flashes back to a blank state**. Reproduced manually by the user (2026-04-21). The same regression breaks 10 e2e specs (currently `.skip()`-marked in `packages/web/e2e/blocks.spec.ts`, `pipeline.spec.ts`, `planning.spec.ts`) — every test that calls `ConversationPage.waitForResponse()` times out at 10s because `[data-testid="assistant-message"]` never settles in the DOM.

Server-side is healthy — `[/api/chat] Stream finished. Messages: 1` is logged for every send (CI run `24700615560`, log `test_72242842331.log`). The `/chat` page (`packages/web/app/chat/page.tsx`, used by `onboarding.spec.ts`) renders the same mock LLM responses correctly via its own `ChatConversation` component, so the mock LLM, the `/api/chat` route, and the `ai-elements/message.tsx` rendering path all work in isolation. The break is in the new workspace `useChat` + thread-store wiring.

## Objective

Stop the workspace ChatPanel from wiping streamed messages when the stream completes. Assistant responses must persist in the DOM after `loading` transitions back to false, and the e2e suite must un-skip cleanly with all 10 affected specs passing.

## Non-Goals

- Not a rewrite of `ChatPanel`, the thread store, or `useChat` integration. Surgical fix — the regression is narrow and the new surface is otherwise correct.
- Not a re-architecture of `/api/chat` or `selfConverseStream`. Server-side is healthy.
- Not adopting a different state-management pattern (Zustand, Redux, etc.). The fix lives in the existing React/useChat structure.
- Not unrelated UX polish on the workspace chat. Scope is "fix the message-stomp regression and un-skip the specs."
- Not changing what the e2e tests assert. They were correct against the prior product surface; they will be correct again once the new surface stops eating its own messages.

## Inputs

What to read before starting:

1. `packages/web/components/layout/workspace.tsx` — primary suspect. Specifically:
   - lines 124–155 (`useChat` setup, transport memoization, `id: active?.id`)
   - lines 159–166 (the `setMessages(initialMessages)` reset effect with `[active?.id, loading]` deps — **leading hypothesis: this effect re-fires when loading transitions from true to false after stream completes, calling `setMessages([])` because `initialMessages` was memoized when active was empty**)
   - lines 168–202 (persistence effect — `useEffect` that POSTs new turns back to `/api/chat/threads/[id]/messages`)
   - lines 413–420 (`sendText` callback)
2. `packages/web/components/chat/chat-panel.tsx` — consumes `messages` prop from workspace; renders via `ConversationMessage`. Verify it doesn't filter or drop messages on its own.
3. `packages/web/components/chat/thread-store.ts` — `create()` flow and how `active` populates after `threadStore.create()` resolves.
4. `packages/web/app/api/chat/route.ts` — verify `onFinish` callback is healthy; not the bug source but useful context for understanding the stream lifecycle.
5. `packages/web/app/api/chat/threads/[id]/messages/route.ts` — turn-persistence endpoint that the workspace's persistence effect targets.
6. `packages/web/components/ai-elements/message.tsx` lines 60–110 — the `Message` component with `data-testid="user-message"` / `"assistant-message"`. Returns `null` if `hasRenderableContent === false` — confirm whether streamed assistant responses ever pass that gate before being wiped.
7. `packages/web/e2e/blocks.spec.ts`, `pipeline.spec.ts`, `planning.spec.ts` — the skipped tests. The TODO blocks at the top of each describe point at this brief.
8. `packages/web/e2e/page-objects/conversation.ts` — already adapted (commit `c26829c`) to click `new-chat-button` before asserting input visibility. Should not need further changes once the rendering bug is fixed.
9. `packages/web/app/chat/page.tsx` and `packages/web/app/chat/components/chat-conversation.tsx` — the working chat surface; useful for diff-thinking ("what does this one do that the workspace one doesn't?").

## Constraints

- **Don't reintroduce the old `prompt-input.tsx` flow into the workspace.** The new `ChatPanel` is the canonical workspace chat surface per PR #35's design intent. Fix the new surface, don't revert.
- **Preserve maker-checker testid contract.** `chat-input`, `send-button`, `user-message`, `assistant-message` testids must remain on the DOM elements they currently mark. The e2e suite is the regression net.
- **Preserve the thread-persistence contract.** `useEffect` that POSTs new turns to `/api/chat/threads/[id]/messages` must continue to fire on stream completion. The fix shouldn't disable persistence to dodge the stomping.
- **No `--force`, no test rewrites that hide the regression.** If un-skipping a spec requires changing the assertion, that's a red flag — investigate whether the product is actually behaving correctly first.
- **Maker-checker:** spawn fresh-context `/dev-reviewer` after Build per the standard pipeline. The regression is subtle (timing/race in React effects) and benefits from a second pair of eyes.

## What Changes (Work Products)

| File | Action |
|------|--------|
| `packages/web/components/layout/workspace.tsx` | Modify: fix the message-reset effect so it does NOT stomp streamed messages when `loading` transitions from true to false. Leading hypothesis (Architect to confirm or refute): the effect at lines 159–166 lists `loading` in its deps — drop `loading` from the deps so the effect only fires on genuine `active?.id` changes (thread switches), not on stream-completion transitions. Alternative: track whether `initialMessages` has been refreshed post-persistence and gate the reset on that. |
| `packages/web/e2e/blocks.spec.ts` | Modify: remove the `test.describe.skip` + TODO comment (introduced commit `dd7bfde`) once the regression is fixed and the 4 specs pass locally. |
| `packages/web/e2e/pipeline.spec.ts` | Modify: same un-skip + TODO removal (3 specs). |
| `packages/web/e2e/planning.spec.ts` | Modify: same un-skip + TODO removal (3 specs). |
| `docs/state.md` | Update with regression-fix close-out per Insight-043 (PM-owned doc). |

## User Experience

- **Jobs affected:** Define + Decide + Capture (any conversational interaction in the workspace surface — every JTBD that goes through chat is currently broken)
- **Primitives involved:** Conversation surface (Layer 6 / Human Layer)
- **Process-owner perspective:** today the user types a message, sees the response render for ~1 second, then watches it disappear back to an empty conversation — corrosive trust impact, every send feels lost. After this brief: send → response appears → response stays.
- **Interaction states:**
  - empty (no messages) — should show ChatHero with starter templates ✓ already works
  - loading (in-flight stream) — assistant message renders progressively ✓ already works (visible briefly)
  - success (stream complete) — assistant message stays visible ✗ **currently broken — this is the fix**
  - error (stream fails) — assistant message shows fallback text ✓ likely works (route handler emits error text)
- **Designer input:** Not invoked — pure regression fix; visual design and interaction model are correct, the implementation has a bug.

## Acceptance Criteria

1. [ ] User sends a message in the workspace chat (via the new-chat → ChatPanel flow). Assistant response renders. **30 seconds after stream completes, the assistant message is still visible in the DOM** (no flash-to-blank).
2. [ ] `packages/web/e2e/blocks.spec.ts` — `test.describe.skip` reverted to `test.describe`. All 4 tests pass.
3. [ ] `packages/web/e2e/pipeline.spec.ts` — `test.describe.skip` reverted to `test.describe`. All 3 tests pass.
4. [ ] `packages/web/e2e/planning.spec.ts` — `test.describe.skip` reverted to `test.describe`. All 3 tests pass.
5. [ ] `packages/web/e2e/workspace.spec.ts` — all 4 tests still pass (no regression on the testid-visibility surface).
6. [ ] `packages/web/e2e/onboarding.spec.ts` — all 5 tests still pass (no regression on the `/chat` surface).
7. [ ] `pnpm run type-check` clean.
8. [ ] `pnpm test` passes (no Vitest unit-test regression).
9. [ ] Server logs unchanged: `[/api/chat] Stream finished. Messages: 1` continues to fire per send, no new errors.
10. [ ] Persistence effect still posts the new turn(s) to `/api/chat/threads/[id]/messages` (verify by sending a message, refreshing the page, confirming the turn is replayed from the server-side thread).
11. [ ] No `--force`, no test assertion changes — un-skipping reverts the `dd7bfde` skip-blocks verbatim.

## Review Process

1. Spawn `/dev-reviewer` with `docs/architecture.md` + `docs/review-checklist.md` + the diff. Specifically check:
   - Whether the fix has a clear named cause (effect deps, race condition, etc.) or is "make it work" superstition
   - Whether the persistence flow still fires
   - Whether the fix introduces a thread-switching regression (switching active threads mid-reply should still hand off cleanly)
2. Spawn `/dev-review` (the 5-pass exhaustive audit) — the change is small but timing-related; the audit catches subtle React effect bugs the architecture review might miss
3. Present work + both review reports + the smoke-test run + the un-skipped e2e suite output to human for approval

## Smoke Test

This proves the regression is fixed end-to-end.

```bash
# Setup
pnpm install
pnpm run type-check  # expect: clean

# Run the full e2e suite — all previously-skipped specs should now run AND pass
pnpm test:e2e

# Expected: 0 failures across all e2e files
# Expected: 19+ tests passing (the 17 that already passed + 10 newly un-skipped)
# Expected: blocks.spec.ts, pipeline.spec.ts, planning.spec.ts all green

# Manual reproduction
pnpm dev  # in one terminal
# Open http://localhost:3000 in a browser
# Click "New Chat" in the sidebar
# Type "hello" and press Enter
# OBSERVE: assistant response appears AND stays visible for >30 seconds
# (regression: response appears then flashes back to blank within ~1s)

# Persistence verification
# After sending "hello" and seeing the response stay:
# Refresh the page (Cmd-R)
# Click the same thread in the sidebar
# OBSERVE: both the user's "hello" and the assistant response are replayed
# from the server-side thread (proves persistence still works)
```

## Engine Core (`@ditto/core`) boundary

Pure product-layer fix. No `packages/core/` changes. The bug is in `packages/web/` React state management, not in any engine primitive.

## After Completion

1. Update `docs/state.md` with the regression-fix close-out: what was wrong (effect-deps stomp / race), what was fixed, which 10 specs un-skipped, link to PR.
2. Update `docs/roadmap.md` if any phase was implicitly blocked by this regression — the User-Facing Apps phase (Brief 209) needs a working workspace chat for sub-brief 211 (deploy/preview UX) and beyond.
3. Capture an insight if the cause turns out to be a generally-applicable React/useChat pattern bug worth flagging for future work (e.g., "React effects with `loading` in deps will re-fire on every status transition — never use this for state resets that mutate user-visible content").
4. Phase retrospective: how did this regression land in main? PR #35's CI showed "fail" on Test workflow — how did it merge? Worth tightening the merge gate per Brief 188's "no merge with red CI" implicit rule.
