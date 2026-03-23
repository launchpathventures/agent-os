/**
 * Ditto — The Conversational Self
 *
 * The outermost harness ring. Mediates between the human and the platform.
 * Assembles context, converses via LLM, delegates to dev pipeline roles,
 * mediates reviews, and persists sessions.
 *
 * The Self sits ABOVE the harness pipeline — it produces pipeline inputs,
 * not a handler in the pipeline. Delegated process steps go through the
 * harness normally.
 *
 * Provenance:
 * - Tiered context assembly: Letta core memory blocks (always-in-context identity + recall)
 * - Session lifecycle: LangGraph checkpointing (adapted for conversation state)
 * - Consultative framing: Insight-053 (listen → assess → ask → reflect → hand off)
 * - Delegation via tool_use: Anthropic SDK pattern (prevents prompt injection)
 * - ADR-016 (Conversational Self), Brief 030
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  createCompletion,
  extractText,
  extractToolUse,
  type LlmMessage,
  type LlmToolResultBlock,
} from "./llm";
import {
  loadWorkStateSummary,
  loadSelfMemories,
  loadSessionTurns,
  getOrCreateSession,
  appendSessionTurn,
  type SessionTurn,
} from "./self-context";
import { selfTools, executeDelegation } from "./self-delegation";

// ============================================================
// Constants
// ============================================================

/** Token budget for always-loaded Self context (~4K tokens) */
const SELF_CONTEXT_TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN = 4;

/** Maximum tool_use turns in a single conversation cycle (prevents runaway loops) */
const MAX_TOOL_TURNS = 10;

// ============================================================
// Context Assembly
// ============================================================

export interface SelfContext {
  systemPrompt: string;
  sessionId: string;
  resumed: boolean;
  previousSummary: string | null;
}

/**
 * Assemble the Self's operating context for a conversation turn.
 *
 * Loads and combines:
 * 1. Cognitive framework (cognitive/self.md) — core identity
 * 2. Self-scoped memories — user knowledge, preferences, corrections
 * 3. Work state summary — active runs, pending reviews, recent activity
 * 4. Session state — new/resumed, previous session summary if relevant
 *
 * Total always-loaded content fits within ~4K tokens.
 *
 * AC1: Returns structured system prompt with all context tiers.
 */
export async function assembleSelfContext(
  userId: string,
  surface: "cli" | "telegram" | "web",
): Promise<SelfContext> {
  // 1. Load cognitive framework
  let cognitiveFramework: string;
  try {
    cognitiveFramework = readFileSync(
      join(process.cwd(), "cognitive", "self.md"),
      "utf-8",
    );
  } catch {
    cognitiveFramework = "You are Ditto. A competent, persistent entity that helps work evolve.";
  }

  // 2. Load self-scoped memories (budget: ~1K tokens of the 4K total)
  const memories = await loadSelfMemories(userId, 1000);

  // 3. Load work state summary
  const workState = await loadWorkStateSummary();

  // 4. Get or create session
  const { sessionId, resumed, previousSummary } = await getOrCreateSession(
    userId,
    surface,
  );

  // Assemble system prompt within token budget
  const sections: string[] = [];

  // Core identity (always loaded, largest section)
  sections.push(cognitiveFramework);

  // User knowledge from self-scoped memories
  if (memories) {
    sections.push(`<memories>\n${memories}\n</memories>`);
  }

  // Work state snapshot
  sections.push(
    `<work_state>\n${workState.details}\n</work_state>`,
  );

  // Delegation guidance — when to use tools vs respond directly
  sections.push(
    `<delegation_guidance>
You have tools to delegate work to dev pipeline roles. Use them ONLY when the human is requesting actual work — research, design, architecture, building, reviewing, or triaging.

Do NOT delegate for:
- Greetings, casual conversation, or check-ins
- Status questions (you already have work state above)
- Clarifying questions or consultative framing
- Anything you can answer from your loaded context

When the human's first message is casual, respond conversationally using the work state you already have. Be the competent teammate — you don't need to call in a specialist to say good morning.

Delegation is expensive (spawns a full process run). Only delegate when there is a concrete task that needs a specific role's expertise.
</delegation_guidance>`,
  );

  // Surface context
  sections.push(
    `<context>\nSurface: ${surface}\nSession: ${resumed ? "resumed" : "new"}\n</context>`,
  );

  // Previous session summary (if new session after suspension)
  if (previousSummary && !resumed) {
    sections.push(
      `<previous_session>\n${previousSummary}\n</previous_session>`,
    );
  }

  // Budget check — truncate if over ~4K tokens
  let systemPrompt = sections.join("\n\n");
  const charBudget = SELF_CONTEXT_TOKEN_BUDGET * CHARS_PER_TOKEN;
  if (systemPrompt.length > charBudget) {
    // Truncate memories first (they're the most expendable)
    const withoutMemories = sections.filter((s) => !s.startsWith("<memories>"));
    systemPrompt = withoutMemories.join("\n\n");
    if (systemPrompt.length > charBudget) {
      systemPrompt = systemPrompt.slice(0, charBudget - 20) + "\n... (context truncated)";
    }
  }

  return { systemPrompt, sessionId, resumed, previousSummary };
}

// ============================================================
// Conversation Loop
// ============================================================

export interface SelfConverseResult {
  response: string;
  sessionId: string;
  delegationsExecuted: number;
  costCents: number;
}

/**
 * Optional callbacks for intermediate events during conversation.
 * Allows the surface (e.g., Telegram bot) to provide real-time feedback
 * while the Self is processing — especially during long-running delegations.
 */
export interface SelfConverseCallbacks {
  /** Called when the LLM produces text before a delegation (e.g., "I'll hand this to the PM...") */
  onIntermediateText?: (text: string) => Promise<void>;
  /** Called just before a delegation tool executes */
  onDelegationStart?: (toolName: string, input: Record<string, unknown>) => Promise<void>;
}

/**
 * Process a human message through the Conversational Self.
 *
 * Flow:
 * 1. Assemble context (cognitive framework + memories + work state + session)
 * 2. Load session turns as conversation history
 * 3. Call LLM via createCompletion() with tool_use for delegation
 * 4. Handle tool_use calls (delegation to dev roles, review actions)
 * 5. Append turns to session
 * 6. Return synthesized response
 *
 * AC2: Full conversation cycle through the Self.
 * AC9: Uses createCompletion() from llm.ts, not claude -p.
 */
export async function selfConverse(
  userId: string,
  message: string,
  surface: "cli" | "telegram" | "web",
  callbacks?: SelfConverseCallbacks,
): Promise<SelfConverseResult> {
  // 1. Assemble context
  const context = await assembleSelfContext(userId, surface);

  // 2. Load session turns as conversation history
  const priorTurns = await loadSessionTurns(context.sessionId, 2000);

  // Build messages array from session history + new message
  const messages: LlmMessage[] = [];

  for (const turn of priorTurns) {
    messages.push({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    });
  }

  // Add the new human message
  messages.push({ role: "user", content: message });

  // 3. Record user turn
  await appendSessionTurn(context.sessionId, {
    role: "user",
    content: message,
    timestamp: Date.now(),
    surface,
  });

  // 4. Conversation loop — handle tool_use calls
  let delegationsExecuted = 0;
  let totalCostCents = 0;
  let finalResponse = "";

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const completion = await createCompletion({
      system: context.systemPrompt,
      messages,
      tools: selfTools,
      maxTokens: 4096,
    });

    totalCostCents += completion.costCents;

    // Extract text and tool_use blocks
    const textContent = extractText(completion.content);
    const toolUses = extractToolUse(completion.content);

    if (toolUses.length === 0) {
      // No tool calls — this is the final response
      finalResponse = textContent;
      break;
    }

    // There are tool calls — execute delegations
    // Send intermediate text to the surface immediately (before delegation runs)
    if (textContent && callbacks?.onIntermediateText) {
      await callbacks.onIntermediateText(textContent);
    }

    // First, add the assistant's response (with tool_use blocks) to messages
    messages.push({
      role: "assistant",
      content: completion.content,
    });

    // Execute each tool call and collect results
    const toolResults: LlmToolResultBlock[] = [];

    for (const toolUse of toolUses) {
      delegationsExecuted++;

      // Notify surface before delegation starts
      if (callbacks?.onDelegationStart) {
        await callbacks.onDelegationStart(toolUse.name, toolUse.input as Record<string, unknown>);
      }

      const result = await executeDelegation(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.output,
      });
    }

    // Add tool results as user message (Anthropic API convention)
    messages.push({
      role: "user",
      content: toolResults,
    });

    // Accumulate intermediate text for session recording
    // (already sent to user via callback if available)
    if (textContent) {
      finalResponse += textContent + "\n";
    }
  }

  // 5. Record assistant turn
  await appendSessionTurn(context.sessionId, {
    role: "assistant",
    content: finalResponse,
    timestamp: Date.now(),
    surface,
  });

  return {
    response: finalResponse,
    sessionId: context.sessionId,
    delegationsExecuted,
    costCents: totalCostCents,
  };
}
