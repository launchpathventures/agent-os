/**
 * Ditto — Cognitive Core Loader
 *
 * Re-exported from @ditto/core. The canonical definitions live in packages/core.
 * Also contains Ditto-specific mode resolution logic (resolveModeFromProcess).
 */

export {
  getCognitiveCore,
  getCognitiveCoreCompact,
  getCognitiveModeExtension,
  clearCognitiveCoreCache,
  configureCognitivePath,
  extractSections,
} from "@ditto/core";

// ============================================================
// Mode Resolution (Ditto product layer — Brief 114)
// ============================================================

/**
 * Resolve a cognitive mode from process operator and ID.
 *
 * Both operator AND process ID must match for a mode to resolve.
 * This is Ditto-specific logic — it enforces the three-layer persona
 * architecture (selling mode is blocked for alex-or-mira operator).
 *
 * Returns the mode name (e.g. "connecting") or null if no mode matches.
 */
export function resolveModeFromProcess(
  operator: string | undefined | null,
  processId: string,
): string | null {
  if (!operator) return null;

  switch (operator) {
    case "alex-or-mira":
      if (processId.startsWith("connecting-")) return "connecting";
      if (processId.includes("nurture")) return "nurturing";
      // Persona guard: selling mode is BLOCKED for alex-or-mira
      return null;

    case "user-agent":
      if (processId.startsWith("selling-") || processId.startsWith("follow-up-"))
        return "selling";
      return null;

    case "ditto":
      if (
        processId === "weekly-briefing" ||
        processId.startsWith("front-door-cos-") ||
        processId.startsWith("analytics-") ||
        processId.startsWith("pipeline-") ||
        processId.startsWith("inbox-") ||
        processId.startsWith("meeting-")
      )
        return "chief-of-staff";
      return null;

    default:
      return null;
  }
}

/**
 * Resolve ghost mode override from sending identity.
 * When a step has sendingIdentity: "ghost", ghost mode is loaded
 * REGARDLESS of the process operator. This is because ghost mode
 * is identity-driven, not operator-driven.
 *
 * Returns "ghost" if sendingIdentity is "ghost", null otherwise.
 * The caller should prefer this over resolveModeFromProcess when non-null.
 */
export function resolveGhostModeOverride(
  sendingIdentity: string | null | undefined,
): string | null {
  return sendingIdentity === "ghost" ? "ghost" : null;
}
