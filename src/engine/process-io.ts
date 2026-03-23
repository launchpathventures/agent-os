/**
 * Ditto — Process I/O Handler (Brief 036)
 *
 * Connects process boundaries to external systems:
 * - Polling-based triggers: check external sources on a schedule, create work items
 * - Output delivery: send process outputs to external destinations after trust gate approval
 *
 * Provenance: Standard polling pattern (cron-style), Nango actions pattern for output delivery
 */

import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import type { ProcessDefinition, ProcessSourceConfig, ProcessOutputDeliveryConfig } from "./process-loader";
import { getIntegration } from "./integration-registry";
import { executeIntegration } from "./integration-handlers";
import { startProcessRun, fullHeartbeat } from "./heartbeat";

// ============================================================
// Polling state
// ============================================================

interface PollingLoop {
  processSlug: string;
  processId: string;
  source: ProcessSourceConfig;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  lastCheck: Date | null;
  stopped: boolean;
}

const activePollers = new Map<string, PollingLoop>();

// ============================================================
// Polling
// ============================================================

/**
 * Start polling a process source for new work items.
 * Creates work items via the existing intake pipeline with triggeredBy: "trigger".
 *
 * @param processSlug - The process slug to poll for
 * @param intervalMs - Override interval (defaults to source config intervalMs)
 */
export async function startPolling(
  processSlug: string,
  intervalMs?: number,
): Promise<void> {
  if (activePollers.has(processSlug)) {
    throw new Error(`Already polling for process: ${processSlug}`);
  }

  // Load process from DB
  const [proc] = await db
    .select()
    .from(schema.processes)
    .where(eq(schema.processes.slug, processSlug))
    .limit(1);

  if (!proc) {
    throw new Error(`Process not found: ${processSlug}`);
  }

  const definition = proc.definition as unknown as ProcessDefinition;
  if (!definition.source) {
    throw new Error(`Process "${processSlug}" has no source configuration`);
  }

  const source = definition.source;
  const interval = intervalMs ?? source.intervalMs;

  const poller: PollingLoop = {
    processSlug,
    processId: proc.id,
    source,
    intervalMs: interval,
    timer: null,
    lastCheck: null,
    stopped: false,
  };

  activePollers.set(processSlug, poller);

  // Run the first poll immediately, then set interval
  await pollOnce(poller);

  if (!poller.stopped) {
    poller.timer = setInterval(async () => {
      if (poller.stopped) return;
      await pollOnce(poller);
    }, interval);
  }

  console.log(`Polling ${processSlug} source every ${interval / 1000}s`);
}

/**
 * Execute a single poll: call the integration source and create work items if results found.
 */
async function pollOnce(poller: PollingLoop): Promise<void> {
  if (poller.stopped) return;

  try {
    const integration = getIntegration(poller.source.service);
    if (!integration) {
      console.error(`Poll error: integration "${poller.source.service}" not found`);
      return;
    }

    // Execute the source action via integration handler
    // Credential resolution (AC8) happens inside executeIntegration → cli/rest handler → resolveServiceAuth
    const result = await executeIntegration(
      {
        service: poller.source.service,
        command: poller.source.action,
        processId: poller.processId,
      },
      integration,
    );

    poller.lastCheck = new Date();

    // If the source returned results, create a work item and start a process run
    // Check that outputs contain at least one truthy value (not just empty/null results)
    const outputValues = result.outputs ? Object.values(result.outputs) : [];
    const hasContent = outputValues.some(
      (v) => v !== null && v !== undefined && v !== "" && v !== "null",
    );

    if (hasContent) {
        // Create work item directly with known process assignment.
        // This intentionally bypasses intake classification/routing (Brief 014b capture pipeline)
        // because the trigger already declares which process it belongs to — re-classifying
        // would be redundant. The work item is created pre-routed.
        const [workItem] = await db
          .insert(schema.workItems)
          .values({
            type: "task",
            status: "routed",
            content: `Trigger: ${poller.processSlug} source check`,
            source: "system_generated",
            assignedProcess: poller.processId,
            context: {
              triggeredBy: "trigger",
              sourceResult: result.outputs,
              sourceService: poller.source.service,
              sourceAction: poller.source.action,
            },
          })
          .returning();

        // Start a process run with triggeredBy: "trigger"
        const processRunId = await startProcessRun(
          poller.processSlug,
          {
            workItemId: workItem.id,
            sourceResult: result.outputs,
            ...poller.source.params,
          },
          "trigger",
        );

        // Update work item with execution ID
        await db
          .update(schema.workItems)
          .set({
            status: "in_progress",
            executionIds: [processRunId],
            updatedAt: new Date(),
          })
          .where(eq(schema.workItems.id, workItem.id));

        // Run the heartbeat
        await fullHeartbeat(processRunId);

        // Log activity
        await db.insert(schema.activities).values({
          action: "trigger.fired",
          actorType: "system",
          entityType: "process",
          entityId: poller.processId,
          metadata: {
            processSlug: poller.processSlug,
            workItemId: workItem.id,
            processRunId,
            source: poller.source.service,
          },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Poll error for ${poller.processSlug}: ${message}`);
  }
}

/**
 * Stop polling for a process.
 */
export function stopPolling(processSlug: string): void {
  const poller = activePollers.get(processSlug);
  if (!poller) {
    throw new Error(`Not polling for process: ${processSlug}`);
  }

  poller.stopped = true;
  if (poller.timer) {
    clearInterval(poller.timer);
    poller.timer = null;
  }
  activePollers.delete(processSlug);

  console.log(`Stopped polling ${processSlug}`);
}

/**
 * Stop all active polling loops (graceful shutdown).
 */
export function stopAllPolling(): void {
  for (const [slug] of activePollers) {
    stopPolling(slug);
  }
}

/**
 * Get status of all active polling loops.
 */
export function getPollingStatus(): Array<{
  processSlug: string;
  intervalMs: number;
  lastCheck: Date | null;
  service: string;
  action: string;
}> {
  return Array.from(activePollers.values()).map((p) => ({
    processSlug: p.processSlug,
    intervalMs: p.intervalMs,
    lastCheck: p.lastCheck,
    service: p.source.service,
    action: p.source.action,
  }));
}

// ============================================================
// Output Delivery
// ============================================================

/**
 * Deliver process run outputs to the configured output_delivery destination.
 * Called after a process run completes and passes the trust gate.
 *
 * No-op if the process has no output_delivery config.
 *
 * @param processRunId - The completed process run ID
 */
export async function deliverOutput(processRunId: string): Promise<void> {
  // Load the process run
  const [run] = await db
    .select()
    .from(schema.processRuns)
    .where(eq(schema.processRuns.id, processRunId))
    .limit(1);

  if (!run) {
    throw new Error(`Process run not found: ${processRunId}`);
  }

  // Load the process definition
  const [proc] = await db
    .select()
    .from(schema.processes)
    .where(eq(schema.processes.id, run.processId))
    .limit(1);

  if (!proc) {
    throw new Error(`Process not found for run: ${processRunId}`);
  }

  const definition = proc.definition as unknown as ProcessDefinition;

  // No-op if no output_delivery configured
  if (!definition.output_delivery) {
    return;
  }

  const outputDelivery = definition.output_delivery;

  // Gather all approved step outputs for this run
  const stepRuns = await db
    .select()
    .from(schema.stepRuns)
    .where(eq(schema.stepRuns.processRunId, processRunId));

  const outputs: Record<string, unknown> = {};
  for (const sr of stepRuns) {
    if (sr.status === "approved" && sr.outputs) {
      outputs[sr.stepId] = sr.outputs;
    }
  }

  // Execute the delivery via integration handler
  // Credential resolution (AC8) happens inside executeIntegration → cli/rest handler → resolveServiceAuth
  const integration = getIntegration(outputDelivery.service);
  if (!integration) {
    throw new Error(
      `Output delivery: integration "${outputDelivery.service}" not found`,
    );
  }

  // Build the command with delivery params and collected outputs.
  // The action is the base command; params and outputs are appended as JSON.
  const deliveryPayload = JSON.stringify({
    params: outputDelivery.params,
    outputs,
    processRunId,
  });
  const command = `${outputDelivery.action} ${deliveryPayload}`;

  await executeIntegration(
    {
      service: outputDelivery.service,
      command,
      processId: proc.id,
    },
    integration,
  );

  // Log the delivery
  await db.insert(schema.activities).values({
    action: "output.delivered",
    actorType: "system",
    entityType: "process_run",
    entityId: processRunId,
    metadata: {
      service: outputDelivery.service,
      action: outputDelivery.action,
      processSlug: proc.slug,
      outputCount: Object.keys(outputs).length,
    },
  });

  console.log(`Output delivered via ${outputDelivery.service}.${outputDelivery.action} for run ${processRunId.slice(0, 8)}`);
}
