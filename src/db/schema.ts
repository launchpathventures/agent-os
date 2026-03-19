/**
 * Agent OS — Core Database Schema (SQLite via Drizzle)
 *
 * The data model for the six-layer architecture.
 * Process is the primitive — everything else serves processes.
 *
 * Provenance: Drizzle SQLite patterns from remuspoienar/bun-elysia-drizzle-sqlite,
 * zero-setup pattern from snarktank/antfarm /src/db.ts
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

// ============================================================
// Type unions (replacing pgEnum)
// ============================================================

export const processStatusValues = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;
export type ProcessStatus = (typeof processStatusValues)[number];

export const trustTierValues = [
  "supervised",
  "spot_checked",
  "autonomous",
  "critical",
] as const;
export type TrustTier = (typeof trustTierValues)[number];

export const runStatusValues = [
  "queued",
  "running",
  "waiting_review",
  "approved",
  "rejected",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof runStatusValues)[number];

export const stepExecutorValues = [
  "ai-agent",
  "script",
  "rules",
  "human",
  "handoff",
] as const;
export type StepExecutor = (typeof stepExecutorValues)[number];

export const feedbackTypeValues = [
  "approve",
  "edit",
  "reject",
  "escalate",
  "auto_approve",
] as const;
export type FeedbackType = (typeof feedbackTypeValues)[number];

export const agentStatusValues = [
  "idle",
  "running",
  "error",
  "disabled",
] as const;
export type AgentStatus = (typeof agentStatusValues)[number];

export const improvementStatusValues = [
  "proposed",
  "approved",
  "dismissed",
  "implemented",
] as const;
export type ImprovementStatus = (typeof improvementStatusValues)[number];

// ============================================================
// Layer 1: Process Layer
// ============================================================

/** Process definitions — the atomic unit of Agent OS */
export const processes = sqliteTable("processes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().$type<ProcessStatus>().default("draft"),

  // The full process definition (parsed from YAML)
  definition: text("definition", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),

  // Trust configuration
  trustTier: text("trust_tier")
    .notNull()
    .$type<TrustTier>()
    .default("supervised"),
  trustData: text("trust_data", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),

  // What project/org this belongs to
  projectId: text("project_id"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Process dependencies — the awareness layer graph */
export const processDependencies = sqliteTable("process_dependencies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  sourceProcessId: text("source_process_id")
    .references(() => processes.id)
    .notNull(),
  targetProcessId: text("target_process_id")
    .references(() => processes.id)
    .notNull(),
  outputName: text("output_name").notNull(),
  inputName: text("input_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Layer 2: Agent Layer
// ============================================================

/** Agent definitions — the workforce */
export const agents = sqliteTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  role: text("role").notNull(),
  description: text("description"),
  status: text("status").notNull().$type<AgentStatus>().default("idle"),

  // Adapter configuration
  adapterType: text("adapter_type").notNull(),
  adapterConfig: text("adapter_config", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>()
    .default({}),

  // Budget
  monthlyBudgetCents: integer("monthly_budget_cents"),
  currentSpendCents: integer("current_spend_cents").notNull().default(0),
  budgetResetAt: integer("budget_reset_at", { mode: "timestamp_ms" }),

  // Performance
  totalRuns: integer("total_runs").notNull().default(0),
  successRate: real("success_rate"),

  // Agent identity (governance readiness — Phase 1 brief requirement)
  ownerId: text("owner_id"),
  organisationId: text("organisation_id"),
  permissions: text("permissions", { mode: "json" }).$type<
    Record<string, unknown>
  >(),
  provenance: text("provenance"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Process Runs — execution instances
// ============================================================

/** A single execution of a process */
export const processRuns = sqliteTable("process_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  processId: text("process_id")
    .references(() => processes.id)
    .notNull(),
  status: text("status").notNull().$type<RunStatus>().default("queued"),

  // What triggered this run
  triggeredBy: text("triggered_by").notNull(),

  // Input data for this run
  inputs: text("inputs", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),

  // Current step
  currentStepId: text("current_step_id"),

  // Timing
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),

  // Cost tracking
  totalTokens: integer("total_tokens").default(0),
  totalCostCents: integer("total_cost_cents").default(0),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Individual step executions within a run */
export const stepRuns = sqliteTable("step_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  processRunId: text("process_run_id")
    .references(() => processRuns.id)
    .notNull(),
  stepId: text("step_id").notNull(),
  agentId: text("agent_id").references(() => agents.id),

  status: text("status").notNull().$type<RunStatus>().default("queued"),
  executorType: text("executor_type").notNull().$type<StepExecutor>(),

  // Input/output for this step
  inputs: text("inputs", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),
  outputs: text("outputs", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),

  // Execution details
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  tokensUsed: integer("tokens_used").default(0),
  costCents: integer("cost_cents").default(0),
  error: text("error"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Layer 3: Harness Layer — outputs and review
// ============================================================

/** Outputs produced by process runs, waiting for review or delivered */
export const processOutputs = sqliteTable("process_outputs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  processRunId: text("process_run_id")
    .references(() => processRuns.id)
    .notNull(),
  stepRunId: text("step_run_id").references(() => stepRuns.id),

  name: text("name").notNull(),
  type: text("type").notNull(),

  // The actual output content
  content: text("content", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  contentUrl: text("content_url"),

  // Review state
  needsReview: integer("needs_review", { mode: "boolean" })
    .notNull()
    .default(true),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  reviewedBy: text("reviewed_by"),

  // Confidence
  confidenceScore: real("confidence_score"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Layer 5: Learning Layer — feedback
// ============================================================

/** Feedback on outputs — the learning signal */
export const feedback = sqliteTable("feedback", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  outputId: text("output_id")
    .references(() => processOutputs.id)
    .notNull(),
  processId: text("process_id")
    .references(() => processes.id)
    .notNull(),

  type: text("type").notNull().$type<FeedbackType>(),

  // What changed (for edits)
  diff: text("diff", { mode: "json" }).$type<Record<string, unknown>>(),
  comment: text("comment"),

  // Correction pattern (extracted by learning engine)
  correctionPattern: text("correction_pattern"),
  patternConfidence: real("pattern_confidence"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Improvement proposals from the learning layer */
export const improvements = sqliteTable("improvements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  processId: text("process_id")
    .references(() => processes.id)
    .notNull(),

  status: text("status")
    .notNull()
    .$type<ImprovementStatus>()
    .default("proposed"),

  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  estimatedImpact: text("estimated_impact"),
  estimatedEffort: text("estimated_effort"),
  risk: text("risk"),
  confidence: real("confidence"),

  // Decision tracking
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  decidedBy: text("decided_by"),
  decisionComment: text("decision_comment"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Capture — quick input from humans
// ============================================================

/** Quick captures — tasks, context, notes from humans */
export const captures = sqliteTable("captures", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),

  content: text("content").notNull(),
  type: text("type").notNull().default("note"),

  // Auto-classification
  projectId: text("project_id"),
  processId: text("process_id").references(() => processes.id),
  classified: integer("classified", { mode: "boolean" })
    .notNull()
    .default(false),

  // Source
  source: text("source").notNull().default("manual"),

  // Metadata
  metadata: text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Activity Feed — audit trail
// ============================================================

/** Activity log — everything that happens */
export const activities = sqliteTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),

  // What happened
  action: text("action").notNull(),
  description: text("description"),

  // Who/what did it
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),

  // What it relates to (polymorphic)
  entityType: text("entity_type"),
  entityId: text("entity_id"),

  // Additional data
  metadata: text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({}),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
