# Brief: MCP Protocol + Agent Tool Use (Phase 6b)

**Date:** 2026-03-21 (reconciled 2026-03-23 — Conversational Self alignment)
**Status:** ready (reconciled and re-approved 2026-03-23)
**Depends on:** Brief 024 (Integration Foundation + CLI)
**Unlocks:** Brief 026 (Credentials + Process I/O)

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** MCP protocol handler, REST protocol handler, step-level `tools:` field, tool resolution from integration registry, tool authorisation via agent permissions

## Context

Brief 024 proves the integration pattern with CLI. This brief adds the two remaining protocols (MCP, REST) and the agent tool use mechanism — where agents can invoke external tools during their reasoning loop.

MCP is the primary integration protocol for services without mature CLIs (Slack, Notion, Xero, Linear). REST is the universal fallback. Both require more sophisticated auth handling than CLI's env-var pattern, but the full credential vault is Brief 026 — this brief uses API keys and static OAuth tokens (sufficient for dogfood).

Agent tool use is architecturally different from integration steps: tools are invoked mid-reasoning by the agent (Claude tool_use), not as a discrete step. The harness authorises tools at assembly time; the trust gate evaluates the completed output including a log of all tool calls.

### Relationship to Conversational Self (ADR-016)

The Conversational Self delegates to dev pipeline roles via `start_dev_role` tool_use, which creates process runs through the normal harness pipeline. **Integration tools operate within those delegated process runs, not at the Self level.** The Self's delegation model is coarse-grained (entire roles); per-step tool control is fine-grained (within the harness).

The Self's own tools (`start_dev_role`, `approve_review`, `edit_review`, `reject_review`) are delegation tools — completely separate from integration tools. They exist in `self-delegation.ts` and never interact with the integration registry.

### Tool Injection Architecture

The Claude adapter currently uses a pragmatic shortcut: `stepNeedsTools()` checks input types to decide whether to include hardcoded read-only codebase tools (line 15-17 of `claude.ts`). This brief replaces that shortcut with the designed integration path:

```
Process YAML: step.tools: [github, slack]
    ↓
Process Loader: validates tool names against integration registry
    ↓
Memory Assembly Handler: resolves tools → tool schemas → HarnessContext.resolvedTools
    ↓
Step Execution Handler: passes HarnessContext (including resolvedTools) to adapter
    ↓
Claude Adapter: merges built-in codebase tools + resolved integration tools → Claude API
    ↓
Step Output: includes toolCalls log for trust gate review
```

The adapter's `execute()` signature gains an optional `resolvedTools` parameter. Built-in codebase tools (read_file, search_files, list_files) remain always-available when step inputs include repository/document types. Integration tools are additive.

## Non-Goals

- Credential vault / encrypted storage (Brief 026)
- Token lifecycle (refresh, rotation — Brief 026)
- Process I/O (triggers, sources, destinations — Brief 026)
- Webhook infrastructure
- Dynamic tool discovery (tools are declared in process definitions, not discovered at runtime)
- MCP server hosting (Ditto connects to existing MCP servers, doesn't run its own)
- Self-level tool awareness (the Self delegates roles; tools are step-scoped)

## Inputs

1. `docs/briefs/023-phase-6-external-integrations.md` — parent brief (reconciled with Self)
2. `docs/adrs/005-integration-architecture.md` — integration architecture
3. `docs/adrs/016-conversational-self.md` — Self architecture (understand delegation model)
4. `src/engine/integration-handlers/cli.ts` — CLI handler pattern to follow (from Brief 024)
5. `src/engine/integration-registry.ts` — registry to extend (from Brief 024)
6. `src/adapters/claude.ts` — Claude adapter (tool_use loop to extend for external tools). Note line 15-17: "pragmatic shortcut" comment marks the designed extension point.
7. `src/adapters/cli.ts` — CLI adapter (needs tool injection for claude -p steps)
8. `src/engine/harness-handlers/memory-assembly.ts` — harness handler where tool resolution runs
9. `src/engine/self.ts` — understand Self's delegation (tools are NOT resolved here)
10. `docs/research/external-integrations-architecture.md` — MCP patterns, token cost comparison

## Constraints

- MUST follow the protocol handler pattern established in Brief 024
- MUST NOT expose MCP server credentials in agent context
- MUST NOT allow agent to call tools not declared in the process step's `tools:` field
- MUST preserve existing codebase tools (read_file, search_files, list_files) — integration tools are additive, not replacement
- MUST NOT change the Self's tool set or delegation model — integration tools are step-scoped within delegated process runs
- MCP connections: stdio-based (local servers) first. SSE-based (remote) deferred — re-entry condition: "when a required integration has no stdio MCP server and no CLI/REST alternative." Most dogfood services have stdio servers.
- REST handler: minimal — GET/POST with headers, JSON body. Supports static API keys from integration registry entries (inline). No complex OAuth flows (vault-resolved credentials come in Brief 026).
- Tool call logs included in step output for trust gate review

## Provenance

| What | Source | Why this source |
|---|---|---|
| MCP client connection | Claude Agent SDK MCP (`@anthropic-ai/sdk`) | Native MCP support in Claude SDK. Anthropic's own implementation. |
| Skills wrapping MCP | OpenClaw (65% of skills wrap MCP servers) | Instruction layer (process) over execution layer (protocol). |
| Dynamic tool loading | Claude Agent SDK MCP tool search | Load tools on demand from MCP server schema. |
| Tool authorisation | Original — per-step `tools:` field in process definition | No existing platform gates tools by process step declaration. |
| REST handler | Standard HTTP client patterns (fetch/node-fetch) | Universal fallback protocol. |
| Tool resolution in harness assembly | ADR-005 Section 4, claude.ts line 15-17 comment | The adapter explicitly notes tool resolution should move to harness assembly for Phase 6. |

## What Changes (Work Products)

| File | Action |
|---|---|
| `src/engine/process-loader.ts` | Modify: Add `tools?: string[]` to `StepDefinition` interface. Parse `tools:` field from YAML. Validate tool names against integration registry at load time. |
| `src/engine/tool-resolver.ts` | Create: Given a step's `tools:` list, resolves each tool name to an integration registry entry + preferred protocol handler. Returns Anthropic-format tool schemas. Rejects tools not in the step's declaration. |
| `src/engine/harness-handlers/memory-assembly.ts` | Modify: When `stepDefinition.tools` is present, call tool resolver. Store resolved tool schemas on `HarnessContext.resolvedTools`. Separate from memory budget — tools don't consume memory token budget. |
| `src/engine/harness.ts` | Modify: Add `resolvedTools?: Anthropic.Messages.Tool[]` to `HarnessContext` interface. |
| `src/engine/harness-handlers/step-execution.ts` | Modify: Pass `context.resolvedTools` to adapter via `executeStep()`. |
| `src/engine/step-executor.ts` | Modify: `executeStep()` gains optional `resolvedTools` parameter. Passes to Claude adapter. |
| `src/adapters/claude.ts` | Modify: `execute()` gains optional `resolvedTools` parameter. Merges with built-in codebase tools. `stepNeedsTools()` extended: returns true when step has `tools:` field OR has codebase-type inputs. All tool calls (built-in + integration) logged in output. |
| `src/db/schema.ts` | Modify: Add `toolCalls` JSON field on `stepRuns` (logs tool name, arguments, result summary, timestamp per invocation). |
| `src/engine/integration-handlers/mcp.ts` | Create: MCP protocol handler — connects to MCP server (stdio), discovers tool schemas, invokes tools, returns structured result. Connection lifecycle managed (connect on first use, close after step). |
| `src/engine/integration-handlers/rest.ts` | Create: REST protocol handler — HTTP GET/POST with configurable headers, auth header injection, JSON response parsing. |
| `src/engine/integration-handlers/index.ts` | Modify: Add MCP and REST to protocol handler registry. Add `getToolSchemas(service, protocol)` function that returns Anthropic-format tool definitions for a service. |
| `src/engine/integration-registry.ts` | Modify: Support MCP (server command, auth) and REST (base URL, auth headers) interface entries in registry YAML. |
| `integrations/github.yaml` | Modify: Add MCP interface (stdio server for GitHub). |
| `integrations/slack.yaml` | Create: Slack integration — MCP interface. Example for MCP-only service. |
| `src/engine/tool-resolver.test.ts` | Create: Tool resolution tests (valid tools, invalid tools, missing registry entry, built-in tools preserved). |
| `src/engine/integration-handlers/mcp.test.ts` | Create: MCP handler tests (mock MCP server, tool invocation, schema discovery, error handling). |
| `src/engine/integration-handlers/rest.test.ts` | Create: REST handler tests (mock HTTP via nock, auth injection, error handling). |

## User Experience

- **Jobs affected:** Define (process definitions gain `tools:` field)
- **Primitives involved:** Process Builder (future — tools selectable per step)
- **Process-owner perspective:** Process authors can now declare which external tools an agent has access to per step. Example: "This research step can use Slack search and GitHub issue lookup." The Conversational Self surfaces the results — the user never interacts with tool resolution directly.
- **Designer input:** Not invoked — infrastructure only. Full tool UX when Process Builder ships (Phase 10).

## Acceptance Criteria

1. [ ] MCP handler connects to a stdio-based MCP server and invokes tools
2. [ ] MCP handler discovers tool schemas from MCP server and returns Anthropic-format tool definitions
3. [ ] MCP handler returns structured `StepExecutionResult` with tool call results
4. [ ] REST handler makes HTTP requests with configurable method, headers, body
5. [ ] REST handler injects auth headers from integration registry entry
6. [ ] `StepDefinition` interface has optional `tools: string[]` field, parsed from YAML
7. [ ] Process loader validates tool names against integration registry at load time
8. [ ] Tool resolver maps tool names to integration registry entries + Anthropic tool schemas
9. [ ] Tool resolver rejects tools not in the step's `tools:` list (authorisation)
10. [ ] Memory-assembly handler resolves tools into `HarnessContext.resolvedTools`
11. [ ] Claude adapter's `execute()` accepts optional `resolvedTools` and merges with built-in codebase tools
12. [ ] Tool calls during agent execution are logged on `stepRuns.toolCalls` with name, args, result summary
13. [ ] Integration registry supports MCP (server URI, auth) and REST (base URL, auth) interface entries
14. [ ] Tests: MCP handler (connect, invoke, schema discovery, error, timeout) — 4+ tests
15. [ ] Tests: REST handler (GET, POST, auth injection, error) — 4+ tests
16. [ ] Tests: Tool resolver (valid tools, invalid tools, missing registry entry, built-in preserved) — 4+ tests
17. [ ] Existing tests still pass (110 tests)

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks: tool resolution path matches the architecture in this brief, adapters receive tools correctly, built-in tools preserved, no Self-level changes, toolCalls logging complete
3. Present work + review findings to human for approval

## Smoke Test

```bash
# 1. Process with tool-equipped agent step
cat > /tmp/test-tools.yaml << 'EOF'
name: Tool Use Test
id: tool-test
version: 1
status: active
steps:
  - id: research
    name: Research with tools
    executor: ai-agent
    tools: [github]
    description: "Use GitHub tools to find recent issues"
EOF

# 2. Start with GitHub MCP server running
pnpm cli start tool-test

# 3. Expected: Claude agent has GitHub tools available alongside codebase tools
# 4. Check stepRuns.toolCalls shows tool invocations with name + args + result
# 5. Verify: Self's delegation tools (start_dev_role etc.) are unchanged
```

## After Completion

1. Update `docs/state.md` — MCP + REST handlers built, agent tool use working, tool injection path from harness to adapter complete
2. Update `docs/roadmap.md` — mark MCP handler, REST handler, step-level tools, tool resolution, tool authorisation as done
3. Update `src/adapters/claude.ts` header comment — remove "pragmatic shortcut" note, reference this brief
4. Ready for Brief 026 (Credentials + Process I/O)
