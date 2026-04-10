/**
 * Ditto — Self Tools: Operating Cycle Management
 *
 * Five cycle management tools for the Conversational Self:
 * - activate_cycle: Start a continuous operating cycle with user config
 * - pause_cycle: Pause a running cycle
 * - resume_cycle: Resume a paused cycle
 * - cycle_briefing: Generate standardised handoff briefing
 * - cycle_status: Per-cycle pipeline view
 *
 * Users never see cycles, phases, or YAML. They say "help me fill my pipeline"
 * and Alex starts operating. These tools are the bridge.
 *
 * Provenance: Brief 118, Insight-168 (archetype), Insight-169 (capability surface)
 */

import { db, schema } from "../../db";
import type { RunStatus } from "../../db/schema";
import { eq, and, desc, inArray, notInArray, sql } from "drizzle-orm";
import type { DelegationResult } from "../self-delegation";
import { startProcessRun } from "../heartbeat";

// ============================================================
// Types
// ============================================================

/** Valid cycle types that map to cycle YAML definitions in processes/cycles/ */
const CYCLE_TYPES = ["sales-marketing", "network-connecting", "relationship-nurture"] as const;
export type CycleType = (typeof CYCLE_TYPES)[number];

/** Cycle slug mapping: cycle type → process slug (from processes/cycles/*.yaml) */
const CYCLE_SLUG_MAP: Record<CycleType, string> = {
  "sales-marketing": "sales-marketing-cycle",
  "network-connecting": "network-connecting-cycle",
  "relationship-nurture": "relationship-nurture-cycle",
};

/** Terminal statuses — a run in one of these is no longer active */
const TERMINAL_STATUSES: RunStatus[] = ["approved", "rejected", "failed", "cancelled", "skipped"];

// ============================================================
// activate_cycle
// ============================================================

export interface ActivateCycleInput {
  cycleType: string;
  userId?: string;
  icp?: string;
  goals?: string;
  channels?: string;
  boundaries?: string;
  cadence?: string;
  continuous?: boolean;
}

export async function handleActivateCycle(
  input: ActivateCycleInput,
): Promise<DelegationResult> {
  const cycleType = input.cycleType as CycleType;

  if (!CYCLE_TYPES.includes(cycleType)) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: `Unknown cycle type: "${input.cycleType}". Valid types: ${CYCLE_TYPES.join(", ")}`,
    };
  }

  if (!input.goals && !input.icp) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: "I need at least a goal or ICP to start the cycle. What are you trying to achieve?",
    };
  }

  const processSlug = CYCLE_SLUG_MAP[cycleType];

  // Check for existing active cycle of this type
  const existingActive = await findActiveCycleRun(cycleType);
  if (existingActive) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: `A ${cycleType} cycle is already running (run ${existingActive.id.slice(0, 8)}). Pause it first if you want to start a new one.`,
    };
  }

  // Truncate user-provided strings to prevent DB bloat
  const truncate = (s: string | undefined, max = 2000) =>
    s ? s.slice(0, max) : null;

  const cycleConfig: Record<string, unknown> = {
    icp: truncate(input.icp),
    goals: truncate(input.goals),
    channels: truncate(input.channels),
    boundaries: truncate(input.boundaries),
    cadence: input.cadence?.slice(0, 200) || "daily on weekdays",
    continuous: input.continuous !== false, // default to continuous
  };

  try {
    // Pass cycleType/cycleConfig into startProcessRun for atomic INSERT —
    // eliminates the TOCTOU race where a concurrent activate_cycle could
    // slip through findActiveCycleRun before cycleType was set.
    const runId = await startProcessRun(
      processSlug,
      {
        userId: input.userId || "default",
        cycleConfig,
      },
      "self:activate_cycle",
      { cycleType, cycleConfig },
    );

    const cycleLabel = cycleType === "sales-marketing"
      ? "sales pipeline"
      : cycleType === "network-connecting"
        ? "connection building"
        : "relationship nurturing";

    return {
      toolName: "activate_cycle",
      success: true,
      output: [
        `I'll start working on your ${cycleLabel}. This is a continuous operation — I'll keep at it every day, not just a one-time task.`,
        ``,
        input.icp ? `**Targeting:** ${input.icp}` : "",
        input.goals ? `**Goal:** ${input.goals}` : "",
        input.channels ? `**Channels:** ${input.channels}` : "",
        input.boundaries ? `**Boundaries:** ${input.boundaries}` : "",
        `**Cadence:** ${cycleConfig.cadence}`,
        ``,
        `You'll get daily briefings on progress. I'll queue anything that needs your approval — broadcast content, outreach that needs your voice. You stay in control.`,
      ].filter(Boolean).join("\n"),
      metadata: { runId, cycleType, processSlug, cycleConfig },
    };
  } catch (err) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: `Failed to activate cycle: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// pause_cycle
// ============================================================

export interface PauseCycleInput {
  cycleType: string;
}

export async function handlePauseCycle(
  input: PauseCycleInput,
): Promise<DelegationResult> {
  const cycleType = input.cycleType as CycleType;

  if (!CYCLE_TYPES.includes(cycleType)) {
    return {
      toolName: "pause_cycle",
      success: false,
      output: `Unknown cycle type: "${input.cycleType}". Valid types: ${CYCLE_TYPES.join(", ")}`,
    };
  }

  try {
    const activeRun = await findActiveCycleRun(cycleType);
    if (!activeRun) {
      return {
        toolName: "pause_cycle",
        success: false,
        output: `No active ${cycleType} cycle to pause.`,
      };
    }

    await db
      .update(schema.processRuns)
      .set({ status: "paused" })
      .where(eq(schema.processRuns.id, activeRun.id));

    return {
      toolName: "pause_cycle",
      success: true,
      output: `${cycleType} cycle paused. I'll stop operating until you resume it.`,
      metadata: { runId: activeRun.id, cycleType },
    };
  } catch (err) {
    return {
      toolName: "pause_cycle",
      success: false,
      output: `Failed to pause cycle: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// resume_cycle
// ============================================================

export interface ResumeCycleInput {
  cycleType: string;
}

export async function handleResumeCycle(
  input: ResumeCycleInput,
): Promise<DelegationResult> {
  const cycleType = input.cycleType as CycleType;

  if (!CYCLE_TYPES.includes(cycleType)) {
    return {
      toolName: "resume_cycle",
      success: false,
      output: `Unknown cycle type: "${input.cycleType}". Valid types: ${CYCLE_TYPES.join(", ")}`,
    };
  }

  try {
    // Find a paused cycle run
    const pausedRun = await db
      .select({ id: schema.processRuns.id })
      .from(schema.processRuns)
      .where(
        and(
          eq(schema.processRuns.cycleType, cycleType),
          eq(schema.processRuns.status, "paused"),
        ),
      )
      .orderBy(desc(schema.processRuns.createdAt))
      .limit(1);

    if (pausedRun.length === 0) {
      return {
        toolName: "resume_cycle",
        success: false,
        output: `No paused ${cycleType} cycle to resume.`,
      };
    }

    await db
      .update(schema.processRuns)
      .set({ status: "running" })
      .where(eq(schema.processRuns.id, pausedRun[0].id));

    return {
      toolName: "resume_cycle",
      success: true,
      output: `${cycleType} cycle resumed. I'm back on it.`,
      metadata: { runId: pausedRun[0].id, cycleType },
    };
  } catch (err) {
    return {
      toolName: "resume_cycle",
      success: false,
      output: `Failed to resume cycle: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// cycle_briefing
// ============================================================

export interface CycleBriefingInput {
  cycleType: string;
}

export async function handleCycleBriefing(
  input: CycleBriefingInput,
): Promise<DelegationResult> {
  const cycleType = input.cycleType as CycleType;

  if (!CYCLE_TYPES.includes(cycleType)) {
    return {
      toolName: "cycle_briefing",
      success: false,
      output: `Unknown cycle type: "${input.cycleType}". Valid types: ${CYCLE_TYPES.join(", ")}`,
    };
  }

  try {
    // Find the most recent cycle run (narrow select — avoid large JSON blobs)
    const recentRun = await db
      .select({
        id: schema.processRuns.id,
        status: schema.processRuns.status,
        cycleConfig: schema.processRuns.cycleConfig,
        startedAt: schema.processRuns.startedAt,
        currentStepId: schema.processRuns.currentStepId,
      })
      .from(schema.processRuns)
      .where(eq(schema.processRuns.cycleType, cycleType))
      .orderBy(desc(schema.processRuns.createdAt))
      .limit(1);

    if (recentRun.length === 0) {
      return {
        toolName: "cycle_briefing",
        success: false,
        output: `No ${cycleType} cycle runs found. Activate one first.`,
      };
    }

    const run = recentRun[0];

    // Get step runs for this cycle (narrow select — only need status and stepId)
    const stepRuns = await db
      .select({
        stepId: schema.stepRuns.stepId,
        status: schema.stepRuns.status,
      })
      .from(schema.stepRuns)
      .where(eq(schema.stepRuns.processRunId, run.id));

    // Get pending review items
    const pendingReviews = stepRuns.filter((s) => s.status === "waiting_review");

    // Get completed steps
    const completedSteps = stepRuns.filter((s) => s.status === "approved");

    // Get cycle config
    const config = (run.cycleConfig as Record<string, unknown>) || {};

    // Build the four-section briefing (Insight-168 handoff format)
    const context = [
      `**Context**`,
      `Cycle: ${cycleType} | Status: ${run.status} | Started: ${run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "not yet"}`,
      config.goals ? `Goal: ${config.goals}` : "",
      config.icp ? `ICP: ${config.icp}` : "",
    ].filter(Boolean).join("\n");

    const summary = [
      `**Summary**`,
      `- ${completedSteps.length} steps completed`,
      `- ${pendingReviews.length} items pending review`,
      `- ${stepRuns.filter((s) => s.status === "running").length} steps in progress`,
      run.currentStepId ? `- Current phase: ${run.currentStepId}` : "",
    ].filter(Boolean).join("\n");

    const recommendations = [
      `**Recommendations**`,
      pendingReviews.length > 0
        ? `- Review ${pendingReviews.length} pending item(s) to keep the cycle moving`
        : `- No immediate actions needed — cycle is operating normally`,
    ].join("\n");

    const options = [
      `**Options**`,
      `- Continue as-is`,
      `- Pause the cycle`,
      pendingReviews.length > 0 ? `- Review pending items now` : "",
      `- Adjust cycle configuration`,
    ].filter(Boolean).join("\n");

    return {
      toolName: "cycle_briefing",
      success: true,
      output: [context, "", summary, "", recommendations, "", options].join("\n"),
      metadata: {
        cycleType,
        runId: run.id,
        status: run.status,
        completedSteps: completedSteps.length,
        pendingReviews: pendingReviews.length,
      },
    };
  } catch (err) {
    return {
      toolName: "cycle_briefing",
      success: false,
      output: `Failed to generate briefing: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// cycle_status
// ============================================================

export interface CycleStatusInput {
  userId?: string;
}

export async function handleCycleStatus(
  _input: CycleStatusInput,
): Promise<DelegationResult> {
  try {
    // Narrow select: only the columns we need (avoid pulling large JSON blobs)
    const allCycleRuns = await db
      .select({
        id: schema.processRuns.id,
        cycleType: schema.processRuns.cycleType,
        status: schema.processRuns.status,
        currentStepId: schema.processRuns.currentStepId,
        processId: schema.processRuns.processId,
        createdAt: schema.processRuns.createdAt,
      })
      .from(schema.processRuns)
      .where(sql`${schema.processRuns.cycleType} IS NOT NULL`)
      .orderBy(desc(schema.processRuns.createdAt));

    if (allCycleRuns.length === 0) {
      return {
        toolName: "cycle_status",
        success: true,
        output: "No operating cycles active. Use activate_cycle to start one.",
      };
    }

    // Group by cycle type, take most recent per type
    const latestByType = new Map<string, typeof allCycleRuns[0]>();
    for (const run of allCycleRuns) {
      if (run.cycleType && !latestByType.has(run.cycleType)) {
        latestByType.set(run.cycleType, run);
      }
    }

    // Batch: get pending review counts for all active runs in one query
    const activeRunIds = [...latestByType.values()]
      .filter((r) => !TERMINAL_STATUSES.includes(r.status as RunStatus))
      .map((r) => r.id);

    const reviewCounts = new Map<string, number>();
    if (activeRunIds.length > 0) {
      const counts = await db
        .select({
          processRunId: schema.stepRuns.processRunId,
          count: sql<number>`count(*)`,
        })
        .from(schema.stepRuns)
        .where(
          and(
            inArray(schema.stepRuns.processRunId, activeRunIds),
            eq(schema.stepRuns.status, "waiting_review"),
          ),
        )
        .groupBy(schema.stepRuns.processRunId);

      for (const row of counts) {
        reviewCounts.set(row.processRunId, row.count);
      }
    }

    // Batch: get all cycle process slugs → schedule next-run times in two queries
    const slugs = [...new Set(
      [...latestByType.keys()]
        .map((ct) => CYCLE_SLUG_MAP[ct as CycleType])
        .filter(Boolean),
    )];

    const nextRunBySlug = new Map<string, Date>();
    if (slugs.length > 0) {
      const procs = await db
        .select({ id: schema.processes.id, slug: schema.processes.slug })
        .from(schema.processes)
        .where(inArray(schema.processes.slug, slugs));

      const procIds = procs.map((p) => p.id);
      if (procIds.length > 0) {
        const schedules = await db
          .select({
            processId: schema.schedules.processId,
            nextRunAt: schema.schedules.nextRunAt,
          })
          .from(schema.schedules)
          .where(inArray(schema.schedules.processId, procIds));

        // Map processId → slug for lookup
        const idToSlug = new Map(procs.map((p) => [p.id, p.slug]));
        for (const s of schedules) {
          const slug = idToSlug.get(s.processId);
          if (slug && s.nextRunAt) {
            nextRunBySlug.set(slug, s.nextRunAt);
          }
        }
      }
    }

    // Build output
    const lines: string[] = ["**Operating Cycles**", ""];

    for (const [cycleType, run] of latestByType) {
      const isActive = !TERMINAL_STATUSES.includes(run.status as RunStatus);
      const statusEmoji = isActive ? "●" : "○";
      const reviewCount = reviewCounts.get(run.id) ?? 0;

      const processSlug = CYCLE_SLUG_MAP[cycleType as CycleType];
      const nextRunAt = processSlug ? nextRunBySlug.get(processSlug) : undefined;

      lines.push(
        `${statusEmoji} **${cycleType}** — ${run.status}${run.currentStepId ? ` (phase: ${run.currentStepId})` : ""}`,
      );
      if (reviewCount > 0) {
        lines.push(`  ${reviewCount} item(s) pending review`);
      }
      if (nextRunAt) {
        lines.push(`  Next: ${new Date(nextRunAt).toLocaleDateString()}`);
      }
      lines.push("");
    }

    return {
      toolName: "cycle_status",
      success: true,
      output: lines.join("\n").trim(),
      metadata: {
        activeCycles: [...latestByType.entries()]
          .filter(([, run]) => !TERMINAL_STATUSES.includes(run.status as RunStatus))
          .map(([type]) => type),
      },
    };
  } catch (err) {
    return {
      toolName: "cycle_status",
      success: false,
      output: `Failed to get cycle status: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

/** Find the most recent active (non-terminal) run for a cycle type */
async function findActiveCycleRun(
  cycleType: CycleType,
): Promise<{ id: string } | null> {
  const [run] = await db
    .select({ id: schema.processRuns.id })
    .from(schema.processRuns)
    .where(
      and(
        eq(schema.processRuns.cycleType, cycleType),
        notInArray(schema.processRuns.status, TERMINAL_STATUSES),
      ),
    )
    .orderBy(desc(schema.processRuns.createdAt))
    .limit(1);

  return run ?? null;
}
