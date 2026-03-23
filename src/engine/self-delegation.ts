/**
 * Ditto — Self Delegation (Tool Definitions + Handlers)
 *
 * Delegation tools for the Conversational Self. The Self delegates
 * to dev pipeline roles via structured tool_use — preventing prompt
 * injection from triggering process runs.
 *
 * Each tool maps to an existing engine function:
 * - start_dev_role → startProcessRun() + fullHeartbeat()
 * - approve_review → approveRun()
 * - edit_review → editRun()
 * - reject_review → rejectRun()
 *
 * Provenance: Anthropic SDK tool use pattern (Brief 030, ADR-016).
 */

import type { LlmToolDefinition } from "./llm";
import { startProcessRun, fullHeartbeat } from "./heartbeat";
import { approveRun, editRun, rejectRun, getWaitingStepOutput } from "./review-actions";

// ============================================================
// Tool Definitions (Ditto-native format)
// ============================================================

const VALID_ROLES = [
  "pm",
  "researcher",
  "designer",
  "architect",
  "builder",
  "reviewer",
  "documenter",
] as const;

export type DevRole = (typeof VALID_ROLES)[number];

export const selfTools: LlmToolDefinition[] = [
  {
    name: "start_dev_role",
    description:
      "Delegate a task to a dev pipeline role. The role runs through the full harness (memory, trust, review, feedback). Use this when the human's request requires a specific dev role — PM for triage, Researcher for investigation, Architect for design, Builder for implementation, etc. The role executes and returns its output for you to synthesize.",
    input_schema: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: VALID_ROLES as unknown as string[],
          description: "Which dev role to delegate to",
        },
        task: {
          type: "string",
          description: "The task description for the role to execute",
        },
      },
      required: ["role", "task"],
    },
  },
  {
    name: "approve_review",
    description:
      "Approve a process run that is waiting for review. Use when the human confirms the output is acceptable.",
    input_schema: {
      type: "object" as const,
      properties: {
        runId: {
          type: "string",
          description: "The process run ID to approve",
        },
      },
      required: ["runId"],
    },
  },
  {
    name: "edit_review",
    description:
      "Provide feedback on a process run that is waiting for review. The feedback is recorded and the run continues with the correction.",
    input_schema: {
      type: "object" as const,
      properties: {
        runId: {
          type: "string",
          description: "The process run ID to edit",
        },
        feedback: {
          type: "string",
          description: "The feedback or correction to apply",
        },
      },
      required: ["runId", "feedback"],
    },
  },
  {
    name: "reject_review",
    description:
      "Reject a process run that is waiting for review. The rejection reason is recorded.",
    input_schema: {
      type: "object" as const,
      properties: {
        runId: {
          type: "string",
          description: "The process run ID to reject",
        },
        reason: {
          type: "string",
          description: "Why the output is being rejected",
        },
      },
      required: ["runId", "reason"],
    },
  },
];

// ============================================================
// Tool Handlers
// ============================================================

export interface DelegationResult {
  toolName: string;
  success: boolean;
  output: string;
}

/**
 * Execute a delegation tool call. Maps tool_use blocks to engine functions.
 */
export async function executeDelegation(
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<DelegationResult> {
  switch (toolName) {
    case "start_dev_role":
      return await handleStartDevRole(
        toolInput.role as string,
        toolInput.task as string,
      );

    case "approve_review":
      return await handleApproveReview(toolInput.runId as string);

    case "edit_review":
      return await handleEditReview(
        toolInput.runId as string,
        toolInput.feedback as string,
      );

    case "reject_review":
      return await handleRejectReview(
        toolInput.runId as string,
        toolInput.reason as string,
      );

    default:
      return {
        toolName,
        success: false,
        output: `Unknown tool: ${toolName}`,
      };
  }
}

/**
 * Delegate to a dev pipeline role via the engine harness.
 */
async function handleStartDevRole(
  role: string,
  task: string,
): Promise<DelegationResult> {
  if (!VALID_ROLES.includes(role as DevRole)) {
    return {
      toolName: "start_dev_role",
      success: false,
      output: `Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(", ")}`,
    };
  }

  const processSlug = `dev-${role}-standalone`;

  try {
    const runId = await startProcessRun(processSlug, { task }, "self");
    const result = await fullHeartbeat(runId);

    // Collect step outputs for synthesis
    let outputText = "";
    if (result.status === "waiting_review") {
      const stepOutput = await getWaitingStepOutput(runId);
      if (stepOutput) {
        outputText = stepOutput.outputText;
      }
    }

    return {
      toolName: "start_dev_role",
      success: true,
      output: outputText
        ? `Role: ${role}\nStatus: ${result.status}\nRun ID: ${runId}\n\n${outputText}`
        : `Role: ${role}\nStatus: ${result.status}\nRun ID: ${runId}\nSteps executed: ${result.stepsExecuted}\n${result.message}`,
    };
  } catch (err) {
    return {
      toolName: "start_dev_role",
      success: false,
      output: `Failed to run ${role}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function handleApproveReview(runId: string): Promise<DelegationResult> {
  try {
    const { action, heartbeat } = await approveRun(runId);
    return {
      toolName: "approve_review",
      success: action.success,
      output: `${action.message} Pipeline status: ${heartbeat.status}`,
    };
  } catch (err) {
    return {
      toolName: "approve_review",
      success: false,
      output: `Approve failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function handleEditReview(
  runId: string,
  feedback: string,
): Promise<DelegationResult> {
  try {
    const { action, heartbeat } = await editRun(runId, feedback);
    let output = `${action.message} Pipeline status: ${heartbeat.status}`;
    if (action.correctionPattern) {
      output += ` (Pattern detected: "${action.correctionPattern.pattern}" — ${action.correctionPattern.count} times)`;
    }
    return {
      toolName: "edit_review",
      success: action.success,
      output,
    };
  } catch (err) {
    return {
      toolName: "edit_review",
      success: false,
      output: `Edit failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function handleRejectReview(
  runId: string,
  reason: string,
): Promise<DelegationResult> {
  try {
    const result = await rejectRun(runId, reason);
    return {
      toolName: "reject_review",
      success: result.success,
      output: result.message,
    };
  } catch (err) {
    return {
      toolName: "reject_review",
      success: false,
      output: `Reject failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
