/**
 * POST /api/v1/voice/telemetry — client-side voice event recorder (Brief 180)
 *
 * Accepts `{ sessionId, voiceToken, event, metadata }` and writes to the
 * `voice_events` table. Used by the browser to emit push/pull observability
 * events from voice-call.tsx (push_fired, push_deduped, get_context_called, etc.).
 *
 * voiceToken validates that the caller owns the session. Writes are guarded
 * to the documented `voiceEventValues` set so unknown values cannot create
 * garbage rows.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-session rate limit: cap how many telemetry events a single live call can
// emit per minute. A legitimate call emits a handful per user turn — 120/min
// is generous headroom while cutting off runaway/compromised clients. Entries
// are pruned lazily on read.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 120;
const rateBuckets = new Map<string, number[]>();

function allowRequest(sessionId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const stamps = rateBuckets.get(sessionId) ?? [];
  const fresh = stamps.filter((t) => t > cutoff);
  if (fresh.length >= RATE_LIMIT_MAX_EVENTS) {
    rateBuckets.set(sessionId, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(sessionId, fresh);
  // Opportunistic cleanup so we don't accumulate buckets for dead sessions.
  if (rateBuckets.size > 1_000) {
    for (const [k, v] of rateBuckets) {
      const kept = v.filter((t) => t > cutoff);
      if (kept.length === 0) rateBuckets.delete(k);
      else rateBuckets.set(k, kept);
    }
  }
  return true;
}

export async function POST(request: Request) {
  try {
    try {
      const { config } = await import("dotenv");
      const path = await import("path");
      config({ path: path.resolve(process.cwd(), "../../.env") });
    } catch { /* env vars may be set via platform */ }

    const body = await request.json();
    const { sessionId, voiceToken, event, metadata } = body as {
      sessionId?: string;
      voiceToken?: string;
      event?: string;
      metadata?: Record<string, unknown>;
    };

    if (!sessionId || !voiceToken || !event) {
      return NextResponse.json({ error: "Missing sessionId, voiceToken, or event" }, { status: 400 });
    }

    if (!allowRequest(sessionId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { loadSessionForVoice } = await import(
      "../../../../../../../src/engine/network-chat"
    );
    const session = await loadSessionForVoice(sessionId, voiceToken);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { voiceEventValues } = await import(
      "../../../../../../../src/db/schema/frontdoor"
    );
    if (!(voiceEventValues as readonly string[]).includes(event)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }

    const { recordVoiceEvent } = await import(
      "../../../../../../../src/engine/voice-telemetry"
    );
    await recordVoiceEvent(sessionId, event as typeof voiceEventValues[number], metadata);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[voice/telemetry] Error:", (err as Error).message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
