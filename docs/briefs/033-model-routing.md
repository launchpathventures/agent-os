# Brief: Model Routing Intelligence — Self Learns Optimal Models

**Date:** 2026-03-23
**Status:** ready
**Depends on:** Brief 032 (LLM Provider Extensibility — multi-provider llm.ts)
**Unlocks:** Cost-optimized execution, per-role model specialization, Self as intelligent resource allocator

## Goal

- **Roadmap phase:** Agent Layer (L2) + Learning Layer (L5) + Cognitive Architecture (ADR-014)
- **Capabilities:** Step-level model hints in process definitions, model tracking in feedback/trust data, Self recommends optimal model routing

## Context

Brief 032 makes Ditto provider-agnostic — the user configures one provider and model. But all roles use the same model. In practice:

- PM triage works fine on a fast/cheap model (Haiku, GPT-4o-mini)
- Builder benefits from the most capable model (Opus, GPT-4o)
- Researcher needs good reasoning but not code tools (Sonnet is fine)
- The Self should be conversational and fast (Haiku or equivalent)

The trust system already tracks quality per process/role (approval rate, correction rate, edit severity). If we record which model produced each output, the system can learn: "PM with Haiku has 93% approval rate at 1/20th the cost of PM with Opus."

This is ADR-014's cognitive architecture applied to model selection — the Self as an executive function that learns resource allocation.

### Three levels of model configuration (from Insight-062)

1. **User configures default** at deployment time (Brief 032) ✓
2. **Process definitions declare hints** — this brief
3. **Self learns optimal routing** — this brief

## Objective

Process steps can declare model capability hints. The trust system tracks model alongside quality. The Self recommends model changes based on accumulated evidence. The human approves.

## Non-Goals

- Auto-switching models without human approval — the human always decides
- Multi-provider per deployment (e.g., Claude for some roles, OpenAI for others) — deferred; requires multiple API keys configured simultaneously. Re-entry: when single-provider proves limiting
- Streaming / real-time model switching during a step — atomic per step
- Model fine-tuning or training — Ditto uses models as-is
- Benchmarking framework — learns from production use, not synthetic tests

## Inputs

1. `src/engine/llm.ts` — multi-provider implementation (Brief 032)
2. `src/db/schema.ts` — stepRuns table (where model data would be recorded)
3. `src/engine/harness-handlers/feedback-recorder.ts` — feedback recording
4. `src/engine/trust.ts` — trust computation (sliding window, approval rates)
5. `docs/adrs/014-agent-cognitive-architecture.md` — cognitive architecture (executive function, adaptive scaffolding)
6. `docs/adrs/012-context-engineering-model-routing.md` — LLM abstraction decisions

## Constraints

- MUST NOT auto-switch models — Self recommends, human approves
- MUST NOT require multiple providers configured — model routing works within a single provider's model family (e.g., Opus vs Sonnet vs Haiku, or GPT-4o vs GPT-4o-mini)
- MUST be backward compatible — steps without model hints use the deployment default
- MUST record model on every step run for learning (even before recommendations are active)
- Model hints are HINTS, not mandates — the system resolves to the closest available model

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Capability-based model hints | ADR-017 Section 2 (runtime resolution) | Process defines what it needs, system resolves how |
| Learning from production data | ADR-014 Phase B1 (approach-outcome correlation) | Same pattern: which configuration produces best results per domain |
| Trust-driven recommendations | Existing trust earning algorithm (ADR-007) | Sliding window, approval rates, evidence-based tier changes. Apply to model selection |
| Human-approved changes | Existing trust tier change pattern | System suggests, human approves. Never auto-change |
| Adaptive scaffolding | ADR-014 (Bernstein 2025, Prompting Inversion) | Match scaffolding depth to task. Match model capability to task |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/db/schema.ts` | **Modify:** Add `model` field to `stepRuns` table. Records which model executed each step |
| `src/engine/llm.ts` | **Modify:** `createCompletion()` records model on response. Add `resolveModel(hint, default)` function |
| Process YAML schema | **Modify:** Optional `config.model_hint` field on steps: `fast`, `capable`, `default` |
| `src/engine/process-loader.ts` | **Modify:** Validate `model_hint` values during YAML loading |
| `src/engine/harness-handlers/step-execution.ts` | **Modify:** Pass resolved model to adapter based on step's `model_hint` |
| `src/engine/harness-handlers/feedback-recorder.ts` | **Modify:** Record model alongside feedback data |
| `src/engine/model-routing.ts` | **Create:** Model routing logic: hint resolution, recommendation generation from trust data |
| `src/engine/model-routing.test.ts` | **Create:** Tests for hint resolution and recommendation generation |

## Design

### 1. Model hints on process steps

```yaml
steps:
  - id: pm-execute
    executor: ai-agent
    agent_role: pm
    config:
      role_contract: .claude/commands/dev-pm.md
      tools: read-only
      model_hint: fast        # PM doesn't need the most capable model
```

Three hint levels:

| Hint | Meaning | Resolution example (Anthropic) | Resolution example (OpenAI) |
|------|---------|-------------------------------|----------------------------|
| `fast` | Optimize for speed and cost. Good enough for triage, classification, simple reasoning | `claude-haiku-4-5` | `gpt-4o-mini` |
| `capable` | Use the most capable model. Complex reasoning, code generation, architectural decisions | `claude-opus-4-6` | `gpt-4o` |
| `default` (or omitted) | Use the deployment default (`LLM_MODEL`) | Whatever user configured | Whatever user configured |

### 2. Hint resolution

```typescript
// model-routing.ts
export function resolveModel(hint: string | undefined, provider: string): string {
  const defaultModel = process.env.LLM_MODEL!;  // guaranteed set by Brief 032

  if (!hint || hint === "default") return defaultModel;

  // Provider-specific model families
  const families: Record<string, Record<string, string>> = {
    anthropic: {
      fast: "claude-haiku-4-5-20251001",
      capable: "claude-opus-4-6",
    },
    openai: {
      fast: "gpt-4o-mini",
      capable: "gpt-4o",
    },
    ollama: {
      // Ollama: user has specific models pulled. Can't assume availability.
      // Fall back to default for all hints.
      fast: defaultModel,
      capable: defaultModel,
    },
  };

  return families[provider]?.[hint] || defaultModel;
}
```

For Ollama, hints resolve to the default because we can't know which models the user has pulled. The user can override by setting specific models in config.

### 3. Model recording on step runs

`stepRuns` table gains a `model` text field:

```typescript
model: text("model"),  // e.g., "claude-sonnet-4-6", "gpt-4o-mini"
```

The feedback recorder already captures per-step data. Adding model is one field.

### 4. Recommendation generation (Self learns)

After accumulating data (20+ runs per role), the system can analyze:

```typescript
// model-routing.ts
export async function generateModelRecommendations(): Promise<ModelRecommendation[]> {
  // For each role/process with 20+ runs:
  // 1. Group step runs by model
  // 2. Calculate approval rate, correction rate, edit severity per model
  // 3. Calculate cost per model
  // 4. If a cheaper/faster model has comparable quality (within 5% approval rate):
  //    → Recommend switching to the cheaper model
  // 5. If a more capable model has significantly higher quality (>10% approval rate):
  //    → Recommend switching to the more capable model
  // Returns recommendations for human review
}
```

The Self surfaces these recommendations during daily brief or when asked about optimization:

> "PM role has been running on claude-sonnet-4-6 with 95% approval rate at $0.03/call.
> claude-haiku has 92% approval rate at $0.002/call — 15x cheaper with comparable quality.
> Want me to switch PM to Haiku?"

The human approves or declines. Approved changes update the process YAML's `model_hint` or a runtime override table.

### 5. Default role hints (initial)

| Role | Suggested hint | Rationale |
|------|---------------|-----------|
| PM | `fast` | Triage and sequencing is straightforward reasoning |
| Researcher | `default` | Needs good reasoning for synthesis |
| Designer | `default` | UX reasoning benefits from strong model |
| Architect | `capable` | Complex structural decisions, brief writing |
| Builder | `capable` | Code generation benefits from best model |
| Reviewer | `default` | Code review needs good reasoning |
| Documenter | `fast` | State updates and changelog are routine |

These are starting points. The system learns from there.

## User Experience

- **Jobs affected:** Orient (model routing recommendations in daily brief), Decide (approve model changes)
- **Primitives involved:** Daily Brief (recommendations surface here)
- **Process-owner perspective:** The user initially configures one model. Over time, Ditto learns which roles work well on cheaper/faster models and recommends changes. The user approves. Cost goes down, speed goes up, quality stays the same. The system gets smarter about resource allocation.
- **Interaction states:** N/A — recommendations are conversational (via Self)
- **Designer input:** Not invoked — recommendations are conversational text, not UI primitives.

## Acceptance Criteria

1. [ ] `stepRuns` table has `model` field recording which model executed each step
2. [ ] Process YAML supports optional `config.model_hint` field (`fast`, `capable`, `default`)
3. [ ] Process loader validates `model_hint` values
4. [ ] `resolveModel()` correctly maps hints to provider-specific models for Anthropic, OpenAI, Ollama
5. [ ] Steps without `model_hint` use the deployment default (backward compatible)
6. [ ] Feedback recorder stores model alongside step run data
7. [ ] `generateModelRecommendations()` produces recommendations from accumulated data (20+ runs threshold)
8. [ ] Recommendations include: current model, suggested model, quality comparison, cost comparison
9. [ ] No auto-switching — recommendations are advisory only
10. [ ] `pnpm test` passes, `pnpm run type-check` produces 0 errors

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - Model hints are truly optional (no breakage for existing processes)
   - Recommendation logic is sound (threshold-based, evidence-driven)
   - No auto-switching anywhere (human approves all changes)
   - Trust data integrity preserved (model field doesn't break existing trust computation)
   - Hint resolution is extensible (new providers can add model families)

## Smoke Test

```bash
# 1. Run with model hints
# Edit dev-pm-standalone.yaml to add config.model_hint: fast
pnpm run dev-bot

# 2. Send: "what should we work on?"
# Expected: PM executes on the fast model (e.g., Haiku)
# Expected: stepRun record includes model: "claude-haiku-4-5-20251001"

# 3. After 20+ PM runs:
# Call generateModelRecommendations()
# Expected: recommendation comparing fast model quality vs default model quality

# 4. Verify backward compatibility:
# Process without model_hint uses deployment default
pnpm cli start --process dev-pipeline
# Expected: uses LLM_MODEL from env
```

## After Completion

1. Update `docs/state.md` — model routing intelligence active
2. Update `docs/roadmap.md` — Cognitive Architecture section: model routing as done
3. Update `docs/architecture.md` — Layer 2: model hint resolution, Layer 5: model tracking in feedback
4. Update ADR-012 with model routing implementation details
5. Retrospective: model quality comparison, cost impact, recommendation accuracy
