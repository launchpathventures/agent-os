/**
 * Ditto Web — Process Capabilities API
 *
 * GET /api/capabilities — Returns ProcessCapability[] from templates, cycles,
 * and active process runs. Powers the Library composition intent.
 *
 * Provenance: Growth API pattern (Brief 140), process-model-lookup.ts (template loading).
 */

import { NextResponse } from "next/server";
import { applyConfigToEnv, loadConfig } from "@/lib/config";

async function getProcessEngine() {
  const config = loadConfig();
  if (config) applyConfigToEnv(config);

  const processData = await import("../../../../../src/engine/process-data");
  return processData;
}

export async function GET() {
  try {
    const engine = await getProcessEngine();
    const capabilities = await engine.getProcessCapabilities();
    return NextResponse.json(capabilities);
  } catch (error) {
    console.error("Capabilities API error:", error);
    return NextResponse.json(
      { error: "Failed to load capabilities" },
      { status: 500 },
    );
  }
}
