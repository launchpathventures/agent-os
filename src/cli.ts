/**
 * Agent OS — CLI Entry Point
 *
 * The command-line interface for operating Agent OS.
 * This is the primary interface during development — the web dashboard comes later.
 *
 * Usage:
 *   pnpm cli sync              # Sync process definitions to DB
 *   pnpm cli start <process>   # Start a process run
 *   pnpm cli heartbeat <runId> # Execute a heartbeat for a run
 *   pnpm cli status            # Show status of all processes and runs
 *   pnpm cli review <runId>    # Review outputs waiting for approval
 *   pnpm cli approve <runId>   # Approve current step and continue
 *   pnpm cli capture <text>    # Quick capture a note/task
 */

import "dotenv/config";
import { db, schema } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  loadAllProcesses,
  syncProcessesToDb,
} from "./engine/process-loader";
import {
  startProcessRun,
  heartbeat,
  fullHeartbeat,
} from "./engine/heartbeat";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "sync":
      await syncCommand();
      break;
    case "start":
      await startCommand(args[0], args.slice(1));
      break;
    case "heartbeat":
      await heartbeatCommand(args[0]);
      break;
    case "status":
      await statusCommand();
      break;
    case "review":
      await reviewCommand(args[0]);
      break;
    case "approve":
      await approveCommand(args[0]);
      break;
    case "capture":
      await captureCommand(args.join(" "));
      break;
    default:
      printHelp();
  }

  process.exit(0);
}

// ============================================================
// Commands
// ============================================================

async function syncCommand() {
  console.log("Syncing process definitions...\n");
  const definitions = loadAllProcesses();
  console.log(`Found ${definitions.length} process definitions:`);
  await syncProcessesToDb(definitions);
  console.log("\nDone.");
}

async function startCommand(processSlug: string, extraArgs: string[]) {
  if (!processSlug) {
    console.error("Usage: pnpm cli start <process-slug> [--input key=value ...]");
    process.exit(1);
  }

  // Parse inputs from args
  const inputs: Record<string, string> = {};
  for (const arg of extraArgs) {
    if (arg.startsWith("--input")) continue;
    if (arg.includes("=")) {
      const [key, ...rest] = arg.split("=");
      inputs[key] = rest.join("=");
    }
  }

  console.log(`Starting process: ${processSlug}\n`);
  const runId = await startProcessRun(processSlug, inputs);

  console.log(`\nRunning heartbeat...`);
  const result = await fullHeartbeat(runId);

  console.log(`\nResult: ${result.status}`);
  console.log(`Steps executed: ${result.stepsExecuted}`);
  console.log(`Message: ${result.message}`);
  console.log(`\nRun ID: ${runId}`);

  if (result.status === "waiting_review") {
    console.log(`\nRun 'pnpm cli review ${runId}' to see outputs.`);
    console.log(`Run 'pnpm cli approve ${runId}' to approve and continue.`);
  }
}

async function heartbeatCommand(runId: string) {
  if (!runId) {
    console.error("Usage: pnpm cli heartbeat <run-id>");
    process.exit(1);
  }

  const result = await fullHeartbeat(runId);
  console.log(`Status: ${result.status}`);
  console.log(`Steps: ${result.stepsExecuted}`);
  console.log(`Message: ${result.message}`);
}

async function statusCommand() {
  console.log("Agent OS — Status\n");

  // Show processes
  const processes = await db
    .select()
    .from(schema.processes)
    .orderBy(schema.processes.name);

  if (processes.length === 0) {
    console.log("No processes registered. Run 'pnpm cli sync' first.\n");
    return;
  }

  console.log("PROCESSES");
  console.log("─".repeat(60));
  for (const p of processes) {
    console.log(
      `  ${p.name.padEnd(30)} ${p.status.padEnd(10)} trust:${p.trustTier}`
    );
  }

  // Show recent runs
  const runs = await db
    .select({
      run: schema.processRuns,
      process: schema.processes,
    })
    .from(schema.processRuns)
    .leftJoin(schema.processes, eq(schema.processRuns.processId, schema.processes.id))
    .orderBy(desc(schema.processRuns.createdAt))
    .limit(10);

  if (runs.length > 0) {
    console.log("\nRECENT RUNS");
    console.log("─".repeat(60));
    for (const { run, process: proc } of runs) {
      const name = proc?.name || "Unknown";
      const age = timeSince(run.createdAt);
      console.log(
        `  ${run.id.slice(0, 8)} ${name.padEnd(25)} ${run.status.padEnd(15)} ${age}`
      );
    }
  }

  // Show items waiting for review
  const pendingOutputs = await db
    .select()
    .from(schema.processOutputs)
    .where(eq(schema.processOutputs.needsReview, true));

  if (pendingOutputs.length > 0) {
    console.log(`\nREVIEW QUEUE: ${pendingOutputs.length} items waiting`);
  }

  // Show recent captures
  const captures = await db
    .select()
    .from(schema.captures)
    .orderBy(desc(schema.captures.createdAt))
    .limit(5);

  if (captures.length > 0) {
    console.log("\nRECENT CAPTURES");
    console.log("─".repeat(60));
    for (const c of captures) {
      const preview = c.content.slice(0, 60) + (c.content.length > 60 ? "..." : "");
      console.log(`  [${c.type}] ${preview}`);
    }
  }
}

async function reviewCommand(runId: string) {
  if (!runId) {
    // Show all items needing review
    const outputs = await db
      .select({
        output: schema.processOutputs,
        run: schema.processRuns,
      })
      .from(schema.processOutputs)
      .leftJoin(
        schema.processRuns,
        eq(schema.processOutputs.processRunId, schema.processRuns.id)
      )
      .where(eq(schema.processOutputs.needsReview, true));

    if (outputs.length === 0) {
      console.log("No items waiting for review.");
      return;
    }

    console.log(`REVIEW QUEUE (${outputs.length} items)\n`);
    for (const { output } of outputs) {
      const confidence = output.confidenceScore
        ? `${Math.round(output.confidenceScore * 100)}%`
        : "N/A";
      console.log(`  ${output.id.slice(0, 8)} [${output.type}] ${output.name}`);
      console.log(`  Confidence: ${confidence}`);
      console.log(`  Run: ${output.processRunId.slice(0, 8)}`);
      console.log();
    }
    return;
  }

  // Show outputs for a specific run
  const outputs = await db
    .select()
    .from(schema.processOutputs)
    .where(eq(schema.processOutputs.processRunId, runId));

  if (outputs.length === 0) {
    console.log("No outputs for this run.");
    return;
  }

  for (const output of outputs) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Output: ${output.name} (${output.type})`);
    console.log(`Confidence: ${output.confidenceScore ? Math.round(output.confidenceScore * 100) + "%" : "N/A"}`);
    console.log(`Needs review: ${output.needsReview}`);
    console.log(`${"─".repeat(60)}`);

    const content = output.content;
    if (typeof content === "string") {
      console.log(content);
    } else {
      console.log(JSON.stringify(content, null, 2));
    }

    console.log(`${"═".repeat(60)}`);
  }
}

async function approveCommand(runId: string) {
  if (!runId) {
    console.error("Usage: pnpm cli approve <run-id>");
    process.exit(1);
  }

  // Mark all pending outputs as reviewed
  await db
    .update(schema.processOutputs)
    .set({
      needsReview: false,
      reviewedAt: new Date(),
      reviewedBy: "human",
    })
    .where(eq(schema.processOutputs.processRunId, runId));

  // Mark the waiting step as approved
  await db
    .update(schema.stepRuns)
    .set({ status: "approved", completedAt: new Date() })
    .where(eq(schema.stepRuns.processRunId, runId));

  // Resume the run
  await db
    .update(schema.processRuns)
    .set({ status: "running" })
    .where(eq(schema.processRuns.id, runId));

  // Record feedback
  const outputs = await db
    .select()
    .from(schema.processOutputs)
    .where(eq(schema.processOutputs.processRunId, runId));

  for (const output of outputs) {
    await db.insert(schema.feedback).values({
      outputId: output.id,
      processId: (
        await db
          .select()
          .from(schema.processRuns)
          .where(eq(schema.processRuns.id, runId))
          .limit(1)
      )[0].processId,
      type: "approve",
    });
  }

  console.log("Approved. Continuing heartbeat...\n");

  const result = await fullHeartbeat(runId);
  console.log(`Status: ${result.status}`);
  console.log(`Steps: ${result.stepsExecuted}`);
  console.log(`Message: ${result.message}`);
}

async function captureCommand(text: string) {
  if (!text) {
    console.error("Usage: pnpm cli capture <text>");
    process.exit(1);
  }

  await db.insert(schema.captures).values({
    content: text,
    type: "note",
    source: "cli",
  });

  console.log(`Captured: "${text}"`);
}

// ============================================================
// Helpers
// ============================================================

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function printHelp() {
  console.log(`
Agent OS — CLI

Commands:
  sync                    Sync process definitions from YAML to database
  start <process-slug>    Start a new process run
  heartbeat <run-id>      Execute a heartbeat for a process run
  status                  Show all processes, runs, and review queue
  review [run-id]         Review outputs (all or for a specific run)
  approve <run-id>        Approve outputs and continue the process
  capture <text>          Quick capture a note or task

Examples:
  pnpm cli sync
  pnpm cli start feature-implementation brief="Add user auth"
  pnpm cli status
  pnpm cli review
  pnpm cli approve abc123
  pnpm cli capture "Need to check Delta auth flow"
`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
