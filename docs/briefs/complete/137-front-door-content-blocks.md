# Brief: Front Door Content Blocks — Surface the Magic

**Date:** 2026-04-13
**Status:** draft
**Depends on:** Brief 094 (Conversational Home Page — complete), Brief 069 (Rich Block Emission — complete), Brief 093 (Front Door Chat API — complete)
**Unlocks:** Connector mode visual differentiation, front door alignment with Insight-107

## Goal

- **Roadmap phase:** Phase 14: Network Agent
- **Capabilities:** Content block rendering in the front door conversation, replacing the bespoke plan card with the architecture's universal ContentBlock system (Insight-107)
- **Engine scope:** Product. Blocks and types are already in `@ditto/core`. This work is in `src/engine/network-chat.ts` (SSE contract + block construction) and `packages/web/app/welcome/` (rendering).

## Context

Insight-177: The front door has zero access to the content block system. The architecture spec says "ALL rendering flows through ContentBlocks. No bespoke viewers." (Insight-107). The front door violates this in two ways:

1. **No block rendering infrastructure.** The SSE contract (`ChatStreamEvent`) supports only text/metadata events. `ditto-conversation.tsx` renders only `ChatMessage` text bubbles.
2. **A bespoke plan card already exists.** `chat-message.tsx` (lines 100-124) hand-renders a styled "Proposed approach" card by splitting the `plan` field from Alex's reply text. This is exactly what a `ProcessProposalBlock` would do, but wired outside the block system.

The workspace already has the pattern we need. `SelfStreamEvent` in `self-stream.ts` includes `{ type: "content-block"; block: ContentBlock }` and emits blocks via the proven `toolResultToContentBlocks` function. The front door needs the same event type, and the existing plan card should be replaced by a proper block.

### Data already available

The LLM already emits structured data via the `alex_response` tool call:
- **`plan: string | null`** — the plan/approach text, extracted by the frontend and rendered in a bespoke card
- **`detectedMode: DetectedMode`** — "connector" | "sales" | "cos" | "both" | null
- **`learned: LearnedContext`** — `{ name, business, role, industry, location, target, problem, channel }`
- **`searchQuery / fetchUrl`** — enrichment triggers that produce search results

The enrichment loop produces search results as a plain text string (from `webSearch()`) that gets injected into the conversation as `[SEARCH_RESULTS]`. The LLM then produces a refined reply incorporating the results.

The conversation stage is inferred by `inferConversationStage(session)` → `"gather" | "reflect" | "activate"`.

## Objective

Content blocks appear inline in the front door conversation, replacing the bespoke plan card and adding structured evidence blocks at key moments. Blocks are deterministically constructed from the data shapes above — the LLM does not choose blocks (Brief 069 principle: "parse, don't invent").

## Non-Goals

- **No new block types.** The existing 22 types are sufficient.
- **No changes to block renderer components.** The workspace renderers are reused as-is.
- **No LLM prompt changes.** The `plan` field, `detectedMode`, and `learned` context already flow. Blocks are constructed from this existing data.
- **No interactive blocks.** Block actions (approve/reject/edit) require workspace context. Front door blocks are display-only.
- **No changes to `self-stream.ts` or workspace block emission.**
- **No changes to `@ditto/core` content-blocks.ts.**
- **No `ReasoningTraceBlock` in this brief.** The three litmus tests are evaluated by the LLM internally — there's no structured data output from the enrichment loop that represents individual test results. Constructing a ReasoningTraceBlock would require either LLM prompt changes (non-goal) or fabricating assessment text (violates Brief 069 "parse, don't invent"). Deferred to a follow-up once the LLM emits structured litmus test evaluations.

## Inputs

1. `src/engine/network-chat.ts` — `ChatStreamEvent` (line 1037), `handleChatTurnStreaming` (line 1051), `AlexToolArgs` (line 45), `LearnedContext` (line 34), `ChatSession` (line 458), `inferConversationStage` (line 373), enrichment loop (line 1205+)
2. `src/engine/self-stream.ts` — `SelfStreamEvent` with `content-block` event (line 51). Reference implementation.
3. `packages/web/app/welcome/ditto-conversation.tsx` — Frontend, SSE parser, `plan` state (line 72)
4. `packages/web/app/welcome/chat-message.tsx` — Bespoke plan card (lines 100-124) to be replaced
5. `packages/web/components/blocks/block-registry.tsx` — `BlockRenderer` (22 types)
6. `packages/web/components/blocks/process-proposal-block.tsx` — The specific renderer that replaces the bespoke plan card
7. `packages/core/src/content-blocks.ts` — `ProcessProposalBlock`, `RecordBlock` type definitions
8. `src/engine/network-chat-prompt.ts` — Conversation stages, `plan` field definition (line 86)
9. `docs/insights/177-front-door-blocks-surface-the-magic.md` — Triggering insight
10. `docs/architecture.md` — Rendering Architecture section (line 697), Insight-107

## Constraints

- **Follow the workspace SSE pattern exactly.** Same event shape: `{ type: "content-block"; block: ContentBlock }`.
- **Deterministic block emission.** Pure function: `(plan, detectedMode, learned, stage, enrichmentText) → ContentBlock[]`. No LLM calls, no DB access, no side effects.
- **Replace the bespoke plan card, don't add alongside.** Remove the `splitAroundPlan` logic and hand-rendered plan card from `chat-message.tsx`. The `plan` text now constructs a `ProcessProposalBlock` in the backend and arrives as a `content-block` SSE event.
- **One to two blocks per message maximum.** Front door is lightweight.
- **Blocks arrive atomically after text.** After `text-replace` (enrichment) or streaming completion, before `metadata` and `done`. Preserves Insight-110.
- **Front door blocks are read-only.** No `onAction` handler wired.
- **Block emission is stage-gated.** GATHER stage = no blocks. Blocks from REFLECT onward.
- **All data in blocks is already in the conversation.** The `plan` text is already in Alex's reply. The `learned` context is derived from conversation. Search results drive Alex's text response. No new data exposure via blocks.
- **Returning visitors see no blocks.** The "Hey again" greeting path (email in localStorage) bypasses the streaming API entirely — messages are set directly in state. No SSE, no blocks. Stage gate is also sufficient since returning visitors don't reach REFLECT.
- **Block construction failures are silent.** Catch, log, return empty array.

## Provenance

| What | Source | Level | Why this source |
|------|--------|-------|----------------|
| `content-block` SSE event | `self-stream.ts` SelfStreamEvent (line 51) | existing | Same event shape, one pattern, two surfaces |
| Deterministic block construction | `self-stream.ts` `toolResultToContentBlocks` (line 325) | pattern | Proven: pure function, data-driven, testable |
| ProcessProposalBlock for plan | `content-blocks.ts` ProcessProposalBlock type | existing | Replaces bespoke plan card with proper block |
| RecordBlock for enrichment | `content-blocks.ts` RecordBlock type | existing | Structured evidence for found targets |
| Block rendering via registry | `block-registry.tsx` BlockRenderer | existing | All 22 renderers built and themed |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/network-chat-blocks.ts` | Create: Pure module. `buildFrontDoorBlocks(args: FrontDoorBlockArgs): ContentBlock[]`. Input type: `{ plan: string \| null; detectedMode: DetectedMode; learned: LearnedContext \| null; stage: ConversationStage; enrichmentText: string \| null }`. Returns 0-2 blocks. No LLM, no DB, no side effects. |
| `src/engine/network-chat-blocks.test.ts` | Create: Unit tests. Test each stage/mode/data combination. GATHER → []. REFLECT + plan → ProcessProposalBlock. ACTIVATE + enrichment → RecordBlock. Null inputs → []. Errors → []. |
| `src/engine/network-chat.ts` | Modify: (1) Add `{ type: "content-block"; block: ContentBlock }` to `ChatStreamEvent` union. (2) Import `buildFrontDoorBlocks`. (3) In `handleChatTurnStreaming`, after enrichment loop completes and before metadata yield, call `buildFrontDoorBlocks` and yield each block as `content-block` event. Pass `plan` from `extractAlexResponse`, `enrichmentText` from enrichment loop results. |
| `packages/web/app/welcome/ditto-conversation.tsx` | Modify: (1) Import `BlockRenderer` from `@/components/blocks/block-registry` and `ContentBlock` type. (2) Extend `Message` interface: add `blocks?: ContentBlock[]`. (3) In SSE parser, handle `content-block` events — push block onto current Alex message's blocks array. (4) Remove `plan` state variable and all plan-related logic. (5) Pass `blocks` to `ChatMessage` instead of `plan`. |
| `packages/web/app/welcome/chat-message.tsx` | Modify: (1) Remove `plan` prop, `splitAroundPlan` function, and bespoke plan card rendering (lines 60-124). (2) Add `blocks?: ContentBlock[]` prop. (3) After message text, render `BlockRenderer` for each block with `animate-fade-in` and 16px top spacing. No `onAction` handler. |

## Block Emission Map

Pure function logic in `buildFrontDoorBlocks()`:

### Input Type
```typescript
interface FrontDoorBlockArgs {
  plan: string | null;           // from AlexToolArgs.plan
  detectedMode: DetectedMode;    // from AlexToolArgs.detectedMode
  learned: LearnedContext | null; // from AlexToolArgs.learned
  stage: ConversationStage;      // from inferConversationStage()
  enrichmentText: string | null; // raw text from webSearch() / fetchUrlContent()
}
```

### GATHER Stage: No blocks
Return `[]`. Alex is listening, collecting context.

### REFLECT Stage (plan present):

| Condition | Block | Construction |
|-----------|-------|-------------|
| `plan` is non-null | `ProcessProposalBlock` | Parse `plan` text into steps using line breaks or numbered list pattern. Title: "Proposed approach". Steps with `pending` status. `interactive: false`. If parsing fails, single step with full plan text. |

This replaces the bespoke plan card. The ProcessProposalBlock renderer already handles the visual — step indicators, status, etc. The plan text currently rendered as formatted markdown becomes structured steps.

### ACTIVATE Stage (after email, enrichment complete):

| Condition | Block | Construction |
|-----------|-------|-------------|
| `enrichmentText` is non-null and `detectedMode` is "connector" or "sales" | `RecordBlock` | Title: derived from `learned.target` or "Your targets". Fields populated from `learned` context: business, target, industry. Accent: "vivid". Status badge: "Researching". |

Note: The RecordBlock in ACTIVATE shows what Alex knows about the user's context — not the search results themselves (which are already in Alex's reply text). It's a structured summary card, not new data.

### Maximum: 2 blocks per response.

## User Experience

- **Jobs affected:** Orient ("what is this and how is it different?"), Capture (email driven by demonstrated value)
- **Primitives involved:** Conversation (front door), BlockRenderer (existing), ProcessProposalBlock (existing renderer)
- **Process-owner perspective:** User chats with Alex. When Alex proposes an approach, a structured ProcessProposal block appears with visible steps — replacing the current text-in-a-card with a proper process visualization. The user sees the shape of what Alex will do, rendered the same way processes appear in the workspace. If enrichment runs, a Record block summarizes what Alex knows. These blocks make the front door look and feel like a product with structure, not another chat wrapper.
- **Interaction states:**
  - During text streaming: no blocks (text flows first)
  - On block arrival: blocks fade in below message text (`animate-fade-in`)
  - Blocks are read-only: no hover actions, no approve/reject
  - Error: block construction fails silently — text-only message, user never sees broken state
  - Mobile (375px): blocks render full-width, consistent with message layout
- **Designer input:** Not invoked. Block renderers already designed (Brief 063). The ProcessProposalBlock renderer is more sophisticated than the current bespoke plan card — this is a visual upgrade for free.

## Acceptance Criteria

### SSE Contract
1. [ ] `ChatStreamEvent` union includes `{ type: "content-block"; block: ContentBlock }` — same shape as `SelfStreamEvent`
2. [ ] `content-block` events yielded after text streaming / `text-replace` and before `metadata`
3. [ ] No `content-block` events during GATHER stage

### Block Construction
4. [ ] `buildFrontDoorBlocks()` in `src/engine/network-chat-blocks.ts` — pure function matching the `FrontDoorBlockArgs` interface above
5. [ ] GATHER stage → empty array
6. [ ] REFLECT stage + non-null `plan` → `ProcessProposalBlock` with parsed steps
7. [ ] ACTIVATE stage + non-null `enrichmentText` + connector/sales mode → `RecordBlock`
8. [ ] Maximum 2 blocks per call
9. [ ] Construction errors caught → empty array + console.warn

### Frontend — Plan Card Replacement
10. [ ] Bespoke plan card removed from `chat-message.tsx` (the `splitAroundPlan` function, plan prop, and hand-rendered card at lines 100-124)
11. [ ] `chat-message.tsx` accepts `blocks?: ContentBlock[]` prop, renders via `BlockRenderer`
12. [ ] `ditto-conversation.tsx` handles `content-block` SSE events, attaches to current Alex message
13. [ ] `plan` state variable removed from `ditto-conversation.tsx`

### Integration
14. [ ] Returning visitors ("Hey again" path) see no blocks — path doesn't use SSE
15. [ ] Error fallback (API failure) does not attempt block rendering
16. [ ] All existing unit tests pass
17. [ ] `pnpm run type-check` passes

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - Does `content-block` event match workspace `SelfStreamEvent` pattern?
   - Is the bespoke plan card fully removed (no Insight-107 violation)?
   - Is block emission deterministic (data-driven, not LLM-decided)?
   - Is Insight-110 preserved (text streams, blocks arrive atomically)?
   - Security: all block data is a subset of data already in conversation text or metadata — no new exposure
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Type check
pnpm run type-check

# 2. Block construction unit tests
pnpm vitest run src/engine/network-chat-blocks.test.ts

# 3. All tests
pnpm test

# 4. Manual: pnpm dev → http://localhost:3000
# Click "I need to find the right people"
# Chat 3-4 turns (name, business, target)
# Provide email when asked
# Expected: Alex's "proposed approach" now renders as a ProcessProposalBlock
# with structured steps — NOT the old text-in-a-card

# 5. Continue — let enrichment run
# Expected: If search finds results, a RecordBlock summarizes context

# 6. Mobile (375px): blocks render full-width, no overflow

# 7. Error test: disconnect network → error fallback, no broken blocks

# 8. Returning visitor: reload page → "Hey again" with no blocks
```

## After Completion

1. Update `docs/state.md`: Brief 137 complete — front door content blocks, bespoke plan card replaced
2. Update `docs/roadmap.md` Phase 14: add "Front door content block rendering" row
3. Update `docs/architecture.md` Rendering Architecture: note front door now renders ContentBlocks (closing Insight-107 violation)
4. Follow-up consideration: structured litmus test output from the LLM (enabling ReasoningTraceBlock in a future brief)
5. Retrospective: Did replacing the plan card with ProcessProposalBlock improve the visual? Which block had most impact?
