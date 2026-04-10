/**
 * @ditto/core — Duration Parser
 *
 * Parses human-readable duration strings (e.g. "4h", "3d", "2w") into milliseconds.
 * Used by step primitives: schedule.delay, wait_for.timeout.
 *
 * Supported units: m (minutes), h (hours), d (days), w (weeks).
 *
 * Provenance: Temporal.Duration / ms (npm) — pattern-level adoption.
 */

const UNIT_MS: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a duration string into milliseconds.
 *
 * @param duration - e.g. "4h", "3d", "2w", "30m"
 * @returns milliseconds
 * @throws Error if the format is invalid
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^([1-9]\d*)(m|h|d|w)$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Expected <number><unit> where unit is m, h, d, or w (e.g. "4h", "3d", "2w"). Number must be positive with no leading zeros.`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * UNIT_MS[unit];
}

/**
 * Validate a duration string without throwing.
 * Returns true if parseDuration() would succeed.
 */
export function isValidDuration(duration: string): boolean {
  try {
    parseDuration(duration);
    return true;
  } catch {
    return false;
  }
}
