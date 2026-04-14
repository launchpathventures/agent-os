/**
 * Ditto — Front Door Block Construction (Brief 137)
 *
 * Pure function: conversation state → ContentBlock[].
 * No LLM calls, no DB access, no side effects.
 *
 * Follows the same deterministic pattern as toolResultToContentBlocks
 * in self-stream.ts (Brief 069) — "parse, don't invent."
 *
 * Provenance: Brief 137, Insight-177, self-stream.ts pattern.
 */

import type { ContentBlock, ProcessProposalBlock, RecordBlock } from "./content-blocks";
import type { DetectedMode, ConversationStage } from "./network-chat-prompt";

// ============================================================
// Input type
// ============================================================

/** Matches the LearnedContext shape from network-chat.ts */
interface LearnedFields {
  name?: string | null;
  business?: string | null;
  role?: string | null;
  industry?: string | null;
  location?: string | null;
  target?: string | null;
  problem?: string | null;
  channel?: string | null;
}

export interface FrontDoorBlockArgs {
  plan: string | null;
  detectedMode: DetectedMode;
  learned: LearnedFields | null;
  stage: ConversationStage;
  enrichmentText: string | null;
}

// ============================================================
// Plan → ProcessProposalBlock
// ============================================================

/**
 * Parse a plan string (from the LLM's `plan` tool field) into
 * ProcessProposalBlock steps. The LLM typically emits numbered
 * lists or line-separated steps.
 */
function parsePlanSteps(plan: string): Array<{ name: string; description?: string; status: "pending" }> {
  // Split on numbered list patterns (1. / 1) / -) or newlines
  const lines = plan
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [{ name: plan.trim(), status: "pending" }];
  }

  // Strip leading numbering/bullets
  const steps = lines.map((line) => {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, "").replace(/^[-–—•]\s*/, "").trim();
    return { name: cleaned || line, status: "pending" as const };
  });

  return steps.length > 0 ? steps : [{ name: plan.trim(), status: "pending" }];
}

function buildProcessProposalFromPlan(plan: string): ProcessProposalBlock {
  return {
    type: "process_proposal",
    name: "Proposed approach",
    steps: parsePlanSteps(plan),
    interactive: false,
  };
}

// ============================================================
// Learned context → RecordBlock
// ============================================================

function buildRecordFromContext(
  learned: LearnedFields,
  detectedMode: DetectedMode,
): RecordBlock {
  const fields: Array<{ label: string; value: string }> = [];

  if (learned.business) {
    fields.push({ label: "Business", value: learned.business });
  }
  if (learned.target) {
    fields.push({ label: "Looking for", value: learned.target });
  }
  if (learned.problem) {
    fields.push({ label: "Problem", value: learned.problem });
  }
  if (learned.industry) {
    fields.push({ label: "Industry", value: learned.industry });
  }

  const modeLabel =
    detectedMode === "connector" ? "Connecting" :
    detectedMode === "sales" ? "Outreach" :
    detectedMode === "cos" ? "Chief of Staff" :
    detectedMode === "both" ? "Connecting + CoS" :
    "Researching";

  return {
    type: "record",
    title: learned.target || "Your brief",
    status: { label: modeLabel, variant: "info" },
    fields: fields.length > 0 ? fields : undefined,
    provenance: ["conversation"],
  };
}

// ============================================================
// Main: buildFrontDoorBlocks
// ============================================================

/**
 * Deterministically construct content blocks from conversation state.
 * Returns 0-2 blocks. Never throws — catches errors and returns [].
 */
export function buildFrontDoorBlocks(args: FrontDoorBlockArgs): ContentBlock[] {
  try {
    const { plan, detectedMode, learned, stage, enrichmentText } = args;

    // GATHER stage: no blocks
    if (stage === "gather") return [];

    const blocks: ContentBlock[] = [];

    // REFLECT: plan → ProcessProposalBlock
    if (plan) {
      blocks.push(buildProcessProposalFromPlan(plan));
    }

    // ACTIVATE: enrichment + connector/sales → RecordBlock
    if (
      stage === "activate" &&
      enrichmentText &&
      learned &&
      (detectedMode === "connector" || detectedMode === "sales" || detectedMode === "both")
    ) {
      blocks.push(buildRecordFromContext(learned, detectedMode));
    }

    // Max 2 blocks
    return blocks.slice(0, 2);
  } catch (err) {
    console.warn("[network-chat-blocks] Block construction failed:", (err as Error).message);
    return [];
  }
}
