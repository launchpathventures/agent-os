/**
 * Bridge Dispatcher (Brief 212).
 *
 * Cloud-side dispatcher for the Workspace Local Bridge. Resolves the target
 * device (deviceId + optional fallbackDeviceIds), persists a `bridge_jobs`
 * row, sends the JSON-RPC request over the WebSocket if the device is online
 * and trust has advanced, and writes one `harness_decisions` row keyed on
 * stepRunId per Insight-180.
 *
 * Trust is decided UPSTREAM by `trust-gate.ts`. The dispatcher honours
 * `trustAction`:
 *   - `pause` / `sample_pause` → `bridge_jobs.state = queued`; wire send
 *     waits for `/review/[token]` Approve.
 *   - `advance` / `sample_advance` → wire send happens immediately when the
 *     device is online; otherwise the row stays in `queued` until the
 *     daemon reconnects.
 *   - `critical` is rejected at the tool resolver BEFORE this function is
 *     reached (see AC #4).
 *
 * Brief 212 AC #3 — stepRunId guard at function entry. AC #4 — fallback
 * routing rules. AC #13 — `harness_decisions.reviewDetails.bridge` schema.
 */

import { and, eq } from "drizzle-orm";
import {
  bridgeJobs,
  bridgeDevices,
  harnessDecisions,
  type TrustTier,
  type TrustAction,
  type BridgeJobRoutedAs,
} from "../../db/schema";
import { db as appDb } from "../../db";
import type {
  BridgePayload,
  BridgeExecPayload,
} from "@ditto/core";
import { scrubCredentialsFromValue } from "../integration-handlers/scrub";

const TEST_MODE = process.env.DITTO_TEST_MODE === "true";

/** Online window — a device is "online" if its WebSocket is connected
 *  OR its lastDialAt is within this many ms (the daemon's pong cadence is
 *  60s; 5 min covers brief reconnect storms without false negatives). */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface BridgeDispatchInput {
  /** Insight-180 — required. Bypassed only in DITTO_TEST_MODE. */
  stepRunId: string;
  /** Used to FK the `bridge_jobs.processRunId` and `harness_decisions` row. */
  processRunId: string;
  /** Upstream trust decision — recorded faithfully on the audit row. */
  trustTier: TrustTier;
  trustAction: TrustAction;
  /** Optional primary device. If omitted, routes to the workspace's only `active` device. */
  deviceId?: string;
  /** Optional ordered fallback chain. First online device wins. */
  fallbackDeviceIds?: string[];
  /** The exec / tmux.send payload. Discriminated by `kind`. */
  payload: BridgePayload;
  /** Optional workspace scope when omitting deviceId; defaults to "default". */
  workspaceId?: string;
}

export interface BridgeDispatchDeps {
  db?: typeof appDb;
  /** Returns true if the device is currently online (WebSocket OR recent dial). */
  isDeviceOnline?: (deviceId: string) => boolean | Promise<boolean>;
  /**
   * Pushes the JSON-RPC request to the daemon's WebSocket. Provided by the
   * bridge-server module at runtime. Returns true when the frame was queued
   * to the device's socket; false when the device dropped between the
   * online-check and the send.
   */
  sendOverWire?: (jobId: string, deviceId: string, payload: BridgePayload) => Promise<boolean>;
  /** Optional override of "now" for deterministic tests. */
  now?: () => Date;
}

export type BridgeDispatchOutcome =
  | {
      ok: true;
      jobId: string;
      routedDeviceId: string;
      routedAs: BridgeJobRoutedAs;
      /** True when the wire send happened synchronously; false when state
       *  remained `queued` (offline device OR awaiting trust approval). */
      wireSent: boolean;
    }
  | {
      ok: false;
      reason:
        | "no-active-device"
        | "multiple-active-no-explicit-device"
        | "device-not-found"
        | "device-revoked";
      message: string;
    };

/** Default online check — reads `lastDialAt` from the DB. The bridge-server
 *  module injects a wire-aware version that also checks the in-memory
 *  `Map<deviceId, WebSocket>` for live connections. */
function defaultIsOnline(db: typeof appDb, now: Date) {
  return async (deviceId: string): Promise<boolean> => {
    const rows = await db.select().from(bridgeDevices).where(eq(bridgeDevices.id, deviceId));
    const row = rows[0];
    if (!row || row.status !== "active") return false;
    if (!row.lastDialAt) return false;
    return now.getTime() - row.lastDialAt.getTime() < ONLINE_WINDOW_MS;
  };
}

/** AC #13 — scrubbed reviewDetails.bridge.command for exec payloads only. */
function buildReviewDetailsBridge(
  payload: BridgePayload,
  routedAs: BridgeJobRoutedAs,
  routedDeviceId: string,
  deviceName: string,
  requestedDeviceId: string | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    deviceId: routedDeviceId,
    deviceName,
    routedAs,
    kind: payload.kind,
    exitCode: null,
    durationMs: 0,
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTail: "",
    stderrTail: "",
    truncated: false,
    orphaned: false,
  };
  if (requestedDeviceId && requestedDeviceId !== routedDeviceId) {
    base.requestedDeviceId = requestedDeviceId;
  }
  if (payload.kind === "exec") {
    const execPayload = payload as BridgeExecPayload;
    const fullCommand = [execPayload.command, ...(execPayload.args ?? [])].join(" ");
    // scrub.ts redacts an *explicit* secret list — Brief 212 AC #13 expects
    // pattern-style scrubbing here. Until the vault-fetch follow-on lands,
    // this is a no-op pass-through; flagged for Architect (Insight-043).
    base.command = scrubCredentialsFromValue(fullCommand, [], "bridge-cmd");
  } else {
    base.tmuxSession = payload.tmuxSession;
  }
  return base;
}

/**
 * Dispatch a bridge job. The first executable statement is the stepRunId
 * guard — verified by AC #3 DB-spy test (zero DB reads/writes before the
 * throw when stepRunId is missing).
 */
export async function dispatchBridgeJob(
  input: BridgeDispatchInput,
  deps: BridgeDispatchDeps = {},
): Promise<BridgeDispatchOutcome> {
  // (1) FIRST executable statement — Insight-180 guard, AC #3.
  // No DB lookups, no logging, no network calls precede this check.
  if (!input.stepRunId && !TEST_MODE) {
    throw new Error(
      "dispatchBridgeJob requires stepRunId (Insight-180 guard). Set DITTO_TEST_MODE=true to bypass in tests.",
    );
  }

  const db = deps.db ?? appDb;
  const now = (deps.now ?? (() => new Date()))();
  const isOnline = deps.isDeviceOnline ?? defaultIsOnline(db, now);

  // (2) Resolve target device.
  let primaryDeviceId = input.deviceId;
  if (!primaryDeviceId) {
    const workspaceId = input.workspaceId ?? "default";
    const activeDevices = await db
      .select()
      .from(bridgeDevices)
      .where(and(eq(bridgeDevices.workspaceId, workspaceId), eq(bridgeDevices.status, "active")));
    if (activeDevices.length === 0) {
      return {
        ok: false,
        reason: "no-active-device",
        message: `No active device for workspace '${workspaceId}'. Pair one in the Devices admin page.`,
      };
    }
    if (activeDevices.length > 1) {
      return {
        ok: false,
        reason: "multiple-active-no-explicit-device",
        message: `${activeDevices.length} active devices in workspace; specify deviceId explicitly.`,
      };
    }
    primaryDeviceId = activeDevices[0].id;
  }

  // Verify the device exists and isn't revoked.
  const primaryRows = await db.select().from(bridgeDevices).where(eq(bridgeDevices.id, primaryDeviceId));
  const primaryRow = primaryRows[0];
  if (!primaryRow) {
    return { ok: false, reason: "device-not-found", message: `Device ${primaryDeviceId} not found.` };
  }
  if (primaryRow.status === "revoked") {
    return { ok: false, reason: "device-revoked", message: `Device ${primaryDeviceId} is revoked.` };
  }

  // (3) Apply fallback routing rules (AC #4 routing rules).
  let routedDeviceId = primaryDeviceId;
  let routedAs: BridgeJobRoutedAs = "primary";
  let routedDeviceName = primaryRow.deviceName;

  const primaryOnline = await isOnline(primaryDeviceId);
  if (!primaryOnline) {
    let fallbackPicked = false;
    for (const fallbackId of input.fallbackDeviceIds ?? []) {
      const fallbackRows = await db.select().from(bridgeDevices).where(eq(bridgeDevices.id, fallbackId));
      const fallbackRow = fallbackRows[0];
      if (!fallbackRow || fallbackRow.status !== "active") continue;
      const fallbackOnline = await isOnline(fallbackId);
      if (fallbackOnline) {
        routedDeviceId = fallbackId;
        routedDeviceName = fallbackRow.deviceName;
        routedAs = "fallback";
        fallbackPicked = true;
        break;
      }
    }
    if (!fallbackPicked) {
      // Primary offline + no online fallback → queue for primary.
      // (Queue-persistence AC #8 replays on primary reconnect.)
      routedAs = "queued_for_primary";
    }
  }

  // (4) Persist the bridge_jobs row in `queued`. Wire send happens
  // synchronously below if (and only if) trust advanced AND the device is
  // online (routedAs !== queued_for_primary).
  const jobInsert = await db
    .insert(bridgeJobs)
    .values({
      deviceId: routedDeviceId,
      requestedDeviceId: primaryDeviceId !== routedDeviceId ? primaryDeviceId : null,
      routedAs,
      processRunId: input.processRunId,
      stepRunId: input.stepRunId,
      kind: input.payload.kind,
      payload: input.payload as unknown as Record<string, unknown>,
      state: "queued",
      queuedAt: now,
    })
    .returning();
  const jobId = jobInsert[0].id;

  // (5) Wire send if trust says advance AND device is online.
  let wireSent = false;
  const advanced = input.trustAction === "advance" || input.trustAction === "sample_advance";
  if (advanced && routedAs !== "queued_for_primary" && deps.sendOverWire) {
    const sent = await deps.sendOverWire(jobId, routedDeviceId, input.payload);
    if (sent) {
      await db
        .update(bridgeJobs)
        .set({ state: "dispatched", dispatchedAt: now })
        .where(eq(bridgeJobs.id, jobId));
      wireSent = true;
    }
  }

  // (6) Audit row in harness_decisions (AC #13).
  const reviewDetails = {
    bridge: buildReviewDetailsBridge(
      input.payload,
      routedAs,
      routedDeviceId,
      routedDeviceName,
      primaryDeviceId !== routedDeviceId ? primaryDeviceId : undefined,
    ),
  };
  await db.insert(harnessDecisions).values({
    processRunId: input.processRunId,
    stepRunId: input.stepRunId,
    trustTier: input.trustTier,
    trustAction: input.trustAction,
    reviewPattern: ["bridge_dispatch"],
    reviewResult: "skip",
    reviewDetails,
  });

  return { ok: true, jobId, routedDeviceId, routedAs, wireSent };
}
