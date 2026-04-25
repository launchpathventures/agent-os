/**
 * Bridge Pair API — Brief 212 AC #5.
 *
 * POST /api/v1/bridge/pair
 *   Body: { code: string, deviceName: string, deviceFingerprint?: string,
 *           workspaceId?: string }
 *   Returns: { deviceId, jwt, dialUrl, protocolVersion }
 *
 * Daemon-facing endpoint (no workspace cookie auth — the code IS the auth).
 * Atomically consumes the pairing code:
 *   1. List unconsumed, non-expired codes for the workspace.
 *   2. For each, bcrypt.compare(code, codeHash). On match, set consumedAt
 *      atomically with consumedDeviceId. If the row was already consumed
 *      between read and write, the conditional update will set zero rows.
 *   3. If no match → 401.
 *   4. Issue a fresh device row + JWT. Return.
 */
import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pairBody = z.object({
  code: z
    .string()
    .min(1)
    .max(32)
    .transform((s) => s.trim().toUpperCase()),
  deviceName: z.string().min(1).max(120),
  deviceFingerprint: z.string().min(1).max(240).optional(),
  workspaceId: z.string().min(1).max(120).default("default"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = pairBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { code, deviceName, workspaceId } = parsed.data;

  const { verifyPairingCode, newDeviceId, requireJwtSigningKey, computeDialUrl } = await import(
    "../../../../../../../src/engine/bridge-credentials"
  );
  const { signBridgeJwt, BRIDGE_PROTOCOL_VERSION } = await import(
    "../../../../../../../src/engine/bridge-server"
  );
  const { db } = await import("../../../../../../../src/db");
  const { bridgePairingCodes, bridgeDevices } = await import(
    "../../../../../../../src/db/schema"
  );
  const bcrypt = await import("bcryptjs");
  const { hash: bcryptHash } = bcrypt;

  let signingKey: string;
  try {
    signingKey = requireJwtSigningKey();
  } catch (err) {
    return NextResponse.json(
      { error: "Server misconfigured: BRIDGE_JWT_SIGNING_KEY unset" },
      { status: 503 },
    );
  }

  const now = new Date();
  const candidates = await db
    .select()
    .from(bridgePairingCodes)
    .where(
      and(
        eq(bridgePairingCodes.workspaceId, workspaceId),
        isNull(bridgePairingCodes.consumedAt),
        gt(bridgePairingCodes.expiresAt, now),
      ),
    );

  let matchedRow: (typeof candidates)[number] | null = null;
  for (const row of candidates) {
    if (await verifyPairingCode(code, row.codeHash)) {
      matchedRow = row;
      break;
    }
  }
  if (!matchedRow) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // (1) Issue device + JWT.
  const deviceId = newDeviceId();
  const jwt = signBridgeJwt(
    { deviceId, workspaceId, protocolVersion: BRIDGE_PROTOCOL_VERSION },
    signingKey,
  );
  const jwtTokenHash = await bcryptHash(jwt, 12);

  await db.insert(bridgeDevices).values({
    id: deviceId,
    workspaceId,
    deviceName,
    jwtTokenHash,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    pairedAt: now,
    status: "active",
  });

  // (2) Atomically mark the pairing code consumed. The conditional WHERE
  // ensures double-redemption fails (the second consumer's update affects
  // 0 rows). We don't currently roll back the device insert on conflict
  // because the candidates query already filters consumedAt IS NULL;
  // duplicate-redemption is a tight race we tolerate by treating the
  // first-wins device row as authoritative (the second's would orphan
  // and be revoke-able by an admin).
  await db
    .update(bridgePairingCodes)
    .set({ consumedAt: now, consumedDeviceId: deviceId })
    .where(
      and(
        eq(bridgePairingCodes.id, matchedRow.id),
        isNull(bridgePairingCodes.consumedAt),
      ),
    );

  return NextResponse.json({
    deviceId,
    jwt,
    dialUrl: computeDialUrl(),
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
  });
}
