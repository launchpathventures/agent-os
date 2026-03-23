# Brief: Phase 6 — External Integrations (Parent Brief)

**Date:** 2026-03-21 (reconciled 2026-03-23 — Conversational Self alignment)
**Status:** draft
**Depends on:** Phase 5 complete (E2E verification). Conversational Self MVP complete (Briefs 028-030) — the Self is now the outermost invoker.
**Unlocks:** Non-coding domain processes (invoice, content, incident templates can connect to real systems)

## Goal

- **Roadmap phase:** Phase 6: External Integrations
- **Capabilities:** All 16 Phase 6 capabilities across 6 subsystems (integration registry, step executor extension, credential management, agent tool use, process I/O, harness integration)

## Context

Phase 5 proved the full work evolution cycle end-to-end. Three non-coding templates exist (invoice-follow-up, content-review, incident-response) but can't connect to external systems. Without integrations, Ditto can only run the dev pipeline. Phase 6 is the gateway to the outcome-owner audience — connecting processes to email, accounting, communication, and storage services.

ADR-005 (proposed) defines the integration architecture: multi-protocol (CLI, MCP, REST), two-purpose (agent tool use, process I/O), brokered credentials, all calls traverse harness. Research (`docs/research/external-integrations-architecture.md`) evaluated 7 options and 6 patterns. The design is ready to build.

The roadmap notes 16 capabilities across 6 subsystems — exceeding Insight-004's splitting heuristic. This parent brief shows how all pieces fit together. Three sub-briefs are the build instructions.

### Relationship to Conversational Self (ADR-016)

The Conversational Self (Briefs 028-030, complete) is the outermost harness ring — the entity the user talks to. The Self delegates to dev pipeline roles via `start_dev_role` tool_use, which creates process runs through the normal harness pipeline.

**Integration tools operate within delegated process runs, not at the Self level.** When the Self delegates to a builder role, the builder's process step may have a `tools: [github]` declaration. The harness resolves those tools at assembly time and injects them into the adapter. The Self never sees per-step tool declarations — it delegates coarsely (entire roles), and the harness handles fine-grained tool control within those roles.

This means:
- **Agent tool use (Brief 025):** Tools are declared per-step in process YAMLs, resolved by the harness, injected into adapters. The Self's delegation model is orthogonal.
- **Credentials (Brief 026):** Scoped per-process per-service. The Self creates process runs with a processId; credential resolution uses that processId. No Self-level credential threading needed.
- **Process I/O (Brief 026):** External triggers create process runs via the capture pipeline. The Self sees all runs through its work state summary (`loadWorkStateSummary`). Trigger-spawned runs are distinguished by `triggeredBy` field.

## ADR-005 Follow-Up Decisions (resolved here)

ADR-005 left 6 follow-up decisions open. Resolved:

| Decision | Resolution | Rationale |
|---|---|---|
| Credential platform | Build minimal (encrypted file-based vault). Evaluate Nango/Composio after Phase 6 proves the pattern. | Composition principle — but credential management is security-critical. Minimal-first, upgrade later. |
| Registry format | YAML files in `integrations/` directory (like process definitions). Git-tracked per Insight-007. | Consistent with existing patterns. Database-backed adds complexity without Phase 6 benefit. |
| Error handling | Retry with exponential backoff (3 attempts, 1s/2s/4s). After max retries → step fails → harness retry_on_failure handles it. | Reuses existing retry infrastructure (Brief 016b). No new retry mechanism. |
| Testing in CI | Mock protocol handlers in tests (same pattern as Anthropic SDK mock). Integration tests use `nock` for HTTP. | Consistent with existing test infrastructure (Brief 017). Real credentials never in CI. |
| Trust gate + synchronous tool calls | Tool calls during agent execution: trust gate evaluates the step output, not individual tool calls. The agent's reasoning loop is atomic from the harness perspective. Write operations are flagged in the output for review. | Intercepting every tool call mid-reasoning would break the agent's flow. The trust gate evaluates the completed output, which includes a log of all tool calls made. |
| ADR-005 status | Accept ADR-005 as part of Phase 6a (Brief 023). | It's been validated by research and is now being built. |

## Design: How the Pieces Fit Together

```
┌──────────────────────────────────────────────────────────────┐
│  CONVERSATIONAL SELF (outermost ring, ADR-016)                │
│  Delegates to roles via tool_use → creates process runs       │
│  Does NOT see per-step tools — delegates coarsely             │
└──────────────────────┬───────────────────────────────────────┘
                       │ startProcessRun() + fullHeartbeat()
                       ▼
                      ┌─────────────────────────┐
                      │  Integration Registry     │
                      │  integrations/*.yaml      │
                      │  Service → protocols      │
                      └──────────┬────────────────┘
                                 │
                    ┌────────────┼────────────────┐
                    │            │                 │
               ┌────▼───┐  ┌────▼───┐        ┌───▼────┐
               │  CLI   │  │  MCP   │        │  REST  │
               │Handler │  │Handler │        │Handler │
               └────┬───┘  └────┬───┘        └───┬────┘
                    │            │                 │
                    └────────────┼─────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Integration Executor        │
                    │  Resolves service + protocol │
                    │  Brokers credentials         │
                    └────────────┬────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
     ┌────────▼────────┐  ┌─────▼──────┐   ┌───────▼───────┐
     │ Agent Tool Use   │  │ Integration│   │  Process I/O   │
     │ (step-level      │  │ Steps      │   │  (triggers,    │
     │  tools: field)   │  │ (executor: │   │   sources,     │
     │                  │  │integration)│   │   destinations) │
     └─────────────────┘  └────────────┘   └───────────────┘
              │                  │                   │
              └──────────────────┼───────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Harness Pipeline            │
                    │  Trust gate, audit, feedback  │
                    └─────────────────────────────┘
```

## Sub-Brief Dependency Chain

```
Brief 024: Integration Foundation + CLI ──→ Brief 025: MCP + Agent Tool Use ──→ Brief 026: Credentials + Process I/O
         (registry, executor, CLI,                (MCP handler, tools: field,         (vault, sources,
          harness integration, logging)            tool resolution, permissions)        destinations, triggers)
          ✓ COMPLETE                               READY                               READY
```

**Note:** The Conversational Self (Briefs 028-030, complete) runs in parallel. Phase 6 sub-briefs add integration capabilities that delegated process runs use through the normal harness pipeline. The Self does not block or change integration plumbing.

| Sub-brief | Scope | AC count | Key deliverable |
|---|---|---|---|
| **024** (complete) | Registry + loader + integration executor + CLI handler + harness logging | 13 | End-to-end integration proof: `gh` CLI via integration executor |
| **025** | MCP handler + REST handler + step-level tools + tool resolution + permissions | 14 | Agent invokes MCP tools during step execution |
| **026** | Credential vault + scoped credentials + process I/O (sources, destinations, triggers) | 13 | Process triggers from external events, outputs delivered externally |

## Non-Goals

- Nango or Composio adoption (evaluate after Phase 6 proves the minimal pattern)
- Data sync/caching layer (Insight-010 — deferred, separate from tool use and process I/O)
- Agent-to-Agent protocol (A2A — nascent standard, not production-ready)
- Webhook infrastructure (Brief 025 implements minimal trigger; full webhook server is Phase 7+)
- Web dashboard integration UI (Phase 10)

## Security Implications

- **Credentials never in agent context** — harness brokers all external calls
- **Per-process scoping** — credential access isolated by process (per-agent scoping deferred to Phase 12 multi-tenancy)
- **All external calls audited** — logged in activity table with actor, target, timestamp
- **Trust-gated output delivery** — outputs only delivered after trust gate approval
- **Encrypted credential storage** — even at rest, credentials are encrypted
- **No credentials in CI** — mock protocol handlers for testing

## Layer Impact

| Layer | What changes |
|---|---|
| **Self (outermost ring)** | No direct changes. The Self delegates to process runs that use integrations. The Self sees integration activity through `loadWorkStateSummary()`. Trigger-spawned runs appear in work state with `triggeredBy: "trigger"`. |
| **L1 (Process)** | Process definitions gain `tools:` per-step, `source:`, `trigger:`, `destination:` at process level. `integrations/` directory for registry files. |
| **L2 (Agent)** | Step executor gains `integration` type (done, Brief 024). Three protocol handlers. Credential resolution at dispatch. Tool schemas injected into adapter context via `HarnessContext.resolvedTools`. |
| **L3 (Harness)** | Memory-assembly handler resolves `tools:` field → tool schemas. Integration calls logged as activities. Trust gate evaluates integration step outputs including tool call log. |
| **L4 (Awareness)** | External triggers create work items (process I/O). Trigger logging. |
| **L5 (Learning)** | Integration call success/failure captured as feedback signal. |
| **L6 (Human)** | CLI: integration status in `aos status`. Conversational Self: surfaces triggered runs conversationally. Future: Process Builder shows available integrations. |

## After Completion

1. ADR-005 status → accepted
2. Update roadmap Phase 6 items to done
3. Non-coding templates can be connected to real systems
4. Evaluate whether Nango/Composio adoption is warranted based on credential management experience
5. Phase 7 (Awareness) re-entry condition closer: integration triggers create process dependency events
