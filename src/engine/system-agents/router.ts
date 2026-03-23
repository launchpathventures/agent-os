/**
 * Router — System Agent Module
 *
 * LLM-based process routing (Mode 2). Receives active domain process
 * descriptions as context and selects the best matching process for a work item.
 *
 * Uses the Anthropic SDK directly (not the ai-agent executor path) to maintain
 * structured JSON output control. Goes through the harness pipeline via the
 * script executor + systemAgent pattern, same as other system agents.
 *
 * Provenance: Inngest AgentKit RoutingAgent + Mastra Networks schema-driven routing
 */

import type { StepExecutionResult } from "../step-executor";
import { createCompletion, extractText, getConfiguredModel } from "../llm";

interface RoutingResult {
  processSlug: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

interface ProcessSummary {
  slug: string;
  name: string;
  description: string;
}

/**
 * Execute routing as a system agent step.
 * Receives work item content + available process descriptions from run inputs.
 * Returns the best matching process slug (or null if no match).
 */
export async function executeRouter(
  inputs: Record<string, unknown>,
): Promise<StepExecutionResult> {
  const content = inputs.content as string;
  const workItemType = inputs.workItemType as string;
  const availableProcesses = inputs.availableProcesses as ProcessSummary[];

  if (!content) {
    throw new Error("Router requires content input");
  }

  if (!availableProcesses || availableProcesses.length === 0) {
    // No processes to route to — return null match
    return {
      outputs: {
        "routing-result": {
          processSlug: null,
          confidence: "high",
          reasoning: "No active domain processes available for routing",
        } satisfies RoutingResult,
      },
      confidence: "high",
      logs: ["No active domain processes available — nothing to route to"],
    };
  }

  // Build the routing prompt
  const processDescriptions = availableProcesses
    .map((p) => `- **${p.name}** (slug: \`${p.slug}\`): ${p.description || "No description"}`)
    .join("\n");

  const systemPrompt = `You are a work item router for Ditto. Your job is to match incoming work items to the best available process.

You MUST respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{
  "processSlug": "<slug of the best matching process, or null if no match>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one sentence explaining your choice>"
}

Rules:
- Select the process whose description best matches the work item content
- If no process is a reasonable match, return processSlug: null
- confidence "high" = strong match, "medium" = plausible match, "low" = weak/uncertain match
- Only select from the provided processes — never invent a slug`;

  const userMessage = `## Work Item
Type: ${workItemType || "unknown"}
Content: ${content}

## Available Processes
${processDescriptions}`;

  try {
    const response = await createCompletion({
      model: getConfiguredModel(),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 256,
    });

    const text = extractText(response.content);

    // Parse the JSON response
    const result = parseRoutingResponse(text, availableProcesses);

    return {
      outputs: {
        "routing-result": result,
      },
      tokensUsed: response.tokensUsed,
      costCents: response.costCents,
      confidence: result.confidence,
      logs: [
        `Routed to: ${result.processSlug ?? "none"}`,
        `Confidence: ${result.confidence}`,
        `Reasoning: ${result.reasoning}`,
        `Tokens: ${response.tokensUsed}`,
      ],
    };
  } catch (error) {
    // On API failure, return no match with low confidence
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      outputs: {
        "routing-result": {
          processSlug: null,
          confidence: "low",
          reasoning: `Routing failed: ${errMsg}`,
        } satisfies RoutingResult,
      },
      confidence: "low",
      logs: [`Router API call failed: ${errMsg}`],
    };
  }
}

/**
 * Parse the LLM's JSON response, validating the process slug exists.
 */
function parseRoutingResponse(
  text: string,
  availableProcesses: ProcessSummary[],
): RoutingResult {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned) as RoutingResult;

    // Validate the slug exists in available processes
    if (parsed.processSlug) {
      const found = availableProcesses.find((p) => p.slug === parsed.processSlug);
      if (!found) {
        return {
          processSlug: null,
          confidence: "low",
          reasoning: `LLM suggested "${parsed.processSlug}" which is not an available process`,
        };
      }
    }

    return {
      processSlug: parsed.processSlug ?? null,
      confidence: parsed.confidence || "medium",
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch {
    return {
      processSlug: null,
      confidence: "low",
      reasoning: `Failed to parse routing response: ${text.slice(0, 100)}`,
    };
  }
}
