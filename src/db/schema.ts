/**
 * Agent OS — Core Database Schema
 *
 * The data model for the six-layer architecture.
 * Process is the primitive — everything else serves processes.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uuid,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";

// ============================================================
// Enums
// ============================================================

export const processStatusEnum = pgEnum("process_status", [
  "draft", // Being defined
  "active", // Running
  "paused", // Temporarily stopped
  "archived", // No longer in use
]);

export const trustTierEnum = pgEnum("trust_tier", [
  "supervised", // Human reviews every output
  "spot_checked", // Human reviews ~20% sample
  "autonomous", // Exception-only review
  "critical", // Always full review, never upgrades
]);

export const runStatusEnum = pgEnum("run_status", [
  "queued", // Waiting to execute
  "running", // Currently executing
  "waiting_review", // Output produced, waiting for human
  "approved", // Human approved
  "rejected", // Human rejected
  "failed", // Execution error
  "cancelled", // Manually cancelled
]);

export const stepExecutorEnum = pgEnum("step_executor", [
  "ai_agent", // AI agent (Claude, GPT, etc.)
  "script", // Deterministic script/command
  "rules", // Rules engine
  "human", // Human action required
  "handoff", // Hand off to another process
]);

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "approve", // Output approved as-is
  "edit", // Output edited then approved (diff captured)
  "reject", // Output rejected
  "escalate", // Escalated to human/analyst
  "auto_approve", // Auto-approved by trust tier
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "idle", // Not currently executing
  "running", // Executing a step
  "error", // In error state
  "disabled", // Manually disabled
]);

export const improvementStatusEnum = pgEnum("improvement_status", [
  "proposed", // Waiting for human decision
  "approved", // Human approved — pending implementation
  "dismissed", // Human dismissed
  "implemented", // Applied and verified
]);

// ============================================================
// Layer 1: Process Layer
// ============================================================

/** Process definitions — the atomic unit of Agent OS */
export const processes = pgTable("processes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  status: processStatusEnum("status").notNull().default("draft"),

  // The full process definition (parsed from YAML)
  definition: jsonb("definition").notNull(),

  // Trust configuration
  trustTier: trustTierEnum("trust_tier").notNull().default("supervised"),
  trustData: jsonb("trust_data").default({}), // Earned trust metrics

  // What project/org this belongs to
  projectId: text("project_id"), // e.g., "delta", "insurance"

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Process dependencies — the awareness layer graph */
export const processDependencies = pgTable("process_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceProcessId: uuid("source_process_id")
    .references(() => processes.id)
    .notNull(),
  targetProcessId: uuid("target_process_id")
    .references(() => processes.id)
    .notNull(),
  outputName: text("output_name").notNull(), // Which output connects them
  inputName: text("input_name").notNull(), // Which input receives it
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Layer 2: Agent Layer
// ============================================================

/** Agent definitions — the workforce */
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull(), // e.g., "planner", "builder", "reviewer"
  description: text("description"),
  status: agentStatusEnum("status").notNull().default("idle"),

  // Adapter configuration
  adapterType: text("adapter_type").notNull(), // "claude", "script", "http"
  adapterConfig: jsonb("adapter_config").notNull().default({}),

  // Budget
  monthlyBudgetCents: integer("monthly_budget_cents"), // null = unlimited
  currentSpendCents: integer("current_spend_cents").notNull().default(0),
  budgetResetAt: timestamp("budget_reset_at"),

  // Performance
  totalRuns: integer("total_runs").notNull().default(0),
  successRate: real("success_rate"), // 0-1

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Process Runs — execution instances
// ============================================================

/** A single execution of a process */
export const processRuns = pgTable("process_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .references(() => processes.id)
    .notNull(),
  status: runStatusEnum("status").notNull().default("queued"),

  // What triggered this run
  triggeredBy: text("triggered_by").notNull(), // "schedule", "manual", "event:{id}"

  // Input data for this run
  inputs: jsonb("inputs").default({}),

  // Current step
  currentStepId: text("current_step_id"),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Cost tracking
  totalTokens: integer("total_tokens").default(0),
  totalCostCents: integer("total_cost_cents").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Individual step executions within a run */
export const stepRuns = pgTable("step_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  processRunId: uuid("process_run_id")
    .references(() => processRuns.id)
    .notNull(),
  stepId: text("step_id").notNull(), // Matches step.id in process definition
  agentId: uuid("agent_id").references(() => agents.id), // null for human/script steps

  status: runStatusEnum("status").notNull().default("queued"),
  executorType: stepExecutorEnum("executor_type").notNull(),

  // Input/output for this step
  inputs: jsonb("inputs").default({}),
  outputs: jsonb("outputs").default({}),

  // Execution details
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  tokensUsed: integer("tokens_used").default(0),
  costCents: integer("cost_cents").default(0),
  error: text("error"), // Error message if failed

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Layer 3: Harness Layer — outputs and review
// ============================================================

/** Outputs produced by process runs, waiting for review or delivered */
export const processOutputs = pgTable("process_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  processRunId: uuid("process_run_id")
    .references(() => processRuns.id)
    .notNull(),
  stepRunId: uuid("step_run_id").references(() => stepRuns.id),

  name: text("name").notNull(), // Output name from process definition
  type: text("type").notNull(), // "text", "code", "data", "visual", "decision", "action"

  // The actual output content
  content: jsonb("content").notNull(), // Flexible — diff, text, structured data, etc.
  contentUrl: text("content_url"), // For large outputs stored externally

  // Review state
  needsReview: boolean("needs_review").notNull().default(true),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"), // "human" or "auto:{trust_tier}"

  // Confidence
  confidenceScore: real("confidence_score"), // 0-1, agent's self-assessed confidence

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Layer 5: Learning Layer — feedback
// ============================================================

/** Feedback on outputs — the learning signal */
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  outputId: uuid("output_id")
    .references(() => processOutputs.id)
    .notNull(),
  processId: uuid("process_id")
    .references(() => processes.id)
    .notNull(),

  type: feedbackTypeEnum("type").notNull(),

  // What changed (for edits)
  diff: jsonb("diff"), // Before/after for edited outputs
  comment: text("comment"), // Human explanation (optional)

  // Correction pattern (extracted by learning engine)
  correctionPattern: text("correction_pattern"), // e.g., "tone_too_casual", "missing_edge_case"
  patternConfidence: real("pattern_confidence"), // 0-1

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Improvement proposals from the learning layer */
export const improvements = pgTable("improvements", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .references(() => processes.id)
    .notNull(),

  status: improvementStatusEnum("status").notNull().default("proposed"),

  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: jsonb("evidence").notNull(), // Data supporting the proposal
  estimatedImpact: text("estimated_impact"),
  estimatedEffort: text("estimated_effort"),
  risk: text("risk"),
  confidence: real("confidence"), // 0-1

  // Decision tracking
  decidedAt: timestamp("decided_at"),
  decidedBy: text("decided_by"),
  decisionComment: text("decision_comment"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Capture — quick input from humans
// ============================================================

/** Quick captures — tasks, context, notes from humans */
export const captures = pgTable("captures", {
  id: uuid("id").primaryKey().defaultRandom(),

  content: text("content").notNull(), // Raw text, transcription, etc.
  type: text("type").notNull().default("note"), // "task", "note", "context", "bug"

  // Auto-classification
  projectId: text("project_id"), // Which project this belongs to
  processId: uuid("process_id").references(() => processes.id), // Which process, if any
  classified: boolean("classified").notNull().default(false),

  // Source
  source: text("source").notNull().default("manual"), // "manual", "voice", "email", "slack"

  // Metadata
  metadata: jsonb("metadata").default({}), // Attachments, URLs, etc.

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Activity Feed — audit trail
// ============================================================

/** Activity log — everything that happens */
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),

  // What happened
  action: text("action").notNull(), // "process.run.started", "output.reviewed", "agent.error", etc.
  description: text("description"),

  // Who/what did it
  actorType: text("actor_type").notNull(), // "agent", "human", "system"
  actorId: text("actor_id"), // Agent ID, user ID, or "system"

  // What it relates to (polymorphic)
  entityType: text("entity_type"), // "process", "run", "output", "agent", "capture"
  entityId: text("entity_id"),

  // Additional data
  metadata: jsonb("metadata").default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
