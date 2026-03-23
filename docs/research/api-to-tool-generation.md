# Research: API Spec → Agent Tool Auto-Generation

**Date:** 2026-03-23
**Question:** How do existing platforms auto-generate callable tool definitions from API specifications, discover API surfaces from code, and drive external applications end-to-end?
**Status:** Complete — awaiting review

---

## Context

Ditto's integration registry (`integrations/*.yaml`) currently requires hand-written tool definitions — name, parameters, description, execute config. Each tool maps to a CLI command template or REST endpoint. This works for a small curated set (GitHub, Slack) but won't scale to the hundreds of integrations real processes need.

Three scenarios drive this research:

1. **Scenario 1: Known API** — A service publishes an OpenAPI spec, GraphQL schema, or MCP server. Auto-generate Ditto integration YAML from the spec.
2. **Scenario 2: Unknown API** — A service has docs but no formal spec. Use AI to produce a spec, then generate tools.
3. **Scenario 3: Ditto-built app** — Ditto built a Fastify/Express app. Discover its API surface and generate tools so agents can drive it.

This research maps the landscape of how these problems are solved today.

---

## Executive Summary

### What We Found

The OpenAPI-to-tool pipeline is well-established in 2026, with multiple implementations across different frameworks. Every major platform (Composio, LangChain, FastMCP, Taskade, OpenAI) converts OpenAPI specs into callable tool definitions. The critical lesson from production use: **naive 1:1 endpoint-to-tool generation produces unusable results**. APIs with hundreds of endpoints overwhelm LLM tool selection. The winning pattern is generation-then-curation: auto-generate as a starting point, then aggressively prune and compose into higher-level workflow tools.

For code-to-spec (Scenario 2-3), the TypeScript ecosystem is mature: tsoa, fastify-swagger, and swagger-jsdoc extract OpenAPI specs from running code. Prisma and Hasura demonstrate the database-introspection-to-API pattern. AI-based discovery (feeding a codebase to an LLM to produce a spec) is emerging but not production-ready.

For agent-as-operator (Scenario 3), the landscape has bifurcated: API-first (Composio, direct tool calling) vs browser-first (Stagehand, MultiOn, Claude Computer Use). API is reliable for structured operations; browser is necessary for applications without APIs.

### What to Adopt

| Approach | Recommendation | Rationale |
|----------|---------------|-----------|
| OpenAPI → Ditto YAML codegen | **Build** (pattern from Taskade/FastMCP) | No existing tool outputs our YAML format. The conversion logic is straightforward (~200 LOC). Pattern is well-documented. |
| Tool curation/pruning | **Build** (pattern from Neon/Composio) | LLM-assisted pruning of generated tools. Unique to our YAML format. |
| Planner-controller for large APIs | **Pattern** (from LangChain) | Two-phase tool selection: planner picks endpoints from summaries, controller loads full specs. Applies to our memory-assembly. |
| Code → OpenAPI spec | **Depend** (fastify-swagger or tsoa) | Mature libraries. If Ditto builds Fastify apps, fastify-swagger gives us OpenAPI for free. |
| Database → API | **Depend** (Prisma introspection) | Already standard in the ecosystem. Generates typed client from DB schema. |
| Browser automation for agent-as-operator | **Defer** | Not needed until Ditto drives applications without APIs. Stagehand is the leading option when needed. |

---

## Part 1: API Spec → Tool Generation

### Pattern Overview

Every platform follows the same high-level pipeline:

```
OpenAPI 3.x Spec → Parse → Filter/Transform → Tool Definition → Framework-specific format
```

The differences are in filtering strategy, output format, and how they handle auth/pagination/relationships.

### Composio

**Input:** OpenAPI 3.x spec + `integrations.yaml` (auth config)
**Output:** Framework-agnostic tool schemas, transformed per-provider via `BaseProvider.wrapTools()`

**How it works:**
1. Upload OpenAPI spec file + integrations.yaml (auth schemes, app name, description)
2. Composio parses spec, generates tool definitions with slug identifiers (e.g., `GITHUB_CREATE_ISSUE`)
3. Tools are grouped into Toolkits (~500 toolkits from 1000+ tools)
4. BaseProvider interface transforms schemas to framework-specific format: OpenAI's `{ type: "function", function: {...} }`, Anthropic's `input_schema`, LangChain `Tool`, Vercel `CoreTool`
5. Adding a new framework = ~100 lines of provider code

**Auth handling:** Five-level hierarchy — explicit connectedAccounts mapping → custom OAuth apps → auto-created configs → Composio managed auth → error. All OAuth tokens stored server-side, never exposed to client. Per-user isolation via `user_id` scoping.

**Tool selection (the "too many tools" problem):**
- Toolkit grouping: `composio.tools.get(userId, {toolkits: ['GITHUB']})` returns only GitHub tools
- Schema modifiers: transform/prune definitions before LLM processing
- Tool Router: session-based routing with per-user credential isolation
- Large response processing happens server-side to prevent context overflow

**Pagination/entity relationships:** Not explicitly handled in the generation pipeline. Complex multi-step workflows are handled at the agent level, not the tool definition level.

**Quality:** High for pre-built integrations (850+ maintained by Composio). Custom spec uploads are less polished — quality depends on the spec quality.

**Relevance to Ditto:** HIGH. The BaseProvider pattern (framework-agnostic tool schema → per-framework transformation) maps directly to our architecture. Our `toolToLlmDefinition()` in `tool-resolver.ts` is already a simplified version of this. The toolkit grouping pattern is what we need for scoping tools per process step.

**Source:** [Composio Custom Tools](https://docs.composio.dev/introduction/foundations/components/integrations/custom-integration), [Composio Architecture (DeepWiki)](https://deepwiki.com/ComposioHQ/composio)

---

### LangChain OpenAPI Toolkit

**Input:** OpenAPI/Swagger spec (JSON or YAML)
**Output:** LangChain `Tool` objects

**How it works:**
1. Parse OpenAPI spec into JSON representation
2. **Planner-Controller architecture** (key innovation):
   - **Planner** — LLM chain with only endpoint names + short descriptions in context. Decides which endpoints to call and in what order.
   - **Controller** — Loads full OpenAPI spec documentation for *only* the endpoints selected by the planner. Uses regex to extract endpoint names from the plan.
3. Agent executes the plan by calling endpoints through a requests wrapper

**Auth handling:** Not handled in the toolkit itself. Developer configures auth headers externally.

**Tool selection:** The Planner-Controller split is the most sophisticated approach to the "hundreds of endpoints" problem. The planner sees only summaries (~token-cheap), then the controller loads full specs only for selected endpoints. This is a two-phase progressive disclosure pattern.

**Quality:** Works for straightforward CRUD APIs. Struggles with complex nested payloads and APIs requiring multi-step auth flows.

**Relevance to Ditto:** MEDIUM-HIGH. The Planner-Controller pattern is directly applicable to Ditto's memory-assembly phase. When a process step declares `tools: [github.*, slack.*]`, instead of loading all tool schemas into context, we could: (1) show the LLM tool summaries first, (2) load full schemas only for tools it wants to use.

**Source:** [LangChain OpenAPI Toolkit](https://docs.langchain.com/oss/python/integrations/tools/openapi), [Agent Toolkits Blog](https://blog.langchain.com/agent-toolkits/)

---

### OpenAI Function Calling + OpenAPI Cookbook

**Input:** OpenAPI spec (JSON with `$ref` resolution)
**Output:** OpenAI function definitions (`{ name, description, parameters }`)

**How it works:**
1. `openapi_to_functions()` iterates through `paths` object
2. Each HTTP method + path becomes a function
3. `operationId` → function name
4. `description` or `summary` → function description
5. Request body schema + path/query parameters → function parameters schema
6. JSON `$ref` references resolved via `jsonref.replace_refs()` before processing
7. Multi-step operations handled via conversation loop (`MAX_CALLS = 5`)

**Auth handling:** None. Not addressed in the conversion logic.

**Tool selection:** None. All endpoints converted indiscriminately.

**Quality:** Works as a starting point. The cookbook explicitly notes this is a demonstration, not production-ready. No filtering, no auth, no error handling.

**Relevance to Ditto:** LOW directly, but the `$ref` resolution pattern and the `operationId` → tool name mapping are universal patterns we'd reuse.

**Source:** [OpenAI Cookbook — Function Calling with OpenAPI Spec](https://developers.openai.com/cookbook/examples/function_calling_with_an_openapi_spec)

---

### Taskade `@taskade/mcp-openapi-codegen`

**Input:** OpenAPI 3.0+ spec
**Output:** TypeScript MCP server source files (tools + handlers)

**How it works:**
1. Parse OpenAPI spec
2. Generate TypeScript source files (not runtime-generated — actual files you can inspect, modify, version-control)
3. Each endpoint becomes an MCP tool with proper parameter schemas
4. Response normalizers transform API responses into LLM-friendly format
5. Taskade uses this internally: 50+ tools powering their MCP server

**Key differentiator:** Generates *source code*, not runtime objects. You get files you can review, customize tool descriptions for better LLM performance, and commit to git. This aligns with Ditto's declarative, git-tracked approach.

**Auth handling:** Generated code includes auth parameter placeholders. Actual credential management is external.

**Quality:** Production-proven (Taskade uses it daily). The code-generation approach means you can fix issues in generated files.

**Relevance to Ditto:** HIGH. This is the closest pattern to what Ditto needs. Instead of generating TypeScript MCP files, we'd generate integration YAML files. Same pipeline: parse spec → filter/transform → emit declarative definitions. The "generate files, then customize" workflow matches our git-tracked YAML approach perfectly.

**Source:** [Taskade MCP OpenAPI Codegen](https://github.com/taskade/mcp), [Taskade Blog](https://www.taskade.com/blog/openapi-to-mcp-code-generator)

---

### FastMCP `from_openapi()`

**Input:** OpenAPI 3.0/3.1 spec
**Output:** MCP tools and resources (Python)

**How it works:**
1. `FastMCP.from_openapi()` parses spec
2. HTTP method determines output type:
   - **GET** → MCP Resource (read-only data retrieval)
   - **POST/PUT/PATCH/DELETE** → MCP Tool (modification operations)
3. `operationId` → tool/resource name (auto-generated from method + path if absent)
4. Parameters extracted from path, query, headers, request body
5. TypeAdapter generates proper parameter schemas

**Key insight:** The GET→Resource / mutation→Tool split preserves REST semantics while giving the LLM clearer affordances about what's safe to call vs what modifies state. This maps to Ditto's trust model — read-only tools could be auto-approved while mutation tools require oversight.

**Auth handling:** Header parameters (API keys, tokens) extracted from spec and passed as tool arguments.

**Pagination:** Not addressed in generation pipeline.

**Relevance to Ditto:** MEDIUM. The GET/mutation split is a useful pattern for our trust model. The Python-only implementation limits direct adoption, but the pattern transfers cleanly.

**Source:** [FastMCP OpenAPI Integration](https://gofastmcp.com/integrations/openapi), [FastMCP DeepWiki](https://deepwiki.com/jlowin/fastmcp/9.1-openapi-provider-and-tool-generation)

---

### Vercel AI SDK

**Input:** Manual tool definitions (Zod schemas + execute functions)
**Output:** Framework-native tool objects

**How it works:** The AI SDK does NOT auto-generate tools from API specs. Tools are manually defined using the `tool()` helper with Zod schemas for input validation and TypeScript execute functions. AI SDK 6 unifies multi-step tool calling with structured output.

**Relevance to Ditto:** LOW for auto-generation. However, the Zod-based tool definition pattern is worth noting — it's the TypeScript-native way to define tool schemas with runtime validation, which could complement our YAML definitions.

**Source:** [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)

---

### Neon's Analysis: "Auto-generating MCP Servers — Yay or Nay?"

This is the most critical analysis in the landscape. Neon (Postgres company) tested auto-generating MCP servers from their OpenAPI spec and concluded:

**Three core problems with naive generation:**

1. **Decision Paralysis** — The GitHub API alone has 600+ operations. LLMs struggle to select the right tool when facing that many choices. Token cost is massive (55,000+ tokens just for schemas).

2. **Structural Incompatibility** — LLMs poorly navigate complex JSON payloads with optional parameters. REST API parameter formats "were never meant" for AI interpretation.

3. **Goal Misalignment** — REST APIs are resource-centric (create user, fetch record). Agent tools should be task-centric (onboard customer, migrate schema). The abstraction level is wrong.

**Their recommendation:** Use codegen as a *starting point*, then:
- Aggressively prune to "genuinely useful, distinct capabilities"
- Rewrite descriptions emphasizing *when and why* to use each tool
- Create higher-level workflow tools that compose multiple API calls
- Keep the total tool count low (tens, not hundreds)

**Relevance to Ditto:** CRITICAL. This validates our current approach of hand-curated tools in YAML. The path forward is: auto-generate as a starting point, then human or AI-assisted curation produces the final YAML. The integration YAML format is the *curated* layer, not the raw generation output.

**Source:** [Neon Blog — Auto-generating MCP Servers](https://neon.com/blog/autogenerating-mcp-servers-openai-schemas)

---

### OpenAPI Ecosystem Tools

**openapi-generator** (21k+ stars) and **swagger-codegen** — Generate API client libraries, server stubs, and documentation from OpenAPI specs. Support 40+ languages. These generate HTTP client code, not agent tool definitions, but the parsing infrastructure is mature and battle-tested.

**Speakeasy** — Commercial platform that generates type-safe SDKs from OpenAPI specs. Offers `x-speakeasy-mcp` extension for customizing MCP tool generation. Key best practice: write API descriptions for AI agents, not just humans.

**`openapi-mcp-generator`** (TypeScript CLI) — Open-source tool that generates standalone TypeScript MCP servers from OpenAPI specs.

**`cnoe-io/openapi-mcp-codegen`** — Another open-source OpenAPI → MCP codegen, focused on Kubernetes/CNCF ecosystem.

**Relevance to Ditto:** The parsing libraries from openapi-generator are mature and could be used as the parsing layer in a Ditto codegen tool. The `x-speakeasy-mcp` extension pattern (vendor-specific annotations in OpenAPI specs) is interesting — we could define `x-ditto-*` extensions for controlling tool generation.

**Source:** [OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator), [Speakeasy MCP Guide](https://www.speakeasy.com/mcp/tool-design/generate-mcp-tools-from-openapi)

---

### Synthesis: The Tool Generation Pipeline

Across all platforms, the pipeline converges on:

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ OpenAPI Spec │ →  │ Parse + $ref │ →  │ Filter + Prune  │ →  │ Emit Format  │
│ (3.0 / 3.1) │    │ Resolution   │    │ (the hard part) │    │ (YAML/TS/Py) │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ Human/AI Curation │
                                    │ - Prune endpoints │
                                    │ - Rewrite descs   │
                                    │ - Compose workflows│
                                    └──────────────────┘
```

**Universal mapping rules:**
- `operationId` → tool name
- `summary` / `description` → tool description
- `requestBody.content.application/json.schema` → parameters (body)
- `parameters[]` (path, query, header) → parameters
- `$ref` → resolved inline before processing
- HTTP method → determines tool type (read vs mutate)

**The filtering/pruning step is what separates production systems from demos.**

---

## Part 2: Source Code → API Discovery

### Code-First OpenAPI Generation (TypeScript)

Three mature approaches for extracting OpenAPI specs from TypeScript code:

| Tool | Approach | Input | Output | Maturity |
|------|----------|-------|--------|----------|
| **tsoa** | Decorators + types | TypeScript controllers with `@Route`, `@Get`, etc. | OpenAPI 3.x spec + Express/Koa routes | High (7.5k stars) |
| **fastify-swagger** | Fastify schema inference | Fastify route schemas (JSON Schema) | OpenAPI 2.0 or 3.0.3 | High (official Fastify plugin) |
| **swagger-jsdoc** | JSDoc comments | Comment annotations in code | OpenAPI spec | Medium (declining — tsoa preferred) |

**tsoa** is the strongest option for TypeScript codebases. It reads TypeScript interfaces directly and generates both OpenAPI specs and route middleware. If Ditto-built apps use tsoa decorators, we get OpenAPI specs for free — which then feed into our tool generation pipeline.

**fastify-swagger** is relevant if Ditto builds Fastify applications. The plugin introspects Fastify's JSON Schema route definitions and emits OpenAPI. Zero additional annotation needed if routes already have schemas.

**Relevance to Ditto:** For Scenario 3 (Ditto driving apps it built), this is the answer. If the build process includes tsoa or fastify-swagger, every app Ditto creates automatically produces an OpenAPI spec. That spec feeds into the codegen pipeline (Part 1) to produce integration YAML. The full chain: **code → OpenAPI spec → Ditto integration YAML → agent can drive the app**.

**Source:** [tsoa GitHub](https://github.com/lukeautry/tsoa), [fastify-swagger GitHub](https://github.com/fastify/fastify-swagger)

---

### Database Introspection → API

**Prisma** reads a database schema and generates:
1. A Prisma schema file (data model)
2. A fully typed TypeScript client with CRUD operations
3. The client is not an API spec, but it's a typed interface that could be wrapped in an API layer

`prisma db pull` introspects the database, maps tables to models, translates snake_case to camelCase, and generates the typed client. Works with PostgreSQL, MySQL, SQL Server, SQLite, MongoDB, CockroachDB.

**Hasura** takes introspection further — it reads a PostgreSQL database and immediately exposes a GraphQL API with queries, mutations, subscriptions, filtering, pagination, and relationships. No code generation needed; the API is live as soon as you point Hasura at the database.

**DreamFactory** auto-generates REST APIs for 20+ databases without writing code. Production-ready endpoints in minutes.

**Relevance to Ditto:** For Scenario 3, if Ditto builds apps with databases, the chain is: **database schema → Prisma introspection → typed client → API layer (Fastify) → OpenAPI spec → Ditto integration YAML**. Each step is a mature, well-supported tool. Hasura could shortcut this for GraphQL-based apps, though GraphQL → tool generation is less mature than OpenAPI → tool generation.

**Source:** [Prisma Introspection](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/introspection-typescript-postgresql), [Hasura GraphQL](https://hasura.io/docs/3.0/upgrade/feature-availability/api-features/)

---

### AI-Based API Discovery

No production-ready tool exists that points an LLM at a codebase and produces a reliable OpenAPI spec. The closest approaches:

- **Codebase-digest / Repomix** — Pack a codebase into LLM-friendly format, then prompt for analysis. Could produce a rough API inventory but not a validated spec.
- **Fern code-to-docs** — Connects to GitHub, analyzes codebase, generates documentation. Closer to docs than specs.
- **LLM Code Map** — Visualizes TypeScript dependencies. Could identify API routes but doesn't produce specs.

**The practical path:** Use code-first tools (tsoa, fastify-swagger) for TypeScript apps that follow standard patterns. For legacy or non-standard codebases, use an LLM to *draft* an OpenAPI spec from code analysis, then validate against the running application.

**Relevance to Ditto:** Defer AI-based discovery. The code-first tools solve Scenario 3 cleanly. If we need to discover APIs from code we didn't build (Scenario 2), the approach would be: LLM analyzes code → drafts OpenAPI spec → human validates → spec feeds into codegen pipeline.

---

## Part 3: Agent-as-Operator Platforms

### The 2026 Landscape

Two architectural approaches dominate:

#### API-First (Structured Tool Calling)

| Platform | Model | State Handling | Reliability |
|----------|-------|----------------|-------------|
| **Composio** | SDK + 850 connectors, tool routing | Session-based, per-user credential isolation | High (structured API calls) |
| **Ditto (current)** | Integration YAML + CLI/REST handlers | Process-scoped, harness manages state | High (deterministic execution) |
| **LangChain/LangGraph** | OpenAPI toolkit + agent loops | Conversation history, checkpointing | Medium (depends on LLM) |

API-first agents call structured endpoints. State is managed through the process/conversation. Reliable, auditable, but limited to services with APIs.

#### Browser-First (Visual Automation)

| Platform | Model | State Handling | Reliability |
|----------|-------|----------------|-------------|
| **Stagehand v3** (Browserbase) | Chrome DevTools Protocol, AI-native | Session persistence, 50M+ sessions processed | Medium-High |
| **MultiOn** | API for web automation | Internal models handle navigation | Medium |
| **Claude Computer Use** | Screenshot + input commands, desktop-wide | Stateless per interaction | Medium |
| **OpenAI Operator (CUA)** | Cloud-based virtual browser | Contained browser environment | Medium |
| **Perplexity Comet** | Standalone AI browser | Browsing history + agentic memory | Medium |

Browser-first agents see screens and click buttons. They work with any application that has a UI, but are slower, less reliable, and harder to audit than API calls.

#### The Hybrid Consensus

The emerging pattern in 2026: **API when available, browser when necessary**.

- Composio provides 850+ API integrations. When an API exists, use it — it's faster, cheaper, more reliable.
- When no API exists (legacy enterprise apps, web-only services), fall back to browser automation.
- Claude Computer Use is unique in supporting desktop applications (not just browser), but is the least reliable option.

**State across operations:** All platforms handle multi-step operations through one of:
1. **Conversation history** — append tool results to message history, LLM chains calls (OpenAI, LangChain)
2. **Session objects** — platform manages a session with credentials and context (Composio Tool Router)
3. **Process state** — durable state managed by an orchestrator (Ditto's process engine)

Ditto's process engine (option 3) is the most robust — state survives agent failures, is auditable, and can be reviewed/resumed.

### Devin and OpenHands

These are not agent-as-operator platforms in the traditional sense — they're autonomous software engineers. But their interaction model is relevant:

**OpenHands:** Agents write code, run shell commands in sandboxed Docker, browse the web, and manage files. MIT-licensed. The key pattern: agents interact with applications through the *development tools* (terminal, editor, browser) rather than through APIs.

**Devin:** Proprietary. Maintains context across extended sessions. Combines planning, execution, and verification. The interaction model is closer to "human developer working in an IDE" than "agent calling APIs."

**Relevance to Ditto:** These confirm that for Scenario 3 (driving apps Ditto built), the most powerful approach is giving the agent the same tools a developer would use — terminal access, file access, HTTP client — rather than generating formal API tools. This is what Ditto's `script` executor already provides. The formal tool generation pipeline is for *other people's* services; for apps Ditto built, direct code/terminal access may be more effective.

---

## Cross-Cutting Findings

### The "Too Many Tools" Problem

Every platform that has reached scale has confronted this. Solutions cluster into four patterns:

| Pattern | Used By | How It Works |
|---------|---------|-------------|
| **Toolkit grouping** | Composio | Organize tools into named groups. Agent requests a toolkit, not individual tools. |
| **Planner-Controller** | LangChain | Two-phase: planner sees summaries, controller loads full specs for selected tools only. |
| **Progressive loading** | MCP tool search, Claude Agent SDK | Tools loaded on-demand when agent needs them, not preloaded. |
| **Aggressive pruning** | Neon, Taskade | Generate all, then cut to tens of genuinely useful tools. Compose multi-step workflows. |

**Recommendation for Ditto:** Combine toolkit grouping (our `service.tool_name` already does this) with progressive loading (only load tool schemas for services declared in the current step). The Planner-Controller pattern could enhance memory-assembly for steps with many available tools.

### Auth Across Generated Tools

No platform generates auth handling from the OpenAPI spec's `securitySchemes` automatically. Auth is always configured separately:

- Composio: `integrations.yaml` alongside the OpenAPI spec
- FastMCP: Header parameters extracted but credential values are external
- LangChain: Developer configures auth headers
- Taskade: Generated code has auth parameter placeholders

**Recommendation for Ditto:** Our existing approach (auth configured in the integration YAML `interfaces` section, credential vault provides values at runtime) is correct. The codegen tool should generate the `tools:` section from the OpenAPI spec but leave the `interfaces:` and auth sections for human configuration.

### Description Quality Matters

Speakeasy and Neon both emphasize: tool descriptions must be written for AI agents, not humans. Key practices:
- Describe *when and why* to use the tool, not just what it does
- Include concrete parameter examples
- Document error responses
- Use descriptive `operationId` values

**Recommendation for Ditto:** The codegen pipeline should include a "description enrichment" pass — either templated improvements or LLM-assisted rewriting of generic API descriptions into agent-oriented descriptions.

---

## Recommendation: Ditto's Approach

### Architecture: `ditto generate-integration`

A CLI command that produces integration YAML from an OpenAPI spec:

```
ditto generate-integration --from openapi --spec ./path/to/spec.yaml --service my-service
```

**Pipeline:**

```
┌────────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────────┐
│ OpenAPI 3.x    │ →  │ Parse + $ref  │ →  │ Filter + Map    │ →  │ Emit YAML    │
│ Spec (file/URL)│    │ Resolution    │    │ operationId → name│   │ (integration │
└────────────────┘    └───────────────┘    │ params → schema  │    │  registry)   │
                                           │ method → protocol│    └──────────────┘
                                           └─────────────────┘
                                                   │
                                                   ▼
                                           ┌───────────────┐
                                           │ Human reviews  │
                                           │ + curates YAML │
                                           └───────────────┘
```

**Mapping rules (OpenAPI → Ditto YAML):**

| OpenAPI | Ditto Integration YAML |
|---------|----------------------|
| `info.title` | `service` (slugified) |
| `info.description` | `description` |
| `servers[0].url` | `interfaces.rest.base_url` |
| `securitySchemes` | `interfaces.rest.auth` (template — human fills credentials) |
| `operationId` | `tools[].name` |
| `summary` / `description` | `tools[].description` |
| `parameters[]` + `requestBody` | `tools[].parameters` |
| HTTP method | `tools[].execute.protocol: rest` + `tools[].execute.method` |
| Path | `tools[].execute.endpoint` |
| Path parameters `{id}` | Preserved as `{id}` in endpoint template |

**What the codegen does NOT do:**
- Auth configuration (human fills in `interfaces.rest.auth` and credential vault entries)
- Tool pruning (human decides which tools to keep)
- Workflow composition (human creates higher-level tools that chain multiple operations)
- CLI interface detection (human adds CLI interface if a CLI exists)

### Why This Fits Ditto's Architecture

1. **Integration YAML as intermediate format** — Generated YAML is the same format as hand-written YAML. No special "generated" vs "manual" distinction. Git-tracked, human-readable, human-editable.

2. **Multi-protocol handlers** — The generated YAML uses `protocol: rest` by default. Human can add `protocol: cli` alternatives for services with CLIs, matching ADR-005's multi-protocol approach.

3. **Credential vault** — Auth is not baked into generated tools. The `interfaces.rest.auth` field references the credential vault (Brief 035). Generated tools work with the same credential flow as hand-written tools.

4. **Tool resolver unchanged** — The existing `tool-resolver.ts` works with generated YAML identically to hand-written YAML. No engine changes needed.

5. **Progressive disclosure for large APIs** — When an API has 100+ endpoints, generate all tools but mark them with a `generated: true` flag. The curation step (human or LLM-assisted) produces the final curated set. This is the Neon/Taskade pattern.

### For Scenario 3 (Ditto-Built Apps)

The full chain:

```
Ditto builds Fastify app with fastify-swagger
    → App auto-exposes /docs/json (OpenAPI spec)
    → `ditto generate-integration --from openapi --spec http://localhost:3000/docs/json --service my-app`
    → Integration YAML generated
    → Agent can now drive the app via REST tools
```

This requires no new infrastructure — just the codegen CLI command and the convention that Ditto-built apps include fastify-swagger.

### Future: LLM-Assisted Curation

After the basic codegen works, add an optional `--curate` flag:

```
ditto generate-integration --from openapi --spec ./spec.yaml --service my-service --curate
```

This would:
1. Generate all tools from the spec
2. Pass the full tool list to an LLM with the prompt: "Given these API tools, select the 10-20 most useful for an AI agent. Rewrite descriptions to explain when and why to use each tool. Suggest any workflow tools that compose multiple operations."
3. Output the curated YAML

This is the Neon recommendation operationalized.

---

## MCP vs CLI: Protocol Landscape (March 2026)

Follow-up research on the MCP-vs-CLI trend, relevant to Ditto's protocol strategy (ADR-005).

### The shift

MCP's hype cycle has broken. Adoption is massive (17K servers, 97M SDK downloads, Linux Foundation governance) but practitioner sentiment is increasingly skeptical of MCP maximalism.

| Signal | Direction |
|--------|-----------|
| Adoption numbers, big tech backing | MCP growing |
| Token efficiency for known tools | CLI winning |
| Developer experience for simple tasks | CLI winning |
| Enterprise security/governance | Neither winning yet |
| Practitioner sentiment | Skeptical of MCP-for-everything |

### Hard numbers

- **Perplexity** found 72% of their context window wasted on MCP tool definitions. Moved to REST-based Agent API internally.
- **Scalekit benchmarks**: GitHub "what language is this repo?" — CLI: 1,365 tokens vs MCP: 44,026 tokens. CLI achieved 28% higher task completion with 33% token efficiency advantage.
- **Cloudflare**: traditional MCP tool-calling is "fundamentally flawed for complex AI agents." Proposed "Code Mode" (~1,000 tokens vs tens of thousands).
- **mcp2cli**: converts MCP tools to CLI commands, claims 96-99% fewer tokens (158 points on HN).

### The Cramer nuance

David Cramer's position is more sophisticated than "MCP bad":
- Auto-generating MCP from OpenAPI is "broken by design" — wrong abstraction level (CRUD vs outcomes)
- Solution is **skills** — outcome-oriented tools that compose multiple API calls (what Ditto's curated YAML already does)
- Context management is the real challenge, not the protocol itself
- Bad implementations (GitHub's MCP) don't invalidate the protocol

### Emerging consensus

CLI for tools the model already knows (`gh`, `git`, `kubectl`). REST as universal fallback. MCP for tool discovery, governance, and enterprise auth where needed. Don't auto-generate MCP from OpenAPI — design agent-appropriate skills. The "right tool for the job" era.

### Validation of ADR-005

Ditto's architecture is positioned on the winning side:
1. **CLI-first where CLIs exist** — ADR-005's 10-32x cost optimization validated by market
2. **REST as universal fallback** — not MCP-dependent
3. **Curated tools** — Cramer's "skills" pattern is what our YAML provides
4. **MCP deferred (Insight-065)** — correct call. Protocol maturing but not stable
5. **`preferred:` field** per service — already encodes "right tool for the job"

MCP's governance features (per-user OAuth, structured audit trails) become relevant at multi-tenant (Phase 12). Not now.

### Sources (MCP landscape)

- [Perplexity Ditches MCP: 72% Context Waste](https://byteiota.com/perplexity-ditches-mcp-72-context-waste-kills-protocol/)
- [MCP is dead. Long live the CLI — ejholmes](https://ejholmes.github.io/2026/02/28/mcp-is-dead-long-live-the-cli.html)
- [MCP vs CLI: Benchmarking AI Agent Cost & Reliability — Scalekit](https://www.scalekit.com/blog/mcp-vs-cli-use)
- [Code Mode: give agents an entire API in 1,000 tokens — Cloudflare](https://blog.cloudflare.com/code-mode-mcp/)
- [Show HN: mcp2cli — 96-99% fewer tokens](https://news.ycombinator.com/item?id=47305149)
- [Rethinking Tools in MCP — David Cramer](https://cra.mr/rethinking-the-definition-of-tools-in-mcp)
- [MCP is not good, yet — David Cramer](https://cra.mr/mcp-is-not-good-yet/)
- [Anthropic donates MCP to Linux Foundation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
- [MCP Won. MCP Might Also Be Dead — DEV Community](https://dev.to/0coceo/mcp-won-mcp-might-also-be-dead-4a8a)
- [Real Faults in MCP Software: Taxonomy — arxiv](https://arxiv.org/html/2603.05637v1)

---

## Gaps Where No Existing Solution Fits

1. **OpenAPI → Ditto YAML format** — No tool outputs our specific YAML format. This is a straightforward build (~200 LOC parser + emitter).

2. **Trust-aware tool classification** — FastMCP's GET→Resource/mutation→Tool split hints at this, but no platform classifies generated tools by trust impact (read-only = auto-approve, write = require oversight). Original to Ditto.

3. **Process-scoped tool generation** — No platform generates tools scoped to a specific process definition. Tools are generated for a service, then the process definition selects which ones to use. This is already how Ditto works (`tools: [github.search_issues, slack.send_message]` in process steps).

4. **CLI interface detection** — No tool auto-detects whether a service has a CLI and adds CLI interface configuration alongside REST. This would require a registry of known CLIs (gh, gws, aws, stripe, etc.) matched against service identifiers.

---

## Sources

- [Composio Custom Tools](https://docs.composio.dev/introduction/foundations/components/integrations/custom-integration)
- [Composio Architecture (DeepWiki)](https://deepwiki.com/ComposioHQ/composio)
- [Composio GitHub](https://github.com/ComposioHQ/composio)
- [LangChain OpenAPI Toolkit](https://docs.langchain.com/oss/python/integrations/tools/openapi)
- [LangChain Agent Toolkits Blog](https://blog.langchain.com/agent-toolkits/)
- [OpenAI Cookbook — Function Calling with OpenAPI Spec](https://developers.openai.com/cookbook/examples/function_calling_with_an_openapi_spec)
- [Taskade MCP OpenAPI Codegen](https://github.com/taskade/mcp)
- [Taskade Blog — OpenAPI to MCP](https://www.taskade.com/blog/openapi-to-mcp-code-generator)
- [FastMCP OpenAPI Integration](https://gofastmcp.com/integrations/openapi)
- [FastMCP OpenAPI (DeepWiki)](https://deepwiki.com/jlowin/fastmcp/9.1-openapi-provider-and-tool-generation)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Neon — Auto-generating MCP Servers from OpenAPI](https://neon.com/blog/autogenerating-mcp-servers-openai-schemas)
- [Speakeasy — Generate MCP Tools from OpenAPI](https://www.speakeasy.com/mcp/tool-design/generate-mcp-tools-from-openapi)
- [OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator)
- [tsoa — TypeScript OpenAPI](https://github.com/lukeautry/tsoa)
- [fastify-swagger](https://github.com/fastify/fastify-swagger)
- [Prisma Introspection](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/introspection-typescript-postgresql)
- [Hasura GraphQL](https://hasura.io/docs/3.0/upgrade/feature-availability/api-features/)
- [Agentic Browser Landscape 2026](https://nohacks.co/blog/agentic-browser-landscape-2026)
- [Anthropic — Computer Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [OpenHands GitHub](https://github.com/OpenHands/OpenHands)
- [Stagehand / Browserbase](https://www.firecrawl.dev/blog/best-browser-agents)
- [MultiOn](https://docs.multion.ai/welcome)
- [cnoe-io/openapi-mcp-codegen](https://github.com/cnoe-io/openapi-mcp-codegen)
- [openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator)
- [Xano — OpenAPI Specification Guide 2026](https://www.xano.com/blog/openapi-specification-the-definitive-guide/)
