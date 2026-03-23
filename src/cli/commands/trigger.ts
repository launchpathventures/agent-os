/**
 * CLI Command: trigger
 * Manage polling-based triggers for process sources.
 *
 * ditto trigger start <process> [--interval <ms>]  — start polling
 * ditto trigger stop <process>                      — stop polling
 * ditto trigger status                              — show active loops
 *
 * Provenance: Brief 036
 */

import { defineCommand } from "citty";
import {
  startPolling,
  stopPolling,
  getPollingStatus,
} from "../../engine/process-io";

export const triggerStartCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start polling a process source for new work",
  },
  args: {
    process: {
      type: "positional",
      description: "Process slug to poll",
      required: true,
    },
    interval: {
      type: "string",
      description: "Polling interval in ms (overrides source config)",
    },
  },
  async run({ args }) {
    if (!args.process) {
      console.error("Usage: ditto trigger start <process> [--interval <ms>]");
      process.exit(1);
    }

    const intervalMs = args.interval ? parseInt(args.interval, 10) : undefined;
    if (args.interval && (isNaN(intervalMs!) || intervalMs! <= 0)) {
      console.error("Error: --interval must be a positive number (milliseconds)");
      process.exit(1);
    }

    try {
      await startPolling(args.process, intervalMs);
      const status = getPollingStatus();
      const poller = status.find((p) => p.processSlug === args.process);
      if (poller) {
        console.log(`Polling ${args.process} source every ${poller.intervalMs / 1000}s`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  },
});

export const triggerStopCommand = defineCommand({
  meta: {
    name: "stop",
    description: "Stop polling a process source",
  },
  args: {
    process: {
      type: "positional",
      description: "Process slug to stop polling",
      required: true,
    },
  },
  async run({ args }) {
    if (!args.process) {
      console.error("Usage: ditto trigger stop <process>");
      process.exit(1);
    }

    try {
      stopPolling(args.process);
      console.log(`Stopped polling ${args.process}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  },
});

export const triggerStatusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show active polling loops",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
  },
  async run({ args }) {
    const status = getPollingStatus();

    if (status.length === 0) {
      if (args.json) {
        console.log(JSON.stringify([], null, 2));
        return;
      }
      console.log("No active polling loops.");
      return;
    }

    if (args.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log(`ACTIVE TRIGGERS (${status.length})\n`);
    for (const s of status) {
      const lastCheck = s.lastCheck
        ? s.lastCheck.toISOString().slice(0, 19).replace("T", " ")
        : "never";
      const intervalSec = s.intervalMs / 1000;
      console.log(
        `  ${s.processSlug.padEnd(25)} polling | interval: ${intervalSec}s | source: ${s.service}.${s.action} | last check: ${lastCheck}`,
      );
    }
  },
});

export const triggerCommand = defineCommand({
  meta: {
    name: "trigger",
    description: "Manage process triggers",
  },
  subCommands: {
    start: triggerStartCommand,
    stop: triggerStopCommand,
    status: triggerStatusCommand,
  },
});
