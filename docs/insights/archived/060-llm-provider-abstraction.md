# Insight-060: LLM Provider Abstraction Is Overdue

**Date:** 2026-03-23
**Trigger:** External feedback flagged Anthropic coupling. Architect audit found 3 direct `new Anthropic()` call sites + 1 hardcoded `claude` CLI binary. The Conversational Self MVP will add a 4th SDK call site — the wrong moment to deepen coupling without abstracting.
**Layers affected:** L1 Process, L2 Agent
**Status:** archived — absorbed by Brief 029 (`src/engine/llm.ts`)

## The Insight

Ditto is architecturally provider-agnostic (the adapter pattern in `step-executor.ts` means process definitions pick executors, not SDKs) but implementationally Anthropic-bound. Three files instantiate `new Anthropic()` directly:

1. `src/adapters/claude.ts` — the `ai-agent` executor
2. `src/engine/system-agents/router.ts` — LLM-based work item routing
3. `src/engine/harness-handlers/review-pattern.ts` — adversarial/spec review

Plus `src/adapters/cli.ts` hardcodes `claude` as the CLI binary.

The missing piece is a thin LLM completion abstraction — a single function all call sites go through:

```
createCompletion({ model, system, messages, tools? }) → { content, tokensUsed, costCents }
```

Behind this, a provider registry maps model identifiers to SDK clients. This is what ADR-012 (model routing, cost) already envisions but hasn't implemented.

This is NOT a framework concern. It's a ~50-line wrapper with a provider lookup. The Vercel AI SDK pattern (unified interface, multiple providers) is the gold standard composition target, though the full SDK may be heavier than needed — the abstraction pattern is what matters.

## Implications

- The Conversational Self MVP's `selfConverse()` will be the 4th LLM call site. Introducing the abstraction here prevents further coupling spread.
- ADR-012 (model routing) gets a concrete implementation foundation — different steps can use different models/providers based on cost, capability, or trust tier.
- The CLI adapter's binary is already almost parameterizable (`DEFAULT_CLI` constant → env var). Same pattern applies.
- System agents (router, review-pattern) benefit most — they're internal machinery where the model choice is a cost/quality trade-off, not a user preference.
- Process definitions could gain an optional `model` or `provider` field, letting process authors specify model requirements per step.

## Where It Should Land

- Implemented as part of the next brief that adds an LLM call site (likely Conversational Self MVP or as a lightweight prerequisite)
- ADR-012 updated to reflect the concrete abstraction once built
- Existing 3 call sites migrated in the same brief (small refactor, same behaviour)
