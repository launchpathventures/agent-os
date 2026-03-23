# Research Report: Rendered Output Architectures for AI-Generated UI

**Date:** 2026-03-23
**Research question:** How do existing frameworks handle AI-generated structured output that renders as UI? What patterns exist for catalog-constrained rendering, streaming, cross-platform output, and interaction models?
**Triggered by:** Insights 066 (Process Outputs Are Polymorphic) and 067 (Conversation Is Alignment, Work Surface Is Manifestation)
**Consumers:** Dev Architect (output architecture ADR, ADR-009 reframe), Dev Builder (future rendered-view implementation)

---

## Context

Ditto processes produce typed, structured artifacts (Insight-066). One output type is **rendered views** — dashboards, forms, reports displayed on the work surface. These can be static or dynamic. The work surface is the primary surface of the Ditto app (Insight-067), where processes manifest as living outputs.

This report extracts implementation patterns from four approaches to AI-generated UI rendering. The focus is on HOW they constrain, stream, render, and handle interaction — not whether Ditto should adopt any specific one.

---

## 1. json-render (Vercel Labs)

**Source:** github.com/vercel-labs/json-render
**Architecture:** Schema → Catalog → Registry → Renderer (4-layer separation)

### 1.1 Spec Format

**File:** `packages/core/src/types.ts`

Flat map with string-key references, not a nested tree:

```typescript
interface Spec {
  root: string;                           // Key of root element
  elements: Record<string, UIElement>;    // Flat map: key -> element
  state?: Record<string, unknown>;        // Initial state model
}

interface UIElement<T extends string = string, P = Record<string, unknown>> {
  type: T;                                         // Component type from catalog
  props: P;                                        // Component props
  children?: string[];                             // Child element KEYS (not nested objects)
  visible?: VisibilityCondition;                   // Conditional visibility
  on?: Record<string, ActionBinding | ActionBinding[]>; // Event bindings
  repeat?: { statePath: string; key?: string };    // List iteration
  watch?: Record<string, ActionBinding | ActionBinding[]>; // State watchers
}
```

**Streaming format:** RFC 6902 JSON Patch operations (JSONL):
```
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Card","props":{"title":"Hello"},"children":["child-1"]}}
{"op":"add","path":"/elements/child-1","value":{"type":"Text","props":{"content":"World"}}}
```

Children reference by key, not nesting. LLM outputs elements in any order; UI fills in progressively.

**Dynamic value expressions** in props:
- `{ "$state": "/path" }` — read-only state binding (RFC 6901 JSON Pointer)
- `{ "$bindState": "/path" }` — two-way state binding
- `{ "$bindItem": "field" }` / `{ "$item": "field" }` — repeat-scope bindings
- `{ "$cond": <condition>, "$then": <value>, "$else": <value> }` — conditional
- `{ "$template": "Hello, ${/name}!" }` — string interpolation
- `{ "$computed": "fnName", "args": {...} }` — registered function call

### 1.2 Catalog System

**File:** `packages/core/src/schema.ts`

Two-step: define a **schema** (the grammar — what shape specs and catalogs take) then instantiate a **catalog** (the vocabulary — what components exist).

Schema definition:
```typescript
const schema = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(s.object({
      type: s.ref("catalog.components"),        // Must be a key from catalog.components
      props: s.propsOf("catalog.components"),    // Props from the matched component
      children: s.array(s.string()),
      visible: s.any(),
    })),
  }),
  catalog: s.object({
    components: s.map({
      props: s.zod(),                // Zod schema for component props
      slots: s.array(s.string()),    // Named slots (["default"] = children)
      description: s.string(),       // AI prompt hint
      example: s.any(),              // Example prop values
    }),
    actions: s.map({
      params: s.zod(),               // Zod schema for action params
      description: s.string(),       // AI prompt hint
    }),
  }),
}));
```

Catalog instantiation:
```typescript
const catalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({ title: z.string().nullable(), description: z.string().nullable() }),
      slots: ["default"],
      description: "Container card for content sections",
      example: { title: "Overview" },
    },
    Text: {
      props: z.object({ content: z.string(), muted: z.boolean().nullable() }),
      description: "Text content",
    },
  },
  actions: {
    loadData: {
      params: z.object({ endpoint: z.string() }),
      description: "Fetch data from an API endpoint",
    },
  },
});
```

**Zod as single source of truth.** Component props are Zod schemas. The same schema:
1. **Validates** AI output at runtime (`catalog.validate()`)
2. **Generates human-readable prompts** for text-mode LLMs (`catalog.prompt()`)
3. **Produces JSON Schema** for structured output APIs (`catalog.jsonSchema({ strict: true })`)
4. **Infers TypeScript types** for registry implementations (`InferCatalogComponents<C>`, `InferComponentProps<C, K>`)

### 1.3 Prompt Generation

**File:** `packages/core/src/schema.ts` (function `generatePrompt`, ~line 575-1092)

`catalog.prompt()` produces a complete system prompt from the catalog definition:
1. Output format explanation (JSONL + JSON Patch)
2. Auto-generated examples from the first two catalog components (using Zod introspection: `formatZodType()` reads `schema._def.typeName` to produce human-readable type signatures)
3. State binding documentation with examples
4. Component listing: `Card: { title?: string, description?: string } - Container card [accepts children]`
5. Actions listing (built-in + custom)
6. Event, visibility, dynamic prop, validation, watcher documentation
7. Rules (mode-specific + schema defaults + custom)

**Key pattern:** `formatZodType()` introspects Zod internals to produce prompt-friendly type signatures. `generateExamplePropsFromZod()` generates sample values from Zod schema introspection when no explicit example is provided.

### 1.4 Registry Pattern

**File:** `packages/react/src/renderer.tsx`

Maps catalog component names to platform-specific implementations:

```typescript
const { registry, handlers } = defineRegistry(catalog, {
  components: {
    Card: ({ props, children, emit }) => (
      <div className="card" onClick={() => emit("press")}>
        <h2>{props.title}</h2>
        {children}
      </div>
    ),
  },
  actions: {
    loadData: async (params, setState, state) => {
      const data = await fetch(params.endpoint);
      setState(prev => ({ ...prev, data }));
    },
  },
});
```

Each component receives `{ props, children, emit, on, bindings, loading }`. The `emit("eventName")` function resolves event bindings from the element's `on` field.

**Cross-platform:** One catalog, N registries. `shadcn` package exports both catalog entries (`shadcnComponentDefinitions`) and React implementations (`shadcnComponents`). React Native, PDF, Email, Image (Satori), Video (Remotion), 3D (R3F), Vue, Svelte, SolidJS all use the same catalog with platform-specific registries.

### 1.5 Renderer

**File:** `packages/react/src/renderer.tsx`

Tree walker wrapped in context providers:
```
JSONUIProvider (StateProvider > VisibilityProvider > ValidationProvider > ActionProvider)
  → Renderer
    → ElementRenderer (memoized, recursive)
      → RepeatChildren (for elements with repeat)
```

Resolution per element:
1. Evaluate `visible` condition (skip if false)
2. Resolve dynamic prop expressions (`$state`, `$bindState`, `$item`, `$cond`, `$template`, `$computed`)
3. Look up component in registry by `element.type`
4. Create `emit` function resolving `element.on[eventName]` to action bindings
5. Set up `watch` effects firing actions on state path changes
6. Recursively render children by key lookup in `spec.elements`
7. Wrap in `ElementErrorBoundary`

**Progressive rendering:** `loading` prop propagates. Missing child elements (referenced but not yet streamed) emit warnings only when `loading` is false.

### 1.6 Actions

**File:** `packages/core/src/actions.ts`

```typescript
interface ActionBinding {
  action: string;                           // Must be in catalog
  params?: Record<string, DynamicValue>;    // Can use $state refs
  confirm?: ActionConfirm;                  // Confirmation dialog before execution
  onSuccess?: ActionOnSuccess;              // navigate | set state | chain action
  onError?: ActionOnError;                  // set state | chain action
  preventDefault?: boolean;
}
```

**Built-in actions** (handled by runtime): `setState`, `pushState`, `removeState`, `validateForm`.
**Action chaining:** `onSuccess: { action: "nextAction" }` enables multi-step workflows from a single interaction.

### 1.7 State Management

**File:** `packages/core/src/state-store.ts`

```typescript
interface StateStore {
  get: (path: string) => unknown;              // Read by JSON Pointer
  set: (path: string, value: unknown) => void; // Write + notify
  update: (updates: Record<string, unknown>) => void; // Batch write
  getSnapshot: () => StateModel;
  subscribe: (listener: () => void) => () => void;
}
```

**Store adapter pattern** — three callbacks adapt any external state library:
```typescript
interface StoreAdapterConfig {
  getSnapshot: () => StateModel;
  setSnapshot: (next: StateModel) => void;
  subscribe: (listener: () => void) => () => void;
}
```

Adapters exist for Zustand, Redux, Jotai, XState.

### 1.8 MCP Integration

**File:** `packages/mcp/src/server.ts`

```typescript
const server = await createMcpApp({
  name: "My Dashboard",
  catalog: myCatalog,
  html: myBundledHtml,
});
```

Creates an MCP server with:
1. A **tool** whose input schema is `catalog.zodSchema()` and description includes `catalog.prompt()`. LLM generates a spec, tool validates via `catalog.validate()`.
2. A **resource** at `ui://render-ui/view.html` serving self-contained HTML.

**Key insight:** The catalog's `zodSchema()` serves as the MCP tool's structured input schema, and `catalog.prompt()` serves as the tool's description. Same catalog definition drives both validation and AI instruction.

### 1.9 Monorepo Structure

| Package | Purpose |
|---------|---------|
| `@json-render/core` | Types, schema, prompt generator, state store, actions, streaming, validation |
| `@json-render/react` | React renderer, hooks (useUIStream, useChatUI, useBoundProp), JSONUIProvider |
| `@json-render/react-native` | React Native renderer |
| `@json-render/react-pdf` | PDF renderer |
| `@json-render/react-email` | Email renderer |
| `@json-render/image` | Image renderer (Satori) |
| `@json-render/remotion` | Video renderer |
| `@json-render/react-three-fiber` | 3D renderer |
| `@json-render/shadcn` | Pre-built shadcn/ui component definitions + implementations |
| `@json-render/mcp` | MCP server integration |
| `@json-render/codegen` | Spec-to-code traversal/serialization |
| `@json-render/zustand` / `jotai` / `redux` / `xstate` | State adapters |
| `@json-render/solid` / `svelte` / `vue` | Framework renderers |
| `@json-render/yaml` | YAML spec format |

Dependency graph: All renderers depend on `core`. State adapters depend on `core/store-utils`. `shadcn` provides both catalog definitions and component implementations.

---

## 2. Vercel AI SDK — Generative UI (RSC)

**Source:** github.com/vercel/ai

### 2.1 Approach

No separate UI spec language. Constraint defined entirely through Zod schemas on tool parameters. LLM selects tools via function calling; SDK maps tool call results to JSX.

```typescript
tools: {
  getWeather: {
    description: 'Get the weather for a location',
    inputSchema: z.object({ location: z.string() }),
    generate: async function* ({ location }) {
      yield <LoadingComponent />;
      const weather = await getWeather(location);
      return <WeatherComponent weather={weather} />;
    },
  }
}
```

**File:** `packages/rsc/src/stream-ui/stream-ui.tsx`

### 2.2 Constraint Mechanism

Structural — the LLM never generates UI markup. It selects tools and provides structured arguments. The developer controls which React components map to each tool. Invalid UI is structurally impossible.

### 2.3 Streaming

**File:** `packages/rsc/src/streamable-ui/create-streamable-ui.tsx`

`createStreamableUI` uses React Suspense boundaries chained via resolvable promises. `.update()` resolves the current promise and creates a new Suspense boundary. Generator functions `yield` intermediate UI (loading states) before `return`ing the final component.

### 2.4 Interaction Model

Two-tier state: `AIState` (serializable conversation context) and `UIState` (rendered React nodes). Server Actions are the interaction primitive. No built-in action/event system from rendered components back to the AI — wired through normal React event handlers calling server actions.

**File:** `packages/rsc/src/ai-state.tsx`

### 2.5 Summary

| Aspect | Pattern |
|--------|---------|
| Catalog | Tool definitions with Zod schemas |
| Constraint | Structural (tool selection, not markup generation) |
| Spec format | None — tool calls mapped directly to JSX |
| Streaming | React Suspense promise chains |
| Interaction | Server Actions (manual wiring) |
| Cross-platform | React Server Components only |

---

## 3. OpenUI (thesysdev/openui)

**Source:** github.com/thesysdev/openui

### 3.1 Approach

Custom DSL (OpenUI Lang) optimized for token efficiency (52-67% fewer tokens than JSON). Line-oriented, assignment-based.

```
root = Root([nav, dashboard])
nav = Navbar("Acme Corp", [link1, link2])
stat1 = StatCard("Revenue", "$1.2M", "up")
```

**File:** `packages/react-lang/src/parser/parser.ts`

### 3.2 Catalog System

Components registered with `defineComponent` and assembled into a library:

```typescript
defineComponent({
  name: 'StatCard',
  description: 'Displays a metric',
  props: z.object({ title: z.string(), value: z.string(), trend: z.string() }),
  component: StatCardImpl,
})
```

**File:** `packages/react-lang/src/library.ts`

Library generates system prompt via `library.prompt()` embedding all component signatures, syntax rules, and usage guidance.

### 3.3 Constraint Mechanism

Prompt-engineering-based — LLM is instructed to output valid OpenUI Lang using registered components only. Zod schemas define prop types. Component groups add usage notes (e.g., "NEVER nest Form inside Form").

### 3.4 Streaming

**File:** `packages/react-lang/src/Renderer.tsx`

Incremental re-parse on every chunk. **Forward references (hoisting):** `root = Root([table])` can reference `table` before definition. Renderer shows what it has; unresolved references render as skeleton. When the definition arrives, it resolves.

### 3.5 Interaction Model

**File:** `packages/react-lang/src/hooks/`

`useTriggerAction(userMessage, formName?, action?)` dispatches actions. Renderer wraps into `ActionEvent` objects fired via `onAction` callback. Built-in action types: `continue_conversation` (sends intent back to LLM), `open_url`. Form state tracked automatically.

### 3.6 Summary

| Aspect | Pattern |
|--------|---------|
| Catalog | `defineComponent` + `createLibrary` |
| Constraint | Prompt engineering + Zod validation |
| Spec format | Custom DSL (OpenUI Lang) |
| Streaming | Incremental re-parse with forward references |
| Interaction | `useTriggerAction` → `onAction` callback |
| Cross-platform | React only |

---

## 4. Streamlit / Gradio Pattern (Server-Driven UI)

**Source:** github.com/streamlit/streamlit, github.com/gradio-app/gradio

### 4.1 Approach

Python frameworks where server code IS the spec. Not AI-generated UI — developer-written UI that wraps AI functionality. Included for comparison of the "server produces spec, client renders" pattern.

### 4.2 Streamlit

**Spec format:** Protocol Buffers. Server sends `ForwardMsg` protos over WebSocket containing `Delta` messages (`new_element`, `add_block`, etc.).
**File:** `proto/streamlit/proto/ForwardMsg.proto`, `Delta.proto`, `Element.proto`

**Execution model:** Full-page rerun. Every interaction re-executes the entire Python script. Each `st.*` call emits a Delta proto. Stateless by design (session_state for persistence).

### 4.3 Gradio

**Spec format:** JSON. `BlocksConfig.get_config()` produces three parallel structures: flat components array (type, props, ID), layout tree (parent-child by ID), dependencies array (event handlers with input/output component IDs).
**File:** `gradio/blocks.py`

**Execution model:** Explicit event binding. `button.click(fn=process, inputs=[a,b], outputs=c)` wires events to Python functions. Streaming via generator `yield`. Queue system for concurrency.

### 4.4 Summary

| Aspect | Streamlit | Gradio |
|--------|-----------|--------|
| Spec format | Protocol Buffers | JSON (flat components + layout tree + dependencies) |
| Constraint | Fixed Python API | Fixed Python API |
| Streaming | Full rerun per interaction | Generator yields per function |
| Interaction | Rerun model (stateless) | Explicit event binding |
| Cross-platform | Web only | Web only |

---

## Comparative Analysis

### Constraint Mechanisms

| Project | How AI output is constrained | Validation |
|---------|------------------------------|------------|
| json-render | Catalog Zod schemas → prompt + JSON Schema + runtime validation | Triple: prompt instruction, structured output schema, runtime `catalog.validate()` |
| Vercel AI SDK | Tool definitions with Zod schemas | Structural: LLM can only select from fixed tool set |
| OpenUI | Catalog Zod schemas → generated prompt | Prompt instruction + partial parse tolerance |
| Streamlit/Gradio | N/A (developer-written, not AI-generated) | N/A |

### Streaming Patterns

| Project | Format | Progressive rendering |
|---------|--------|----------------------|
| json-render | RFC 6902 JSON Patch (JSONL) | Flat spec with key references; elements render as they arrive |
| Vercel AI SDK | React Suspense chains | Generator yields intermediate components |
| OpenUI | Custom DSL with forward references | Incremental re-parse; hoisted references resolve on arrival |
| Streamlit | Protobuf Deltas | Full rerun (no incremental) |
| Gradio | Generator yields | Output components update incrementally |

### Cross-Platform Capability

| Project | Platforms |
|---------|-----------|
| json-render | React, React Native, Vue, Svelte, SolidJS, PDF, Email, Image, Video, 3D |
| Vercel AI SDK | React Server Components only |
| OpenUI | React only |
| Streamlit/Gradio | Web only |

### Action/Interaction Models

| Project | Pattern | Chaining |
|---------|---------|----------|
| json-render | Predefined actions with `confirm`, `onSuccess`/`onError`, state mutations | Yes — action chains via onSuccess |
| Vercel AI SDK | Server Actions (manual) | No built-in |
| OpenUI | `useTriggerAction` → `onAction` callback | No built-in |
| Streamlit | Widget values in session_state, full rerun | N/A |
| Gradio | Explicit event binding with `.then()` chains | Yes |

### State Management

| Project | Pattern |
|---------|---------|
| json-render | Built-in state store (JSON Pointer paths) + pluggable adapters (Zustand, Redux, Jotai, XState) |
| Vercel AI SDK | AIState (serializable) + UIState (React nodes) |
| OpenUI | Renderer-managed form state + `initialState`/`onStateUpdate` props |
| Streamlit | `session_state` dict (rerun-persistent) |
| Gradio | Component values (no explicit state model) |

---

## Key Patterns Extracted

### Pattern 1: Catalog as Triple-Duty Contract (json-render)
A single Zod-based component catalog generates: (a) system prompts for text-mode LLMs, (b) JSON Schema for structured output APIs, (c) runtime validators. The catalog is the single source of truth for what the AI can produce, how it's instructed, and how output is validated.

**Source:** `packages/core/src/schema.ts`, functions `generatePrompt`, `buildZodSchemaFromDefinition`, `zodToJsonSchema`

### Pattern 2: Flat Spec with Key References (json-render)
A flat map of elements with string-key children references (not nested trees) enables streaming — elements can arrive in any order and the UI fills in progressively. RFC 6902 JSON Patch format for incremental assembly.

**Source:** `packages/core/src/types.ts`

### Pattern 3: Schema/Catalog Separation (json-render)
The **schema** defines the grammar (what shape specs take). The **catalog** defines the vocabulary (what components exist). Multiple catalogs can share one schema. This enables process-scoped catalogs (each process declares its output vocabulary) while sharing the structural grammar.

**Source:** `packages/core/src/schema.ts`, functions `defineSchema`, `defineCatalog`

### Pattern 4: Registry for Cross-Platform (json-render)
One catalog definition, N platform-specific registries. Each registry maps component names to native implementations. The type system ensures registries match their catalog. Catalog entries compose by spreading (reuse shadcn definitions + custom additions).

**Source:** `packages/react/src/renderer.tsx`, `packages/react-native/src/renderer.tsx`

### Pattern 5: Store Adapter Interface (json-render)
Three callbacks (`getSnapshot`, `setSnapshot`, `subscribe`) adapt any external state library. Core handles immutable updates, batching, no-op detection.

**Source:** `packages/core/src/state-store.ts`

### Pattern 6: Structural Constraint via Tool Selection (Vercel AI SDK)
LLM never generates markup — it selects tools and provides structured arguments. The tool's `generate` function produces the component. Invalid UI is structurally impossible. Simpler than catalog-based prompt generation but less flexible.

**Source:** `packages/rsc/src/stream-ui/stream-ui.tsx`

### Pattern 7: Token-Efficient Custom DSL (OpenUI)
A custom line-oriented DSL uses 52-67% fewer tokens than JSON for the same UI. Forward references enable streaming. Trade-off: custom parser, not a standard format.

**Source:** `packages/react-lang/src/parser/parser.ts`

### Pattern 8: MCP as Catalog Bridge (json-render)
The catalog becomes an MCP tool definition — `zodSchema()` is the tool input schema, `prompt()` is the tool description. The rendered UI is served as a `ui://` resource. This bridges the catalog pattern to any MCP-compatible AI system.

**Source:** `packages/mcp/src/server.ts`

---

## Gaps and Observations

1. **No project handles polymorphic output types.** All four focus exclusively on rendered UI. None has a concept of "this process might produce a rendered view OR a document OR an API call." This is Original to Ditto (Insight-066).

2. **No project handles output lifecycle (static vs dynamic).** json-render specs are inherently dynamic (state changes re-render). But there's no concept of "snapshot this spec as a static artifact" or "this output updates as the process progresses." The lifecycle dimension is Original to Ditto.

3. **No project connects outputs to trust/governance.** None has trust tiers governing what components are available or whether outputs can be delivered without review. Original to Ditto.

4. **No project handles output-as-interface-between-processes.** None has a concept of one process's output being another process's input contract. Original to Ditto.

5. **json-render's schema/catalog separation maps naturally to Ditto's process-scoped output schemas.** The schema (grammar) is shared; each process defines its own catalog (vocabulary). This is the closest existing pattern to what Insight-066 describes.

6. **json-render is the only project with meaningful cross-platform rendering.** If Ditto needs outputs to render on web, mobile, PDF, and email from a single definition, json-render is the only existing solution.

7. **The Vercel AI SDK approach (tool-based) is simpler but less expressive.** Good for conversational UI where the Self shows inline components. Not suitable for complex rendered views where the full spec needs to be inspectable, shareable, and renderable across surfaces.

8. **OpenUI's token efficiency is notable** but comes with the cost of a custom parser and non-standard format. json-render's JSON Patch approach is more standard and tooling-friendly.

9. **Gradio's flat-components-plus-layout-tree pattern** is structurally similar to json-render's flat spec with key references, arrived at independently for the same reason (server-driven rendering with a flat component model).

---

## Reference Docs

- Reference docs updated: `docs/landscape.md` (json-render and Impeccable entries added in prior Architect session)
- Reference docs checked: `docs/architecture.md` — ADR-009 (Runtime composable UI) still marked Proposed, no drift but will need reframing when output architecture is designed
