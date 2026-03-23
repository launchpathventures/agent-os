/**
 * Ditto — Self Delegation (Tool Definitions + Handlers)
 *
 * Delegation tools for the Conversational Self. The Self delegates
 * to dev pipeline roles via structured tool_use — preventing prompt
 * injection from triggering process runs.
 *
 * Each tool maps to an existing engine function:
 * - start_dev_role → startProcessRun() + fullHeartbeat()
 * - consult_role → createCompletion() with role contract (Inline weight, Brief 034a)
 * - approve_review → approveRun()
 * - edit_review → editRun()
 * - reject_review → rejectRun()
 *
 * Provenance: Anthropic SDK tool use pattern (Brief 030, ADR-016).
 * Consultation pattern: ADR-017 Inline weight class (Brief 034a, Insight-063).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { LlmToolDefinition } from "./llm";
import { createCompletion, extractText } from "./llm";
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
  {
    name: "consult_role",
    description:
      "Quick check with a dev role's perspective. NOT a full delegation — just a lightweight LLM call that thinks from that role's viewpoint. Use this when you want a second opinion before deciding: 'Does this architecture make sense?' 'Am I interpreting this triage correctly?' Returns the role's perspective in ~10 seconds. Much cheaper than delegation.",
    input_schema: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: VALID_ROLES as unknown as string[],
          description: "Which role's perspective to consult",
        },
        question: {
          type: "string",
          description: "What you want the role's perspective on",
        },
        context: {
          type: "string",
          description:
            "Relevant context for the consultation (your current reasoning, the human's request, etc.)",
        },
      },
      required: ["role", "question"],
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
  /** Cost of this tool call in cents (used for decision tracking). */
  costCents?: number;
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

    case "consult_role":
      return await handleConsultRole(
        toolInput.role as string,
        toolInput.question as string,
        toolInput.context as string | undefined,
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

/**
 * Consult a dev role for a quick perspective check.
 * Inline weight (ADR-017) — no harness, no process run.
 * Loads the role contract and calls createCompletion() directly.
 *
 * Provenance: Role contract loading from src/adapters/claude.ts (Brief 031).
 * Consultation pattern: Insight-063 (two-loop metacognitive oversight).
 */
async function handleConsultRole(
  role: string,
  question: string,
  context?: string,
): Promise<DelegationResult> {
  if (!VALID_ROLES.includes(role as DevRole)) {
    return {
      toolName: "consult_role",
      success: false,
      output: `Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(", ")}`,
    };
  }

  try {
    // Load role contract — same pattern as src/adapters/claude.ts lines 160-174
    let roleContract: string;
    try {
      const contractPath = resolve(
        process.cwd(),
        ".claude",
        "commands",
        `dev-${role}.md`,
      );
      roleContract = readFileSync(contractPath, "utf-8");
    } catch {
      roleContract = `You are a ${role} on a software development team.`;
    }

    // Build consultation system prompt — terse framing + role contract
    const systemPrompt = `${roleContract}

---

You are being consulted briefly by a teammate (Ditto's Conversational Self). They want your perspective on a question. Be concise and direct — this is a quick check, not a full analysis. Give your honest assessment in 2-5 sentences.`;

    const userContent = context
      ? `Question: ${question}\n\nContext: ${context}`
      : `Question: ${question}`;

    const completion = await createCompletion({
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 1024,
    });

    const responseText = extractText(completion.content);

    return {
      toolName: "consult_role",
      success: true,
      output: `[${role} perspective]\n${responseText}`,
      costCents: completion.costCents,
    };
  } catch (err) {
    return {
      toolName: "consult_role",
      success: false,
      output: `Consultation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
