# Research: Phase 2 Harness Patterns

**Date:** 2026-03-19
**Researcher:** Dev Researcher session (conversation)
**Phase:** Phase 2 (Harness + Feedback Capture)
**Status:** active

## Research Question

What existing patterns can Agent OS build from for Phase 2 — harness middleware pipeline, review patterns, trust enforcement, parallel execution, feedback recording, and heartbeat rewrite?

## Sources Examined

| Project | Why included |
|---------|-------------|
| antfarm (snarktank/antfarm) | Architecture spec borrows verification gates, YAML+SQLite+cron pattern |
| Paperclip (paperclipai/paperclip) | Architecture spec borrows heartbeat, adapters, budget controls, audit trail |
| Sim Studio (simstudioai/sim) | Landscape doc rates HIGH for execution patterns (handler registry, snapshot/resume) |
| Open SWE (langchain-ai/open-swe) | Landscape doc identifies harness patterns (safety-net middleware, agent assembly) |
| Mastra (mastra-ai/mastra) | Landscape doc rates HIGH for Layers 1-3 (parallel, suspend/resume) |
| Trigger.dev (triggerdotdev/trigger.dev) | Landscape doc rates HIGH for Layer 2 (waitpoint tokens, durable execution) |
| Inngest (inngest/inngest) | Landscape doc rates HIGH for step-based execution (AgentKit, event triggers) |

## Findings

### 1. Harness as Middleware Pipeline

| Option | Source | File | How it works |
|--------|--------|------|-------------|
| **Chain-of-responsibility handlers** | Sim Studio | `apps/sim/executor/handlers/registry.ts`, `apps/sim/executor/types.ts` | Ordered array of 14 `BlockHandler` objects with `canHandle()` + `execute()`. First match wins. `GenericBlockHandler` is catch-all. New type = one class + one array entry. |
| **Middleware decorators at 4 points** | Open SWE | `agent/middleware/open_pr.py`, `agent/middleware/ensure_no_empty_msg.py`, `agent/middleware/tool_error_handler.py` | `@before_model`, `@after_model`, `@after_agent`, `wrap_tool_call`. Safety nets, message injection, error handling as separate middleware. |
| **Single-function agent assembly** | Open SWE | `agent/server.py` (`get_agent()`) | Composes sandbox + auth + repo + prompt + tools + middleware into runnable agent. Fresh per invocation. |
| **Workflow lifecycle callbacks** | Mastra | `packages/core/src/workflows/execution-engine.ts` | `onFinish`/`onError` callbacks on workflow. No step-level middleware — the `ExecutionEngine` abstract class is the extensibility seam. |

**Gap:** No source combines review patterns + trust tiers + feedback recording as composable pipeline. **Original to Agent OS.**

### 2. Review Patterns

| Option | Source | File | How it works |
|--------|--------|------|-------------|
| **verify_each + verify_step** | antfarm | `src/installer/step-ops.ts` lines 728-845 | Loop stays `running`, verify step becomes `pending`. Verifier outputs `STATUS: done` (pass) or `STATUS: retry` (fail). Retry resets story to `pending`, injects `{{verify_feedback}}`. Per-story retry tracking with configurable max. |
| **on_fail.retry_step** | antfarm | Workflow YAML `on_fail` config, `src/installer/step-ops.ts` `failStep()` | Failing verify step names a different step to re-run. Feedback via shared context dict. |
| **Role-based access control** | antfarm | `src/installer/workflow-spec.ts` | `verification` role strips write permissions. Six roles total. Verifier cannot modify what it reviews. |
| **Approval lifecycle** | Paperclip | `server/src/services/approvals.ts` | Generic: `pending` → `approved`/`rejected`/`revision_requested` → resubmit. Typed payloads. Comments per approval. |
| **Quality gate (dev↔QA retries)** | agency-agents | NEXUS framework handoff templates | Handoff contracts between dev and QA with max retries and escalation. Pattern only (prompt library, no runtime). |

**On adversarial review (revised):** antfarm's verifier is prompted to find issues and return `STATUS: retry` with `ISSUES:` output. Structurally maker-checker but prompting approaches adversarial. The gap between antfarm and architecture.md's "adversarial review" (line 219) is smaller than initially classified — adversarial is a prompting strategy on top of maker-checker structure.

**Gaps:** Specification testing (validating against defined criteria programmatically) and ensemble consensus (multiple agents produce independently, compare) — **Original to Agent OS.**

### 3. Trust Tier Enforcement

| Option | Source | File | How it works |
|--------|--------|------|-------------|
| **Budget gating (pre-invocation block)** | Paperclip | `server/src/services/budgets.ts` `getInvocationBlock()` | Checks company → agent → project policies before every run. Returns block reason or proceeds. |
| **Scope-based pause/cancel** | Paperclip | `server/src/services/budgets.ts` `pauseAndCancelScopeForBudget()` | Hard stop pauses scope, cancels active runs, creates approval record. |
| **Suspend/resume for HITL** | Mastra | `packages/core/src/workflows/step.ts`, `packages/core/src/workflows/handlers/step.ts` line ~341 | Step calls `suspend(payload?)`, engine snapshots state. Resume via `run.resume({ step, resumeData })`. Named labels for multi-point suspend. State persisted via `persistWorkflowSnapshot`/`loadWorkflowSnapshot`. |
| **Waitpoint tokens** | Trigger.dev | `internal-packages/run-engine/src/engine/systems/waitpointSystem.ts`, `packages/trigger-sdk/src/v3/wait.ts` | Create token → suspend run (CRIU checkpoint) → complete via SDK, HTTP webhook, or React hook. Zero compute during wait. |
| **Human step gate** | Current Agent OS | `src/engine/heartbeat.ts` lines 110-137 | Steps with `executor: "human"` pause the run. |

**Gap:** Graduated trust tiers (supervised/spot-checked/autonomous/critical) with percentage-based review sampling and earned trust — **Original to Agent OS.** Mastra suspend and Trigger.dev waitpoints provide the *mechanism* for pausing; neither implements the *policy* layer deciding when to pause.

### 4. Parallel Execution

| Option | Source | File | How it works |
|--------|--------|------|-------------|
| **`.parallel()` DSL** | Mastra | `packages/core/src/workflows/workflow.ts` line ~1790, `packages/core/src/workflows/handlers/control-flow.ts` `executeParallel` line 59 | Fluent: `.parallel([step1, step2, step3]).then(combineStep)`. Uses `Promise.all`. Results merged into `{ [stepId]: output }`. If any branch fails/suspends, entire block fails/suspends. |
| **Queue-based concurrent runs** | Paperclip | `server/src/services/heartbeat.ts` `startNextQueuedRunForAgent()` | `maxConcurrentRuns` per agent (default 1, max 10). In-memory promise-chain lock. Concurrency *across* runs, not within. |
| **Parallel snapshot state** | Sim Studio | `apps/sim/executor/execution/snapshot-serializer.ts` | `parallelExecutions` map serialized in snapshot. `ParallelResolver` (`apps/sim/executor/variables/resolvers/parallel.ts`) provides branch context. |
| **Variable resolver chain** | Sim Studio | `apps/sim/executor/variables/resolver.ts`, resolvers in `apps/sim/executor/variables/resolvers/` | 5-resolver chain: Loop → Parallel → Workflow → Env → Block. Handles data flow in/out of parallel branches. |
| **Batch triggering** | Trigger.dev | Docs: `docs/guides/ai-agents/overview.mdx` | `batch.triggerByTaskAndWait` for concurrent task execution. |
| **Multi-agent network** | Inngest AgentKit | `packages/agent-kit/src/network.ts` | Router selects next agent, sequential by default. Tools within agents can use `step.run()` for concurrent operations. |

**Gap:** Within-run `parallel_group` with `depends_on` resolution as a process-level construct — **Original to Agent OS.** Mastra's `.parallel()` is closest structural reference.

### 5. Feedback Recording

| Option | Source | File | How it works |
|--------|--------|------|-------------|
| **Centralized activity log** | Paperclip | `server/src/services/activity-log.ts` | Single `logActivity()` function. Fields: actorType (agent/user/system), action, entityType, entityId, details. PII sanitization. WebSocket push + plugin event bus. |
| **Cost event ledger** | Paperclip | `server/src/services/costs.ts` | Event-sourced: `createEvent()` updates denormalized counters, triggers budget evaluation. Aggregations: by agent, provider, project, model, rolling windows. |
| **Run events** | Paperclip | `heartbeatRunEvents` table | Per-run event stream: seq, eventType, stream, level, message. |
| **Step memoization** | Inngest | `pkg/execution/state/opcode.go` | Every step result stored by hashed ID. Full execution history server-side. |

**Gap:** Recording *harness decisions* specifically (review pattern applied, trust tier active, sample/auto-approve, human approve/edit/reject with implicit feedback from edits) — **Original to Agent OS.**

### 6. Heartbeat Rewrite

The current heartbeat (`src/engine/heartbeat.ts`) has three problems: auto-approves everything (line 165), no harness integration, no parallel execution.

| Pattern | Source | File | How it maps |
|---------|--------|------|-------------|
| **Queue-based wake/execute/sleep** | Paperclip | `server/src/services/heartbeat.ts` | `wakeupRequest` → `heartbeatRun` (queued) → claim with lock → budget gate → execute → finalize. Queue promotion on completion. Orphan reaping. |
| **SQLite state machine** | antfarm | `src/installer/step-ops.ts` | 6 statuses: waiting → pending → running → done/failed/skipped. All orchestration via DB transitions. Crash-recoverable. |
| **Execution snapshot for pause/resume** | Sim Studio | `apps/sim/executor/execution/snapshot.ts`, `snapshot-serializer.ts` | Full state serialized to JSON: blockStates, executedBlocks, decisions, loops, parallels. `toJSON()`/`fromJSON()` round-trip. |
| **Workflow snapshot persistence** | Mastra | `packages/core/src/storage/domains/workflows/base.ts` | `WorkflowRunState`: serializedStepGraph, activePaths, suspendedPaths, waitingPaths, per-step results. |
| **Memoization + replay** | Inngest | `pkg/execution/state/opcode.go`, `docs/SDK_SPEC.md` | Stateless SDK, server replays from top. Completed steps return cached results. Alternative to snapshot. |
| **Mid-run message injection** | Open SWE | `agent/middleware/check_message_queue.py` (reader), `agent/webapp.py` (writer) | `@before_model` reads queued messages, injects as human messages. Delete-before-process prevents duplicates. |
| **Concurrency control** | Paperclip | `server/src/services/heartbeat.ts` `withAgentStartLock()` | In-memory promise-chain per agent. `maxConcurrentRuns` from config. |
| **Orphan/abandoned recovery** | Paperclip + antfarm | Both heartbeat services | Detect stuck runs, reset or fail them. Paperclip: `reapOrphanedRuns()`. antfarm: throttled cleanup every 5 min. |

### 7. Agent Permission Checks

*Reviewer flagged this as a gap in v1. Partially addressed:*

| Pattern | Source | File |
|---------|--------|------|
| **Role-based tool access** | antfarm | `src/installer/workflow-spec.ts` | Six agent roles control tool access. `verification` role strips write permissions. |
| **Scoped permissions per approval type** | Paperclip | `server/src/services/approvals.ts` | Approval types gate what agents can do (hire, budget override). |

**Gap:** Per-agent, per-process permission scoping as defined in architecture.md (line 164: "Permissions: what this agent can read, write, execute, approve") — needs further research or mark as **Original.**

## Deferred Infrastructure Confirmation

Confirms Mastra, Trigger.dev, Inngest, Temporal should remain deferred for Phase 2:

| Framework | Why defer | Patterns to adopt without the dependency |
|-----------|-----------|----------------------------------------|
| **Mastra** | Adopting = adopting its workflow DSL, replacing our process model. No step-level middleware. | `Promise.all` + merged results for parallel_group. Suspend/resume snapshot structure. |
| **Trigger.dev** | Requires Docker for CRIU checkpointing. Infrastructure we don't have. | Waitpoint concept (create → suspend → complete via signal) for trust-tier pausing. |
| **Inngest** | Requires Inngest server. SSPL license. Architecturally different (replay vs snapshot). | Memoization concept for step result caching. AgentKit router pattern for future multi-agent. |
| **Temporal** | Requires Java server. Overkill for dogfood. | Activity heartbeats concept if enterprise reliability needed. |

## Gaps (Original to Agent OS)

1. Composable harness pipeline combining review + trust + feedback
2. Specification testing (validating against defined criteria)
3. Ensemble consensus (multiple agents produce, compare)
4. Graduated trust tiers with percentage-based sampling and earned trust
5. Within-run parallel_group with depends_on
6. Harness decision recording (distinct from agent output feedback)
7. Per-agent per-process permission scoping (partial — needs more research)

## Review

**v1 verdict:** REVISE — three major findings (missing Mastra/Trigger.dev/Inngest, missing file paths, missing heartbeat section).

**v2 verdict:** APPROVE — all prior majors resolved. One new major (agent permission checks not covered). Three minors (harness decision recording thin, escalation rules absent, landscape patterns not fully cross-referenced). Reviewer recommended handoff to architect with caveat on permission patterns.
