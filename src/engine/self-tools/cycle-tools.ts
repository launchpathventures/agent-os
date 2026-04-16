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
import { startProcessRun, fullHeartbeat, runHeartbeatDetached } from "../heartbeat";

// ============================================================
// Types
// ============================================================

/** Valid cycle types that map to cycle YAML definitions in processes/cycles/ */
const CYCLE_TYPES = ["sales-marketing", "network-connecting", "relationship-nurture", "gtm-pipeline"] as const;
export type CycleType = (typeof CYCLE_TYPES)[number];

/** Cycle slug mapping: cycle type → process slug (from processes/cycles/*.yaml) */
const CYCLE_SLUG_MAP: Record<CycleType, string> = {
  "sales-marketing": "sales-marketing-cycle",
  "network-connecting": "network-connecting-cycle",
  "relationship-nurture": "relationship-nurture-cycle",
  "gtm-pipeline": "gtm-pipeline-cycle",
};

/** Cycle types that support multiple concurrent plans (differentiated by planName) */
const MULTI_PLAN_TYPES: CycleType[] = ["gtm-pipeline"];

/** Terminal statuses — a run in one of these is no longer active */
const TERMINAL_STATUSES: RunStatus[] = ["approved", "rejected", "failed", "cancelled", "skipped"];

// ============================================================
// Volume Governance (Brief 149, Insight-182)
// ============================================================

/** Default volume budget for first cycle */
const DEFAULT_VOLUME_BUDGET = 5;

/**
 * Volume ladder defaults (user-overridable via conversation):
 * - Cycle 1: max 5 (prove targeting works)
 * - Cycle 2: max 10 (if previous cycle had >0 positive responses)
 * - Cycle 3+: max 20 (if cumulative response rate >10%)
 */
export const VOLUME_LADDER = [
  { cycle: 1, max: 5, condition: "none" },
  { cycle: 2, max: 10, condition: "previous_had_positives" },
  { cycle: 3, max: 20, condition: "response_rate_above_10pct" },
] as const;

/**
 * Compute the volume budget for the next cycle based on previous results.
 * Returns the default if no previous results or conditions not met.
 */
export function computeVolumeBudget(
  cycleNumber: number,
  previousPositiveCount: number,
  cumulativeResponseRate: number,
): number {
  if (cycleNumber >= 3 && cumulativeResponseRate > 0.10) {
    return 20;
  }
  if (cycleNumber >= 2 && previousPositiveCount > 0) {
    return 10;
  }
  return DEFAULT_VOLUME_BUDGET;
}

// ============================================================
// activate_cycle
// ============================================================

export interface GtmContext {
  planName: string;
  product?: string;
  audience?: string;
  differentiator?: string;
  channels?: string;
  [key: string]: unknown;
}

export interface ActivateCycleInput {
  cycleType: string;
  userId?: string;
  icp?: string;
  goals?: string;
  channels?: string;
  boundaries?: string;
  cadence?: string;
  continuous?: boolean;
  gtmContext?: GtmContext;
  /** Maximum outreach targets per cycle batch. Defaults to volume ladder. (Brief 149) */
  volumeBudget?: number;
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

  const isMultiPlan = MULTI_PLAN_TYPES.includes(cycleType);

  if (!isMultiPlan && !input.goals && !input.icp) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: "I need at least a goal or ICP to start the cycle. What are you trying to achieve?",
    };
  }

  // GTM pipeline requires gtmContext with planName
  if (isMultiPlan && !input.gtmContext?.planName) {
    return {
      toolName: "activate_cycle",
      success: false,
      output: "GTM pipeline requires a planName in gtmContext. What should we call this growth plan?",
    };
  }

  const processSlug = CYCLE_SLUG_MAP[cycleType];

  // Overlap prevention: multi-plan types allow concurrency with different planNames
  if (isMultiPlan) {
    const activeRuns = await findActiveCycleRuns(cycleType);
    const planName = input.gtmContext!.planName;
    const duplicate = activeRuns.find((r) => {
      const config = r.cycleConfig as Record<string, unknown> | null;
      const ctx = config?.gtmContext as Record<string, unknown> | undefined;
      return ctx?.planName === planName;
    });
    if (duplicate) {
      return {
        toolName: "activate_cycle",
        success: false,
        output: `A GTM pipeline with plan "${planName}" is already running (run ${duplicate.id.slice(0, 8)}). Pause it first or use a different plan name.`,
      };
    }
  } else {
    const existingActive = await findActiveCycleRun(cycleType);
    if (existingActive) {
      return {
        toolName: "activate_cycle",
        success: false,
        output: `A ${cycleType} cycle is already running (run ${existingActive.id.slice(0, 8)}). Pause it first if you want to start a new one.`,
      };
    }
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
    // Volume governance (Brief 149, Insight-182): defaults to volume ladder
    // Cycle 1: 5, Cycle 2: 10 (if previous had positives), Cycle 3+: 20 (if >10% response rate)
    volumeBudget: input.volumeBudget ?? DEFAULT_VOLUME_BUDGET,
  };

  // Attach gtmContext for GTM pipeline cycles
  if (isMultiPlan && input.gtmContext) {
    cycleConfig.gtmContext = input.gtmContext;
  }

  try {
    // Pass cycleType/cycleConfig into startProcessRun for atomic INSERT —
    // eliminates the TOCTOU race where a concurrent activate_cycle could
    // slip through findActiveCycleRun before cycleType was set.
    const runId = await startProcessRun(
      processSlug,
      {
        userId: input.userId || "default",
        cycleConfig,
        ...(input.gtmContext ? { gtmContext: input.gtmContext } : {}),
      },
      "self:activate_cycle",
      { cycleType, cycleConfig },
    );

    // MP-1.3: Kick off fullHeartbeat immediately — matches start_pipeline pattern
    // (self-delegation.ts:1107-1111). Without this, cycles sit in "queued" state
    // until the scheduler picks them up.
    runHeartbeatDetached(runId, `cycle:${cycleType}`);

    const cycleLabel = cycleType === "sales-marketing"
      ? "sales pipeline"
      : cycleType === "network-connecting"
        ? "connection building"
        : cycleType === "relationship-nurture"
          ? "relationship nurturing"
          : "growth plan";

    const planSuffix = input.gtmContext?.planName ? ` — "${input.gtmContext.planName}"` : "";

    return {
      toolName: "activate_cycle",
      success: true,
      output: [
        `I'll start working on your ${cycleLabel}${planSuffix}. This is a continuous operation — I'll keep at it every day, not just a one-time task.`,
        ``,
        input.icp ? `**Targeting:** ${input.icp}` : "",
        input.goals ? `**Goal:** ${input.goals}` : "",
        input.channels || input.gtmContext?.channels ? `**Channels:** ${input.channels || input.gtmContext?.channels}` : "",
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
  planName?: string;
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

  const isMultiPlan = MULTI_PLAN_TYPES.includes(cycleType);

  try {
    let targetRun: { id: string } | null;

    if (isMultiPlan && input.planName) {
      const activeRuns = await findActiveCycleRuns(cycleType);
      const match = activeRuns.find((r) => {
        const config = r.cycleConfig as Record<string, unknown> | null;
        const ctx = config?.gtmContext as Record<string, unknown> | undefined;
        return ctx?.planName === input.planName;
      });
      targetRun = match ?? null;
    } else {
      targetRun = await findActiveCycleRun(cycleType);
    }

    if (!targetRun) {
      const suffix = input.planName ? ` with plan "${input.planName}"` : "";
      return {
        toolName: "pause_cycle",
        success: false,
        output: `No active ${cycleType} cycle${suffix} to pause.`,
      };
    }

    await db
      .update(schema.processRuns)
      .set({ status: "paused" })
      .where(eq(schema.processRuns.id, targetRun.id));

    const planSuffix = input.planName ? ` ("${input.planName}")` : "";
    return {
      toolName: "pause_cycle",
      success: true,
      output: `${cycleType} cycle${planSuffix} paused. I'll stop operating until you resume it.`,
      metadata: { runId: targetRun.id, cycleType },
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
  planName?: string;
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

  const isMultiPlan = MULTI_PLAN_TYPES.includes(cycleType);

  try {
    // Find a paused cycle run
    const pausedRuns = await db
      .select({ id: schema.processRuns.id, cycleConfig: schema.processRuns.cycleConfig })
      .from(schema.processRuns)
      .where(
        and(
          eq(schema.processRuns.cycleType, cycleType),
          eq(schema.processRuns.status, "paused"),
        ),
      )
      .orderBy(desc(schema.processRuns.createdAt));

    let targetRun: { id: string } | undefined;

    if (isMultiPlan && input.planName) {
      targetRun = pausedRuns.find((r) => {
        const config = r.cycleConfig as Record<string, unknown> | null;
        const ctx = config?.gtmContext as Record<string, unknown> | undefined;
        return ctx?.planName === input.planName;
      });
    } else {
      targetRun = pausedRuns[0];
    }

    if (!targetRun) {
      const suffix = input.planName ? ` with plan "${input.planName}"` : "";
      return {
        toolName: "resume_cycle",
        success: false,
        output: `No paused ${cycleType} cycle${suffix} to resume.`,
      };
    }

    await db
      .update(schema.processRuns)
      .set({ status: "running" })
      .where(eq(schema.processRuns.id, targetRun.id));

    const planSuffix = input.planName ? ` ("${input.planName}")` : "";
    return {
      toolName: "resume_cycle",
      success: true,
      output: `${cycleType} cycle${planSuffix} resumed. I'm back on it.`,
      metadata: { runId: targetRun.id, cycleType },
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
  planName?: string;
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

  const isMultiPlan = MULTI_PLAN_TYPES.includes(cycleType);

  try {
    // Find the most recent cycle run (narrow select — avoid large JSON blobs)
    const recentRuns = await db
      .select({
        id: schema.processRuns.id,
        status: schema.processRuns.status,
        cycleConfig: schema.processRuns.cycleConfig,
        startedAt: schema.processRuns.startedAt,
        currentStepId: schema.processRuns.currentStepId,
      })
      .from(schema.processRuns)
      .where(eq(schema.processRuns.cycleType, cycleType))
      .orderBy(desc(schema.processRuns.createdAt));

    let run: (typeof recentRuns)[0] | undefined;

    if (isMultiPlan && input.planName) {
      run = recentRuns.find((r) => {
        const config = r.cycleConfig as Record<string, unknown> | null;
        const ctx = config?.gtmContext as Record<string, unknown> | undefined;
        return ctx?.planName === input.planName;
      });
    } else {
      run = recentRuns[0];
    }

    if (!run) {
      const suffix = input.planName ? ` with plan "${input.planName}"` : "";
      return {
        toolName: "cycle_briefing",
        success: false,
        output: `No ${cycleType} cycle runs${suffix} found. Activate one first.`,
      };
    }

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
    // Narrow select: columns we need (cycleConfig needed for multi-plan plan names)
    const allCycleRuns = await db
      .select({
        id: schema.processRuns.id,
        cycleType: schema.processRuns.cycleType,
        status: schema.processRuns.status,
        currentStepId: schema.processRuns.currentStepId,
        processId: schema.processRuns.processId,
        createdAt: schema.processRuns.createdAt,
        cycleConfig: schema.processRuns.cycleConfig,
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
    // For multi-plan types, collect all active runs (each plan is separate)
    const latestByType = new Map<string, typeof allCycleRuns[0]>();
    const multiPlanRuns: (typeof allCycleRuns[0])[] = [];
    for (const run of allCycleRuns) {
      if (!run.cycleType) continue;
      if (MULTI_PLAN_TYPES.includes(run.cycleType as CycleType)) {
        if (!TERMINAL_STATUSES.includes(run.status as RunStatus)) {
          multiPlanRuns.push(run);
        } else if (!latestByType.has(run.cycleType) && multiPlanRuns.filter(r => r.cycleType === run.cycleType).length === 0) {
          // Only show terminal if no active runs exist for this type
          latestByType.set(run.cycleType, run);
        }
      } else if (!latestByType.has(run.cycleType)) {
        latestByType.set(run.cycleType, run);
      }
    }

    // Batch: get pending review counts for all active runs in one query
    const allDisplayRuns = [...latestByType.values(), ...multiPlanRuns];
    const activeRunIds = allDisplayRuns
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

    // Render standard (single-per-type) cycles
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

      // Volume governance info (Brief 149 AC13)
      const config = (run.cycleConfig as Record<string, unknown>) || {};
      if (config.volumeBudget != null) {
        lines.push(`  Volume budget: ${config.volumeBudget} per batch`);
      }

      if (nextRunAt) {
        lines.push(`  Next: ${new Date(nextRunAt).toLocaleDateString()}`);
      }
      lines.push("");
    }

    // Render multi-plan runs (each plan gets its own line)
    for (const run of multiPlanRuns) {
      const statusEmoji = "●";
      const reviewCount = reviewCounts.get(run.id) ?? 0;
      const config = (run as { cycleConfig?: unknown }).cycleConfig as Record<string, unknown> | null;
      const ctx = config?.gtmContext as Record<string, unknown> | undefined;
      const planLabel = ctx?.planName ? ` "${ctx.planName}"` : "";

      lines.push(
        `${statusEmoji} **${run.cycleType}**${planLabel} — ${run.status}${run.currentStepId ? ` (phase: ${run.currentStepId})` : ""}`,
      );
      if (reviewCount > 0) {
        lines.push(`  ${reviewCount} item(s) pending review`);
      }
      lines.push("");
    }

    const activeCycles = [
      ...([...latestByType.entries()]
        .filter(([, run]) => !TERMINAL_STATUSES.includes(run.status as RunStatus))
        .map(([type]) => type)),
      ...multiPlanRuns.map((r) => r.cycleType),
    ];

    return {
      toolName: "cycle_status",
      success: true,
      output: lines.join("\n").trim(),
      metadata: { activeCycles },
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

/** Find ALL active (non-terminal) runs for a cycle type — used by multi-plan types */
async function findActiveCycleRuns(
  cycleType: CycleType,
): Promise<{ id: string; cycleConfig: unknown }[]> {
  return db
    .select({ id: schema.processRuns.id, cycleConfig: schema.processRuns.cycleConfig })
    .from(schema.processRuns)
    .where(
      and(
        eq(schema.processRuns.cycleType, cycleType),
        notInArray(schema.processRuns.status, TERMINAL_STATUSES),
      ),
    )
    .orderBy(desc(schema.processRuns.createdAt));
}
