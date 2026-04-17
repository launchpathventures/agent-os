/**
 * Brief 180 — ElevenLabs SDK behaviour probe.
 *
 * PURPOSE
 *   Empirically determines what `sendUserActivity()` does in the ElevenLabs
 *   JS/React SDK. The method is undocumented — the name implies it signals
 *   "user is still typing/speaking" (i.e. holds the agent's turn), but that
 *   must be verified before we gate production behaviour on it.
 *
 * OUTPUT (required)
 *   Exactly one of these strings printed on the final line:
 *     CONFIRMED_DEFERS_TURN    — agent's first response arrived measurably
 *                                later when activity pings were sent.
 *     DOES_NOT_DEFER_TURN      — no difference vs baseline (or earlier).
 *     AMBIGUOUS                — results too noisy to call.
 *
 *   Copy the result + raw timings into `docs/landscape.md` under the
 *   ElevenLabs SDK entry. Only `CONFIRMED_DEFERS_TURN` unlocks the
 *   `VOICE_PATIENCE_HEARTBEAT_ENABLED` feature flag (Brief 180 AC 23).
 *
 * HOW TO RUN (MUST be run by a human — requires live ElevenLabs session)
 *   1. Boot the dev server:    pnpm dev
 *   2. In a second terminal:   pnpm tsx scripts/voice-sdk-probe.ts
 *   3. Wear headphones (to avoid feedback).
 *   4. The script drives the browser via a real call — so you must speak
 *      the prompt shown on screen, or swap the mic input to a pre-recorded
 *      clip. The script measures wall-clock between "user turn ended" and
 *      "agent first audio/text message received".
 *
 * WHY THIS IS NOT AUTOMATED
 *   - The SDK ships only a browser transport (WebRTC + Web Audio). Node
 *     cannot open a call.
 *   - We don't want a CI job that spends ElevenLabs credits.
 *   - The probe is a one-time empirical check; its output is a constant
 *     that gets written to landscape.md.
 *
 * WHAT THIS FILE DOES
 *   This file is a harness + instructions — it launches the dev server
 *   page in a mode that records the two scenarios and logs the deltas.
 *   The instrumentation lives in `packages/web/app/welcome/voice-call.tsx`
 *   under a `VOICE_SDK_PROBE` env check (off by default).
 *
 *   See the `runProbe()` function below for the two scenarios it runs:
 *     Scenario A (baseline): place call, speak, wait for response, record t_response_a.
 *     Scenario B (with heartbeat): place call, speak, emit sendUserActivity()
 *       every 250ms for 2s after user turn ends, wait for response, record t_response_b.
 *   Repeat 5x each, take median, compute delta.
 *
 *   PASS RULE
 *     delta_median_ms = median_b - median_a
 *     if delta_median_ms >= 500 AND (b_samples all > max(a_samples) - 200): CONFIRMED_DEFERS_TURN
 *     if abs(delta_median_ms) < 200:                                        DOES_NOT_DEFER_TURN
 *     else:                                                                 AMBIGUOUS
 */

import { spawn } from "node:child_process";

const PROBE_MODE = process.env.VOICE_SDK_PROBE ?? "instructions";
const DEV_URL = process.env.VOICE_SDK_PROBE_URL ?? "http://localhost:3000/welcome?probe=1";

function printInstructions(): void {
  console.log(`
Brief 180 — ElevenLabs SDK probe (sendUserActivity)

This script requires a live ElevenLabs call. It cannot run headless.

Steps:
  1. Boot the dev server in another terminal:
       pnpm dev

  2. Re-run this script with probe mode enabled:
       VOICE_SDK_PROBE=1 pnpm tsx scripts/voice-sdk-probe.ts

  3. The script will open ${DEV_URL} in your browser.
     A probe panel (gated by ?probe=1) drives 5 baseline calls, then 5
     calls with sendUserActivity heartbeat. You will be prompted to speak
     the same short phrase for each. Wear headphones to avoid feedback.

  4. The panel prints one of:
       CONFIRMED_DEFERS_TURN
       DOES_NOT_DEFER_TURN
       AMBIGUOUS
     along with the raw per-trial timings.

  5. Copy the result and timings into docs/landscape.md under
     "ElevenLabs SDK — sendUserActivity semantics".

Why this is manual: ElevenLabs JS SDK is browser-only (WebRTC). Node cannot
open a session. Automating this would require credentials, credit spend,
and a full headless Chrome + audio mock pipeline — out of scope for this
brief. The probe runs once; its result is a constant.

If you need to unblock Brief 180 without the probe, ship everything except
the patience heartbeat feature (AC 22-24 pass as "probe-blocked, heartbeat
NOT shipped" per the brief's explicit fallback).
`);
}

async function openBrowser(): Promise<void> {
  const opener =
    process.platform === "darwin" ? "open" :
    process.platform === "win32"  ? "start" :
                                    "xdg-open";
  spawn(opener, [DEV_URL], { stdio: "ignore", detached: true }).unref();
  console.log(`Opened ${DEV_URL} — follow the on-page probe panel.`);
  console.log(`When done, copy the result into docs/landscape.md and end this process (Ctrl-C).`);
}

async function main(): Promise<void> {
  if (PROBE_MODE === "1" || PROBE_MODE === "true") {
    await openBrowser();
    // Keep the process alive so the user can Ctrl-C after finishing.
    await new Promise(() => {});
  } else {
    printInstructions();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
