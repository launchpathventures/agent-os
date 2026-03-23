# Brief: LLM Provider Extensibility — No Vendor Lock-In

**Date:** 2026-03-23
**Status:** ready
**Depends on:** Brief 031 (Ditto Execution Layer — all roles via ai-agent)
**Unlocks:** Brief 033 (Model Routing Intelligence), non-Claude deployments, OpenAI/Ollama users

## Goal

- **Roadmap phase:** Agent Layer (L2) + Deployment (ADR-006)
- **Capabilities:** Multi-provider `llm.ts`, no hardcoded default model, user configures provider at deployment, provider-agnostic tool_use

## Context

Brief 031 migrates all roles to `ai-agent` with Ditto's tools. But `llm.ts` currently hardcodes Anthropic as the only provider and `claude-sonnet-4-6` as the default model. This means:

- Users MUST have an Anthropic API key — no OpenAI, no Ollama, no local models
- The default model is chosen by us, not the user
- The Self, all roles, and all system agents all use the same model
- There's no path to subscription-based access (Claude CLI, etc.)

Insight-041 (absorbed) established: "Ditto's value is the harness, not the execution substrate. Users choose their preferred AI execution method." Insight-062 reinforces: "No LLM vendor should be hardcoded as the default."

The user must configure their LLM provider at deployment time. There is no default.

### Existing abstraction

`llm.ts` already has the right interface:

```typescript
interface LlmCompletionRequest {
  model?: string;
  system: string;
  messages: LlmMessage[];
  tools?: Tool[];
  maxTokens?: number;
}
```

The problem is the implementation — it only knows Anthropic. The interface is provider-agnostic; the implementation isn't.

## Objective

`llm.ts` supports Anthropic, OpenAI, and Ollama providers. The user configures their provider and model at deployment time via environment variables. There is no hardcoded default. If no provider is configured, Ditto fails with a clear setup message.

## Non-Goals

- Model routing per step/role (Brief 033) — this brief provides the multi-provider infrastructure
- Claude CLI subscription provider — deferred; requires different invocation pattern (subprocess, not API). Re-entry: when subscription cost optimization becomes a priority
- Streaming responses — deferred; not needed for harness-governed step execution
- Provider-specific advanced features (Claude's extended thinking, OpenAI's function calling nuances) — MVP uses the common subset: system prompt, messages, tools, maxTokens
- Web UI for provider configuration — env vars / config file for now
- Provider health checking / failover — single provider per deployment for MVP

## Inputs

1. `src/engine/llm.ts` — current Anthropic-only implementation
2. `docs/insights/062-ditto-owns-execution-layer.md` — no vendor lock-in principle
3. `docs/adrs/012-context-engineering-model-routing.md` — LLM abstraction decisions (if exists)
4. OpenAI SDK docs — tool_use format differences from Anthropic
5. Ollama API docs — OpenAI-compatible REST API

## Constraints

- MUST NOT have a hardcoded default model — user must configure
- MUST fail clearly on startup if no LLM provider is configured (not at first API call)
- MUST preserve the `LlmCompletionRequest` / `LlmCompletionResponse` interface — callers don't change
- MUST handle tool_use format differences internally (Anthropic format vs OpenAI format)
- MUST track cost per provider (per-token for API, $0 for subscription/local)
- MUST NOT require changes to the Self, delegation, or harness code — only `llm.ts` changes
- Tool definitions must be translated to provider format internally (Anthropic `Tool[]` → OpenAI `ChatCompletionTool[]`)

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Provider registry pattern | Vercel AI SDK `createAnthropic()` / `createOpenAI()` | Multi-provider with unified interface. Proven at scale |
| OpenAI-compatible API | Ollama REST API | Ollama exposes OpenAI-compatible endpoints. One OpenAI implementation covers Ollama + any OpenAI-compatible provider |
| Tool format translation | Vercel AI SDK tool conversion layer | Handles Anthropic → OpenAI tool schema differences internally |
| Env-var configuration | Standard 12-factor app pattern | `LLM_PROVIDER`, `LLM_MODEL`, provider-specific keys |
| Startup validation | Existing `src/db/index.ts` pattern | DB sync validates on startup. LLM config should too |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/llm.ts` | **Rewrite:** Provider registry with Anthropic + OpenAI + Ollama. Tool format translation. Startup validation. No default model |
| `src/engine/llm.test.ts` | **Create:** Tests for provider selection, tool translation, startup validation, cost tracking |
| `.env.example` | **Modify:** Add LLM configuration examples for all 3 providers |

## Design

### 1. Provider configuration (env vars)

```bash
# Required: which provider to use
LLM_PROVIDER=anthropic   # or: openai, ollama

# Required: which model to use (no default)
LLM_MODEL=claude-sonnet-4-6   # or: gpt-4o, llama3.3, etc.

# Provider-specific keys
ANTHROPIC_API_KEY=sk-ant-...   # required if LLM_PROVIDER=anthropic
OPENAI_API_KEY=sk-...          # required if LLM_PROVIDER=openai
OLLAMA_URL=http://localhost:11434  # required if LLM_PROVIDER=ollama (default: localhost)
```

### 2. Provider registry

```typescript
interface LlmProvider {
  name: string;
  createCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  validateConfig(): void;  // throws if misconfigured
}

const providers: Record<string, () => LlmProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
  ollama: () => new OllamaProvider(),
};
```

### 3. Startup validation

`initLlm()` called during app startup (alongside DB sync):

```typescript
export function initLlm(): void {
  const providerName = process.env.LLM_PROVIDER;
  const model = process.env.LLM_MODEL;

  if (!providerName) {
    throw new Error(
      "LLM_PROVIDER not set. Configure your LLM provider:\n" +
      "  LLM_PROVIDER=anthropic LLM_MODEL=claude-sonnet-4-6 ANTHROPIC_API_KEY=sk-...\n" +
      "  LLM_PROVIDER=openai LLM_MODEL=gpt-4o OPENAI_API_KEY=sk-...\n" +
      "  LLM_PROVIDER=ollama LLM_MODEL=llama3.3 OLLAMA_URL=http://localhost:11434"
    );
  }

  if (!model) {
    throw new Error("LLM_MODEL not set. Specify which model to use (e.g., claude-sonnet-4-6, gpt-4o, llama3.3)");
  }

  const factory = providers[providerName];
  if (!factory) {
    throw new Error(`Unknown LLM_PROVIDER: ${providerName}. Supported: ${Object.keys(providers).join(", ")}`);
  }

  activeProvider = factory();
  activeProvider.validateConfig();  // throws if API key missing, etc.
}
```

### 4. Tool format translation

Anthropic and OpenAI use different tool schemas. The translation happens inside each provider:

**Anthropic tools** (current format in Ditto):
```json
{ "name": "read_file", "description": "...", "input_schema": { "type": "object", "properties": {...} } }
```

**OpenAI tools:**
```json
{ "type": "function", "function": { "name": "read_file", "description": "...", "parameters": { "type": "object", "properties": {...} } } }
```

Each provider translates internally. The public `createCompletion()` API continues to accept Anthropic-format tools (since that's what `tools.ts` and `self-delegation.ts` already produce). Providers translate as needed.

Similarly, tool_use responses differ:
- Anthropic: `content_block` with `type: "tool_use"`, `id`, `name`, `input`
- OpenAI: `tool_calls` array with `id`, `function.name`, `function.arguments` (JSON string)

Each provider normalizes responses to the existing `LlmCompletionResponse` format.

### 5. Cost tracking

```typescript
const PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  // Anthropic
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-opus-4-6": { inputPerM: 15, outputPerM: 75 },
  "claude-haiku-4-5-20251001": { inputPerM: 0.8, outputPerM: 4 },
  // OpenAI
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "o3-mini": { inputPerM: 1.1, outputPerM: 4.4 },
  // Local (Ollama)
  "ollama:*": { inputPerM: 0, outputPerM: 0 },  // free
};
```

Unknown models default to `{ inputPerM: 0, outputPerM: 0 }` with a console warning.

### 6. Ollama via OpenAI-compatible API

Ollama exposes an OpenAI-compatible API at `/v1/chat/completions`. The `OllamaProvider` reuses `OpenAIProvider` internally with a different base URL and $0 cost:

```typescript
class OllamaProvider extends OpenAIProvider {
  constructor() {
    super({
      baseURL: process.env.OLLAMA_URL || "http://localhost:11434",
      apiKey: "ollama",  // Ollama doesn't need a key but OpenAI SDK requires one
    });
  }
}
```

## User Experience

- **Jobs affected:** None directly — this is infrastructure
- **Primitives involved:** None
- **Process-owner perspective:** During setup, the user configures their LLM provider. After that, they don't think about it. All interactions (Telegram, CLI) work the same regardless of provider. Cost tracking reflects actual provider pricing.
- **Interaction states:** Startup fails clearly if LLM not configured. Error message includes setup instructions for all 3 providers.
- **Designer input:** Not invoked — pure infrastructure.

## Acceptance Criteria

1. [ ] `createCompletion()` works with Anthropic provider (existing behavior preserved)
2. [ ] `createCompletion()` works with OpenAI provider (tool_use loop, tool format translation)
3. [ ] `createCompletion()` works with Ollama provider (via OpenAI-compatible API)
4. [ ] No hardcoded default model — `LLM_MODEL` env var required
5. [ ] No hardcoded default provider — `LLM_PROVIDER` env var required
6. [ ] Startup fails with clear error message if `LLM_PROVIDER` not set
7. [ ] Startup fails with clear error message if `LLM_MODEL` not set
8. [ ] Startup fails with clear error message if provider-specific key missing (e.g., `ANTHROPIC_API_KEY` for anthropic)
9. [ ] Tool definitions translated correctly between Anthropic and OpenAI formats
10. [ ] Tool_use responses normalized to existing `LlmCompletionResponse` format
11. [ ] Cost tracking works per provider (per-token for API, $0 for Ollama)
12. [ ] The Self, delegation, harness, and system agents work without any code changes (only `llm.ts` changed)
13. [ ] `pnpm test` passes, `pnpm run type-check` produces 0 errors
14. [ ] `.env.example` documents all 3 provider configurations

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - No default model or provider anywhere in the codebase
   - Tool format translation is correct (Anthropic ↔ OpenAI schema differences)
   - Startup validation catches all misconfiguration cases
   - Existing callers of `createCompletion()` don't need changes
   - Cost tracking is accurate per provider

## Smoke Test

```bash
# 1. Without config — should fail clearly
unset LLM_PROVIDER LLM_MODEL
pnpm run dev-bot
# Expected: Error message with setup instructions for all 3 providers

# 2. With Anthropic (current behavior)
LLM_PROVIDER=anthropic LLM_MODEL=claude-sonnet-4-6 ANTHROPIC_API_KEY=sk-... pnpm run dev-bot
# Expected: Bot starts, delegation works as before

# 3. With OpenAI
LLM_PROVIDER=openai LLM_MODEL=gpt-4o OPENAI_API_KEY=sk-... pnpm run dev-bot
# Expected: Bot starts, PM delegation works with tool_use (read_file via OpenAI function calling)

# 4. With Ollama (local model)
# (requires Ollama running locally with a model pulled)
LLM_PROVIDER=ollama LLM_MODEL=llama3.3 pnpm run dev-bot
# Expected: Bot starts, simple conversations work. Tool_use may be limited by model capability.
```

## After Completion

1. Update `docs/state.md` — multi-provider LLM support
2. Update `docs/roadmap.md` — Agent Layer: LLM provider extensibility done
3. Update `docs/architecture.md` — Layer 2: document provider registry, supported providers, configuration
4. Update ADR-012 if it discusses model routing — note multi-provider foundation
5. Retrospective: provider comparison (response quality, latency, cost), tool_use compatibility
