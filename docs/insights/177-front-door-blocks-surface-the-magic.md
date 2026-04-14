---
id: "177"
title: Front Door Blocks — Surface the Magic
date: 2026-04-13
status: active
layer: L6 Human
triggers: front door analysis of connector mode differentiation
---

## Insight

The front door has 22 content block types fully built and rendered in the workspace, but the front door conversation uses none of them. The SSE contract (`ChatStreamEvent`) only supports `text-delta`, `text-replace`, `metadata`, and `status` — there's no event type for content blocks. The front door component (`ditto-conversation.tsx`) imports only `ChatMessage`, `QuickReplyPills`, and `TypingIndicator`. The block registry (`block-registry.tsx`) and all 22 block renderers exist but are unreachable from the front door.

Meanwhile, the workspace Self stream (`SelfStreamEvent` in `self-stream.ts`) already has a `{ type: "content-block"; block: ContentBlock }` event type and emits blocks via `toolResultToContentBlocks`. The front door just needs the same pattern.

## Why This Matters

The architecture spec (Insight-107) says: "ALL rendering flows through ContentBlocks. No bespoke viewers." The front door violates this principle — it's a bespoke text-only chat surface. Extending blocks to the front door is not an addition to the architecture; it's aligning the front door with the existing design rule.

For connector mode specifically, the front door should demonstrate Alex's judgment visually:
1. **ProcessProposalBlock** when Alex proposes a connecting approach
2. **RecordBlock** when Alex shows a draft introduction with reasoning
3. **ReasoningTraceBlock** when Alex evaluates litmus tests
4. **AlertBlock** when Alex declines and explains why

## Principle

**The front door should speak the same visual language as the workspace.** Blocks aren't a workspace luxury — they're the mechanism by which Alex demonstrates judgment. "Text is narrative, blocks are evidence" (Brief 069) applies even more at the front door, where the user has zero prior context.
