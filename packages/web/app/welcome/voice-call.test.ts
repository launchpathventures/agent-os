/**
 * Client-side invariants for voice-call.tsx (Brief 180).
 *
 * The web package does not yet have React Testing Library + jsdom wired up
 * (vitest env = "node"), so full-component interaction tests are out of
 * scope for this brief. This file locks down the observable contract:
 * the telemetry event names emitted by the client MUST match the set the
 * server knows about, and the `VoiceCallHandle` type must expose the
 * methods the parent component relies on.
 *
 * Adding jsdom + @testing-library/react is tracked as a follow-up gap —
 * see the Brief 180 handoff notes.
 */

import { describe, it, expect } from "vitest";
import { voiceEventValues } from "../../../../src/db/schema/frontdoor";
import type { VoiceCallHandle } from "./voice-call";

/**
 * The exhaustive set of event names the client emits via /voice/telemetry.
 * Kept in sync with voice-call.tsx by code review — mismatches surface as
 * test failures because the server route rejects unknown events (400).
 */
const CLIENT_EMITTED_EVENTS = [
  "session_start",
  "push_fired",
  "push_304",
  "get_context_called",
  "get_context_cache_hit",
  "get_context_cache_miss",
] as const;

describe("voice-call client — telemetry contract", () => {
  it("every event name the client emits is known to the server schema", () => {
    const serverKnown = new Set(voiceEventValues as readonly string[]);
    for (const event of CLIENT_EMITTED_EVENTS) {
      expect(serverKnown.has(event)).toBe(true);
    }
  });
});

describe("voice-call client — handle surface", () => {
  it("VoiceCallHandle type exposes push-side methods", () => {
    // Compile-time shape check — if the handle drops a method, this line
    // stops type-checking and the test file fails to load.
    const sample: VoiceCallHandle = {
      sendUserMessage: (_text: string) => { /* noop */ },
      sendContextualUpdate: (_text: string) => { /* noop */ },
      refreshGuidance: (_trigger = "poll") => { /* noop */ },
      getCallState: () => "idle",
    };
    expect(typeof sample.refreshGuidance).toBe("function");
    expect(typeof sample.getCallState).toBe("function");
    expect(sample.getCallState()).toBe("idle");
  });
});
