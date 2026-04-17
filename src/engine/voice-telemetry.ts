/**
 * Voice Telemetry Helper (Brief 180)
 *
 * Thin wrapper over the `voice_events` table. Used by the guidance route,
 * transcript route, and the public /voice/telemetry endpoint (which is
 * called from the browser). Writes are best-effort — a failed insert must
 * not break the voice pipeline.
 */

import { db, schema } from "../db";
import type { VoiceEvent } from "../db/schema/frontdoor";

const METADATA_MAX_BYTES = 4_000;
const MAX_STRING_LEN = 200;
const MAX_DEPTH = 5;
const PII_KEYS = new Set(["email", "name", "phone", "transcript"]);

function sanitizeValue(v: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v.length > MAX_STRING_LEN ? v.slice(0, MAX_STRING_LEN) : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitizeValue(inner, depth + 1);
    }
    return out;
  }
  return String(v).slice(0, MAX_STRING_LEN);
}

/**
 * Defensive metadata sanitizer. The table comment forbids PII (emails, raw
 * transcripts, names). We recursively strip keys that look sensitive and
 * truncate oversized strings at every depth so a nested payload like
 * `{ user: { email: "x" } }` cannot smuggle PII through. Callers should
 * still pass the smallest useful shape.
 */
function sanitize(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!metadata) return null;
  const out = sanitizeValue(metadata, 0) as Record<string, unknown>;
  const json = JSON.stringify(out);
  if (json.length > METADATA_MAX_BYTES) {
    return { truncated: true };
  }
  return out;
}

export async function recordVoiceEvent(
  sessionId: string,
  event: VoiceEvent,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!sessionId) return;
  await db.insert(schema.voiceEvents).values({
    sessionId,
    event,
    metadata: sanitize(metadata),
  });
}

/**
 * Fire-and-forget variant. Swallows errors so telemetry cannot break the
 * voice pipeline. Safe to call from hot paths.
 */
export function recordVoiceEventSafe(
  sessionId: string,
  event: VoiceEvent,
  metadata?: Record<string, unknown>,
): void {
  recordVoiceEvent(sessionId, event, metadata).catch((err) => {
    console.warn("[voice-telemetry] Insert failed:", (err as Error).message);
  });
}
