# Brief: Ditto Execution Layer — Own Tools, All Roles via ai-agent

**Date:** 2026-03-23
**Status:** ready
**Depends on:** Brief 030 (Self Engine), Brief 029 (Self Foundation — `llm.ts`, standalone YAMLs)
**Unlocks:** Brief 032 (LLM Provider Extensibility), Brief 033 (Model Routing Intelligence)

## Goal

- **Roadmap phase:** Conversational Self MVP (enhancement) + Agent Layer (L2) execution model
- **Capabilities:** Write tools in Ditto's tool layer, all 7 roles via `ai-agent` with Ditto's tools, role contract loading, `cli-agent` deprecated as default

## Context

ADR-017 (Delegation Weight Classes) identified that all delegations going through `cli-agent` (Claude Code subprocess) causes 5-10 minute latency for conversational roles. The deeper analysis (Insight-062) revealed that `cli-agent` is not an architectural primitive — it's a dogfood shortcut that bundles LLM + tools + terminal into a Claude-specific, local-only package.

Ditto's value is the harness (trust, memory, review, feedback). The LLM and tools are pluggable dependencies. The execution model should be:

```
All roles → ai-agent → Ditto's own tools + user's chosen LLM
```

This brief delivers the tool layer and migration. Brief 032 delivers LLM provider extensibility. Brief 033 delivers intelligent model routing.

### What exists today

- `ai-agent` executor → `claudeAdapter.execute()` → `createCompletion()` → tool_use loop with **read-only** tools (read_file, search_files, list_files)
- `cli-agent` executor → `cliAdapter.execute()` → `claude -p` subprocess → full Claude Code (read, write, terminal, project scanning)
- All 7 standalone role YAMLs use `cli-agent` with `type: repository` inputs
- `tools.ts` has 3 read-only tools with security (path traversal prevention, secret deny-list, symlink protection)
- Role contracts in `.claude/commands/dev-*.md` (53-95 lines each)

### What needs to change

1. `tools.ts` gains `write_file` — same security model as read tools
2. All 7 standalone YAMLs → `executor: ai-agent` with tool declarations
3. Claude adapter loads role contracts from `.claude/commands/dev-*.md`
4. Claude adapter parses confidence from response text
5. `cli-agent` remains in codebase but is not default for any role

## Objective

All 7 dev roles execute via `ai-agent` with Ditto's own tools (including write). Delegation latency drops from 5-10 minutes to 10-60 seconds. Full harness governance preserved. `cli-agent` available as optional fallback.

## Non-Goals

- LLM provider extensibility (Brief 032) — this brief uses existing `createCompletion()` with whatever the user has configured
- Model routing intelligence (Brief 033) — this brief doesn't add model hints to process definitions
- `run_command` / terminal tool — deferred; Builder/Reviewer don't need `pnpm test` via tool to produce useful work. The Self or human runs tests manually. Re-entry: when untested code output becomes a quality problem
- Cloud tool backends (GitHub API, MCP) — deferred to Phase 6b (Brief 025). This brief's tools use local filesystem. The tool interface is designed to be backend-swappable
- Removing `cli-agent` from the codebase — it remains as an optional executor
- Changes to the Self's conversation loop or delegation tools

## Inputs

1. `docs/adrs/017-delegation-weight-classes.md` — accepted ADR defining execution levels
2. `docs/insights/062-ditto-owns-execution-layer.md` — architectural insight driving this redesign
3. `src/engine/tools.ts` — existing read-only tools with security model
4. `src/adapters/claude.ts` — Claude adapter with hardcoded role prompts and tool_use loop
5. `src/engine/self-delegation.ts` — delegation handler
6. `processes/dev-*-standalone.yaml` — 7 standalone role process YAMLs
7. `.claude/commands/dev-*.md` — 7 role contracts
8. `src/engine/step-executor.ts` — executor routing

## Constraints

- MUST preserve full harness pipeline for all roles (memory, trust, review, feedback)
- MUST NOT break existing `cli-agent` path — it remains available as an executor
- MUST NOT break existing `ai-agent` users (system agents: router, trust-evaluator, etc.)
- MUST apply same security model to `write_file` as existing read tools: path validation, secret deny-list, symlink protection
- MUST NOT allow write to paths outside the working directory
- MUST NOT allow overwriting secret files
- Role contracts MUST be loaded from a single source (`.claude/commands/dev-*.md`) — no duplication
- The tool interface (`executeTool`, `toolDefinitions`) must remain backend-swappable — local filesystem today, other backends later via integration registry

## Provenance

| What | Source | Why this source |
|------|--------|----------------|
| Write tool with security model | Claude Code's Write tool pattern | Same security approach (path validation, deny-list) applied to agent-accessible writes |
| Role contract as system prompt | OpenClaw SOUL.md/skills pattern | Identity + skill docs loaded into prompt context. Proven at scale |
| All roles via single executor | OpenClaw model (all skills via Claude API) | No executor bifurcation. One path, configurable tools |
| Tool_use loop for read+write | Existing `claudeAdapter.execute()` | Already handles multi-turn tool calls. Write is additive |
| Confidence parsing from text | Existing `cliAdapter` confidence extraction | Same pattern: parse `CONFIDENCE: high\|medium\|low` from output |
| Conditional tool inclusion | Existing `stepNeedsTools()` in `claude.ts` | Already checks input types to decide tool availability. Extend to include write tools based on step declaration |

## What Changes (Work Products)

| File | Action |
|------|--------|
| `src/engine/tools.ts` | **Modify:** Add `write_file` tool definition and handler. Same security: `validatePath()`, `isSecretFile()`, no writes outside workDir. Creates parent directories if needed. Returns confirmation with path and line count |
| `src/engine/tools.ts` | **Modify:** Export tool subsets: `readOnlyTools` (existing 3), `readWriteTools` (all 4). Steps declare which set they need |
| `src/adapters/claude.ts` | **Modify:** `buildSystemPrompt()` loads role contract from `step.config.role_contract` file path (try-catch, fallback to hardcoded `rolePrompts`). Path resolved relative to `process.cwd()` |
| `src/adapters/claude.ts` | **Modify:** `execute()` accepts a `toolSet` parameter (read-only vs read-write) determined by the step's config. Default: read-only (backward compatible) |
| `src/adapters/claude.ts` | **Modify:** Parse `CONFIDENCE: high\|medium\|low` from response text. Append confidence instruction to system prompt if not present in role contract |
| `processes/dev-pm-standalone.yaml` | **Modify:** `executor: ai-agent`, remove `codebase` repository input, add `config.role_contract` and `config.tools: read-only` |
| `processes/dev-researcher-standalone.yaml` | **Modify:** Same pattern — `ai-agent`, `config.tools: read-only`, `config.role_contract` |
| `processes/dev-designer-standalone.yaml` | **Modify:** Same pattern — `ai-agent`, `config.tools: read-only`, `config.role_contract` |
| `processes/dev-architect-standalone.yaml` | **Modify:** `ai-agent`, `config.tools: read-write` (writes briefs, ADRs, insights), `config.role_contract` |
| `processes/dev-builder-standalone.yaml` | **Modify:** `ai-agent`, `config.tools: read-write`, `config.role_contract` |
| `processes/dev-reviewer-standalone.yaml` | **Modify:** `ai-agent`, `config.tools: read-only`, `config.role_contract` |
| `processes/dev-documenter-standalone.yaml` | **Modify:** `ai-agent`, `config.tools: read-write` (writes state.md, roadmap.md, changelog), `config.role_contract` |
| `src/engine/self.test.ts` | **Modify:** Add/update tests for: write_file tool, role contract loading, confidence parsing, all-roles-via-ai-agent delegation |

## Design

### 1. `write_file` tool

Added to `tools.ts` alongside existing read tools. Same security model:

```typescript
{
  name: "write_file",
  description: "Write content to a file. Creates the file if it doesn't exist. Creates parent directories if needed. Use for creating new files or updating existing ones.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to project root" },
      content: { type: "string", description: "The full content to write to the file" },
    },
    required: ["path", "content"],
  },
}
```

Security:
- `validatePath()` — must be within workDir, no symlink escapes
- `isSecretFile()` — cannot write to .env, credentials, keys, etc.
- `fs.mkdirSync(dirname, { recursive: true })` — create parent dirs
- `fs.writeFileSync(resolved, content, "utf-8")` — atomic write
- Returns: `"Written: {path} ({lineCount} lines)"`

### 2. Tool subsets

`tools.ts` exports two arrays:

```typescript
export const readOnlyTools: Tool[] = [read_file, search_files, list_files];
export const readWriteTools: Tool[] = [...readOnlyTools, write_file];
```

The Claude adapter selects the tool set based on `step.config.tools`:
- `"read-only"` → `readOnlyTools` (PM, Researcher, Designer, Reviewer)
- `"read-write"` → `readWriteTools` (Architect, Builder, Documenter)
- `undefined` → determined by `stepNeedsTools()` (backward compatible for non-standalone steps)

### 3. Role contract loading

`buildSystemPrompt()` in `claude.ts`:

```
if (step.config?.role_contract) {
  try {
    const contractPath = path.resolve(process.cwd(), step.config.role_contract);
    basePrompt = fs.readFileSync(contractPath, "utf-8");
  } catch {
    console.warn(`Role contract not found: ${step.config.role_contract}, using fallback`);
    basePrompt = rolePrompts[role] || defaultPrompt;
  }
} else {
  basePrompt = rolePrompts[role] || defaultPrompt;
}
```

The role contract IS the system prompt. It contains purpose, constraints, expected outputs — everything the role needs. The hardcoded `rolePrompts` remain as fallback for system agents and non-contract steps.

### 4. Confidence parsing

Appended to every system prompt (after the role contract or hardcoded prompt):

```
End your response with a confidence assessment on a separate line:
CONFIDENCE: high | medium | low
```

The adapter parses this from the response text:

```typescript
const confidenceMatch = finalText.match(/CONFIDENCE:\s*(high|medium|low)/i);
const confidence = confidenceMatch ? confidenceMatch[1] as "high" | "medium" | "low" : "medium";
```

This matches the existing CLI adapter pattern. The trust gate uses this for confidence-based routing (low → always pause).

### 5. Standalone YAML pattern

All 7 YAMLs follow this template (PM example):

```yaml
name: Dev PM (Standalone)
id: dev-pm-standalone
version: 2
status: active

description: >
  Standalone PM role. Triages and sequences work.
  Used by the Conversational Self for single-role delegation.

trigger:
  type: manual
  description: Delegated by the Conversational Self

inputs:
  - name: task
    type: text
    source: manual
    required: true
    description: The goal or question to triage

steps:
  - id: pm-execute
    name: PM Execute
    executor: ai-agent
    agent_role: pm
    config:
      role_contract: .claude/commands/dev-pm.md
      tools: read-only
    description: >
      Execute the PM role: read project state, assess priorities,
      produce a recommendation with routing signals.
    inputs: [task]
    outputs: [recommendation]

outputs:
  - name: recommendation
    type: text
    destination: conversation

trust:
  initial_tier: supervised
```

Key differences from current:
- `executor: ai-agent` (was `cli-agent`)
- No `codebase` repository input (role reads files via tools, not via Claude Code project scanning)
- `config.role_contract` points to the role contract file
- `config.tools` declares which tool subset
- `version: 2` to track the change

### 6. Tool assignment by role

| Role | Tools | Rationale |
|------|-------|-----------|
| PM | read-only | Reads state, roadmap, briefs. Doesn't write. |
| Researcher | read-only | Reads docs, code. Writes research reports... but for MVP, output goes to conversation, human applies it. |
| Designer | read-only | Reads personas, UX docs. Output goes to conversation. |
| Architect | read-write | Writes briefs, ADRs, insights — this is the job. |
| Builder | read-write | Writes code files — this is the job. |
| Reviewer | read-only | Reads code, produces review report in conversation. Doesn't write files. |
| Documenter | read-write | Writes state.md, roadmap.md, changelog — this is the job. |

## User Experience

- **Jobs affected:** Delegate (dramatically faster delegation feedback for all roles)
- **Primitives involved:** None — no UI changes
- **Process-owner perspective:** Conversations with Ditto via Telegram become responsive. All role delegations complete in 10-60 seconds instead of 5-10 minutes. Roles that write (Architect, Builder, Documenter) produce file changes directly. The user doesn't need to know about the underlying execution change.
- **Interaction states:** N/A
- **Designer input:** Not invoked — pure infrastructure. UX improvement is latency + capability, not interaction pattern.

## Acceptance Criteria

1. [ ] `write_file` tool exists in `tools.ts` with path validation, secret deny-list, and symlink protection (same as read tools)
2. [ ] `write_file` creates parent directories when needed
3. [ ] `write_file` rejects writes to secret files and paths outside workDir
4. [ ] `tools.ts` exports `readOnlyTools` and `readWriteTools` arrays
5. [ ] All 7 standalone YAMLs use `executor: ai-agent` with `config.role_contract` and `config.tools`
6. [ ] PM, Researcher, Designer, Reviewer YAMLs declare `config.tools: read-only`
7. [ ] Architect, Builder, Documenter YAMLs declare `config.tools: read-write`
8. [ ] No standalone YAML has `type: repository` input or `executor: cli-agent`
9. [ ] Claude adapter `buildSystemPrompt()` loads role contract from `step.config.role_contract` with try-catch fallback
10. [ ] Claude adapter selects tool subset based on `step.config.tools` (read-only, read-write, or legacy `stepNeedsTools()`)
11. [ ] Claude adapter parses CONFIDENCE from response text and returns it in `StepExecutionResult.confidence`
12. [ ] Existing `ai-agent` steps (system agents: router, trust-evaluator, intake-classifier) continue working with hardcoded rolePrompts (backward compatible)
13. [ ] Full harness pipeline runs for ai-agent delegations (memory assembly, trust gate, review pattern, feedback recording) — verified by test
14. [ ] `pnpm test` passes with no regressions, `pnpm run type-check` produces 0 errors
15. [ ] Smoke test: PM delegation via Telegram completes in <60 seconds

## Review Process

1. Spawn review agent with `docs/architecture.md` + `docs/review-checklist.md`
2. Review agent checks:
   - `write_file` security model matches read tools (no path traversal, no secret writes)
   - Backward compatibility: system agents, existing `ai-agent` steps, `cli-agent` fallback all work
   - Harness pipeline integrity for ai-agent delegations
   - Role contract loading doesn't create maintenance divergence
   - Tool subset selection is clear and extensible

## Smoke Test

```bash
# 1. Run tests
pnpm test
# Expected: All tests pass including new write_file and role contract tests

# 2. Start Telegram bot
pnpm run dev-bot

# 3. Send via Telegram: "what should we work on next?"
# Expected: Self delegates to PM via ai-agent (NOT cli-agent)
# Expected: Response in ~10-60 seconds (NOT 5+ minutes)
# Expected: PM reads docs/state.md via read_file tool, produces recommendation

# 4. Send: "write a brief for X"
# Expected: Self delegates to Architect via ai-agent with read-write tools
# Expected: Architect writes brief file via write_file tool

# 5. Verify harness governance:
pnpm cli status
# Expected: Process runs visible for all delegations
# Expected: Trust data recorded, confidence parsed
```

## After Completion

1. Update `docs/state.md` — execution layer transition complete, all roles via ai-agent
2. Update `docs/roadmap.md` — Conversational Self section: add execution layer as done
3. Update `docs/architecture.md` — Layer 2: reframe agent execution as "Ditto tools + pluggable LLM," document tool subsets, note `cli-agent` as optional local optimization
4. Update ADR-003 with `self` memory scope mention (doc debt)
5. Archive Insight-061 (delegation weight classes — superseded by Insight-062)
6. Retrospective: latency comparison, harness integrity, write tool security verification
