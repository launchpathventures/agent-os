/**
 * Agent OS — Heartbeat Engine
 *
 * Borrowed from Paperclip's heartbeat model: agents wake, execute, sleep.
 * A heartbeat is a single execution cycle for a process run.
 *
 * The heartbeat cycle:
 * 1. Check for queued/running process runs
 * 2. For each run, determine the next step to execute
 * 3. Resolve the agent/executor for that step
 * 4. Execute the step (via adapter)
 * 5. Store the output
 * 6. Advance to the next step (or pause for human review)
 * 7. Record activity
 */

import { db, schema } from "../db";
import type { StepExecutor } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { ProcessDefinition } from "./process-loader";
import { executeStep, type StepExecutionResult } from "./step-executor";

export interface HeartbeatResult {
  processRunId: string;
  stepsExecuted: number;
  status: "advanced" | "waiting_review" | "completed" | "failed";
  message: string;
}

/**
 * Execute a single heartbeat for a process run.
 * Advances the run by executing the next pending step.
 */
export async function heartbeat(processRunId: string): Promise<HeartbeatResult> {
  // 1. Load the process run
  const [run] = await db
    .select()
    .from(schema.processRuns)
    .where(eq(schema.processRuns.id, processRunId))
    .limit(1);

  if (!run) {
    return {
      processRunId,
      stepsExecuted: 0,
      status: "failed",
      message: "Process run not found",
    };
  }

  if (run.status !== "queued" && run.status !== "running") {
    return {
      processRunId,
      stepsExecuted: 0,
      status: "failed",
      message: `Process run is ${run.status}, not executable`,
    };
  }

  // 2. Load the process definition
  const [process] = await db
    .select()
    .from(schema.processes)
    .where(eq(schema.processes.id, run.processId))
    .limit(1);

  if (!process) {
    return {
      processRunId,
      stepsExecuted: 0,
      status: "failed",
      message: "Process definition not found",
    };
  }

  const definition = process.definition as unknown as ProcessDefinition;

  // 3. Find the next step to execute
  const completedSteps = await db
    .select()
    .from(schema.stepRuns)
    .where(
      and(
        eq(schema.stepRuns.processRunId, processRunId),
        eq(schema.stepRuns.status, "approved")
      )
    );

  const completedStepIds = new Set(completedSteps.map((s) => s.stepId));
  const nextStep = definition.steps.find((s) => !completedStepIds.has(s.id));

  if (!nextStep) {
    // All steps complete
    await db
      .update(schema.processRuns)
      .set({ status: "approved", completedAt: new Date() })
      .where(eq(schema.processRuns.id, processRunId));

    await logActivity("process.run.completed", processRunId, "process_run");

    return {
      processRunId,
      stepsExecuted: 0,
      status: "completed",
      message: "All steps complete",
    };
  }

  // 4. If step is a human step, pause for review
  if (nextStep.executor === "human") {
    await db
      .update(schema.processRuns)
      .set({ status: "waiting_review", currentStepId: nextStep.id })
      .where(eq(schema.processRuns.id, processRunId));

    // Create a step run record for the human step
    await db.insert(schema.stepRuns).values({
      processRunId,
      stepId: nextStep.id,
      status: "waiting_review",
      executorType: "human",
    });

    await logActivity(
      "process.run.waiting_review",
      processRunId,
      "process_run",
      { step: nextStep.id, stepName: nextStep.name }
    );

    return {
      processRunId,
      stepsExecuted: 0,
      status: "waiting_review",
      message: `Waiting for human: ${nextStep.name}`,
    };
  }

  // 5. Mark run as running
  await db
    .update(schema.processRuns)
    .set({ status: "running", currentStepId: nextStep.id, startedAt: run.startedAt || new Date() })
    .where(eq(schema.processRuns.id, processRunId));

  // 6. Execute the step
  const stepRunRecord = await db
    .insert(schema.stepRuns)
    .values({
      processRunId,
      stepId: nextStep.id,
      status: "running",
      executorType: nextStep.executor as StepExecutor,
      startedAt: new Date(),
    })
    .returning();

  let result: StepExecutionResult;
  try {
    result = await executeStep(nextStep, run.inputs as Record<string, unknown>, definition);

    // 7. Store the output
    await db
      .update(schema.stepRuns)
      .set({
        status: "approved", // Auto-approved for non-human steps within the harness
        outputs: result.outputs,
        completedAt: new Date(),
        tokensUsed: result.tokensUsed || 0,
        costCents: result.costCents || 0,
      })
      .where(eq(schema.stepRuns.id, stepRunRecord[0].id));

    // If this step produces a reviewable output, add to review queue
    if (result.outputs && Object.keys(result.outputs).length > 0) {
      for (const [name, content] of Object.entries(result.outputs)) {
        const matchingOutput = definition.outputs.find((o) => o.name === name);
        await db.insert(schema.processOutputs).values({
          processRunId,
          stepRunId: stepRunRecord[0].id,
          name,
          type: matchingOutput?.type || "text",
          content: content as Record<string, unknown>,
          needsReview: nextStep.executor === "ai-agent", // AI outputs need review by default
          confidenceScore: result.confidence,
        });
      }
    }

    await logActivity("step.completed", stepRunRecord[0].id, "step_run", {
      step: nextStep.id,
      stepName: nextStep.name,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    await db
      .update(schema.stepRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(schema.stepRuns.id, stepRunRecord[0].id));

    await db
      .update(schema.processRuns)
      .set({ status: "failed" })
      .where(eq(schema.processRuns.id, processRunId));

    await logActivity("step.failed", stepRunRecord[0].id, "step_run", {
      step: nextStep.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      processRunId,
      stepsExecuted: 1,
      status: "failed",
      message: `Step "${nextStep.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    processRunId,
    stepsExecuted: 1,
    status: "advanced",
    message: `Completed step: ${nextStep.name}`,
  };
}

/**
 * Run a full heartbeat cycle — execute all available steps until
 * hitting a human gate or completion.
 */
export async function fullHeartbeat(processRunId: string): Promise<HeartbeatResult> {
  let totalSteps = 0;
  let lastResult: HeartbeatResult;

  do {
    lastResult = await heartbeat(processRunId);
    totalSteps += lastResult.stepsExecuted;
  } while (lastResult.status === "advanced");

  return {
    ...lastResult,
    stepsExecuted: totalSteps,
  };
}

/**
 * Start a new process run
 */
export async function startProcessRun(
  processSlug: string,
  inputs: Record<string, unknown> = {},
  triggeredBy: string = "manual"
): Promise<string> {
  const [process] = await db
    .select()
    .from(schema.processes)
    .where(eq(schema.processes.slug, processSlug))
    .limit(1);

  if (!process) {
    throw new Error(`Process not found: ${processSlug}`);
  }

  const [run] = await db
    .insert(schema.processRuns)
    .values({
      processId: process.id,
      status: "queued",
      triggeredBy,
      inputs,
    })
    .returning();

  await logActivity("process.run.created", run.id, "process_run", {
    processSlug,
    triggeredBy,
  });

  console.log(`Started process run: ${process.name} (${run.id})`);
  return run.id;
}

// Helper to log activities
async function logActivity(
  action: string,
  entityId: string,
  entityType: string,
  metadata: Record<string, unknown> = {}
) {
  await db.insert(schema.activities).values({
    action,
    actorType: "system",
    entityType,
    entityId,
    metadata,
  });
}
