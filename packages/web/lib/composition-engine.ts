/**
 * Ditto — Composition Engine (Brief 073)
 *
 * Deterministic composition functions per intent. Each returns ContentBlock[].
 * NO LLM calls — pure data queries on CompositionContext.
 *
 * This module re-exports and enhances the per-intent composition functions
 * from lib/compositions/ with proper empty states from composition-empty-states.ts.
 *
 * Provenance: Brief 073 (Composition Intent Activation), ADR-024 (deterministic composition).
 */

export {
  composeToday,
  composeInbox,
  composeWork,
  composeProjects,
  composeRoutines,
  composeRoadmap,
} from "./compositions";

export type { CompositionIntent, CompositionContext } from "./compositions/types";
