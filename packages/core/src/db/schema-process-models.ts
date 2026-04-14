/**
 * @ditto/core — Process Models Schema (Brief 104)
 *
 * Process models are a Ditto product feature (not an engine primitive).
 * The table definition lives in src/db/schema/product.ts — not in core.
 * This file exports only the type unions and validation report types
 * needed by core consumers (process-validator, library-manager).
 */

// Re-export from core schema for backward compatibility.
// Note: processModels table moved to product schema but these types
// are still needed by core consumers (process-validator, library-manager).

export const processModelStatusValues = [
  "nominated",
  "testing",
  "standardised",
  "review",
  "published",
  "archived",
] as const;
export type ProcessModelStatus = (typeof processModelStatusValues)[number];

export const processModelComplexityValues = [
  "simple",
  "moderate",
  "complex",
] as const;
export type ProcessModelComplexity =
  (typeof processModelComplexityValues)[number];

export const processModelSourceValues = [
  "template",
  "built",
  "community",
] as const;
export type ProcessModelSource = (typeof processModelSourceValues)[number];

// ============================================================
// Validation report types (used by process-validator + library-manager)
// ============================================================

export interface ValidationCheckResult {
  /** Check name: edge-case | compliance | efficiency | duplicate */
  check: string;
  /** What was tested */
  input: string;
  /** What was expected */
  expected: string;
  /** What actually happened */
  actual: string;
  /** Whether the check passed */
  pass: boolean;
  /** Optional details */
  details?: string;
}

export interface ValidationReport {
  /** Overall pass/fail */
  passed: boolean;
  /** Timestamp of validation */
  validatedAt: string;
  /** Individual check results */
  checks: ValidationCheckResult[];
  /** Summary recommendation */
  recommendation: string;
  /** Duplicate match info (if any) */
  duplicateMatch?: {
    slug: string;
    similarity: number;
    mergeRecommended: boolean;
  };
}
